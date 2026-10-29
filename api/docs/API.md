# API reference

Base path: `/api/v1`. JSON in, JSON out. **Admin** routes need `Authorization: Bearer <accessToken>`. **Public** routes (client portal) need no login; they are addressed by the secret token in the URL.

## Envelope
```jsonc
// success
{ "success": true, "code": "DFD_S2000", "message": "...", "data": { }, "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 } }
// error
{ "success": false, "message": "...", "code": "DFD_E0xxx", "label": "VALIDATION_FAILED", "key": "validation_failed", "field": "email", "details": { } }
```
Status codes: 400 validation · 401 not signed in · 404 not found · 409 invalid state / stale edit / duplicate · 422 not ready to publish (`details` = readiness report) · 429 rate limited.

**Money is always integer minor units** (pesewas): GHS 1,234.56 = `123456`. `null` = *not set / awaiting confirmation* (never zero). Percentages are basis points (50% = `5000`). Dates are `YYYY-MM-DD`.

**Concurrency:** drafts (`PUT /proposals/:id/draft`, `PUT /projects/:id/srs`) must send the `revision` they loaded; a stale value returns 409 `CONCURRENT_MODIFICATION`: reload and re-apply.

## Auth
| | |
|---|---|
| `POST /auth/login` `{email,password}` | → `{user, accessToken, refreshToken}` (10/min/IP; 5 failures lock the account 15 min) |
| `POST /auth/refresh` `{refreshToken}` | → new token pair |
| `GET /auth/me` · `POST /auth/logout` | logout invalidates every issued token |
| `POST /auth/change-password` `{currentPassword,newPassword}` | min 12 chars, upper/lower/number/symbol |

## Admin resources (all require auth)
| Area | Endpoints |
|---|---|
| Dashboard | `GET /dashboard` · `GET /audit-logs?entityType&entityId&action&actorType` |
| Settings | `GET/PUT /settings` (business, defaults, numbering, portal branding) |
| Clients | `GET/POST /clients` (`?search`) · `GET/PATCH/DELETE /clients/:id` (GET includes projects, proposals, negotiations) |
| Projects | `GET/POST /projects` (`?clientId&status&search`) · `GET/PATCH/DELETE /projects/:id` |
| Requirements | `GET/POST /projects/:id/requirements` (code FR-001 etc. auto) · `PATCH/DELETE …/requirements/:rid` · `POST …/requirements/reorder {ids}` |
| Milestones | `POST /projects/:id/milestones` · `PATCH/DELETE …/milestones/:mid` |
| Change requests | `GET/POST /projects/:id/change-requests` · `PATCH /change-requests/:id` · `GET /change-requests/:id/document` |
| Requirements doc (SRS) | `GET/PUT /projects/:id/srs` (GET creates it, pre-filled from the project) · `PUT …/srs/status` · `GET/POST …/srs/versions` · `GET …/srs/versions/:vid` · `GET …/srs/document?version=` |
| Service catalog | `GET/POST /service-catalog` · `PATCH/DELETE /service-catalog/:id` |
| Templates | `GET/POST /templates?kind=` · `PATCH/DELETE /templates/:id` (kinds: srs, proposal, contract, change_request, handover_checklist) |
| Proposals | `GET/POST /proposals` · `GET/PATCH/DELETE /proposals/:id` · `PUT …/draft` · `GET …/preview` · `POST …/transition {to}` · `POST …/publish` · `POST/DELETE …/link` · `POST …/amend` · `GET …/versions` · `GET …/versions/:vid` · `GET …/compare?from&to` |
| Documents | `GET /proposals/:id/document?kind=&version=` · `GET /projects/:id/handover-checklist` (return **HTML**, see below) |
| Exports (CSV) | `GET /proposals/:id/costs-csv?version=` · `GET /exports/proposals-csv` |
| Negotiations | `GET /negotiations?status=&proposalId=` · `GET /negotiations/:id` (includes internal notes) · `POST …/messages {body,visibility:"client"|"internal"}` · `POST …/resolve {resolution,note}` |
| Payments | `GET /payments?proposalId&status` · `PATCH /payments/:id {status,paymentReference,notes,dueDate}` (bookkeeping only; no payment is processed) |

### Proposal lifecycle
`draft → ready_for_review → sent → viewed → clarification_requested | negotiation_requested → revision_in_progress → revised_sent → … → accepted | rejected | expired | withdrawn`

* Manual transitions (`POST /transition`): `draft`, `ready_for_review`, `withdrawn`, `revision_in_progress`. Everything else is set by the system (publish, client actions, resolving requests, expiry).
* The draft is editable only in `draft`, `ready_for_review`, `revision_in_progress`. Once published, **start a revision** to change it.
* `accepted` and `withdrawn` are final. To change an accepted proposal, `POST /proposals/:id/amend` creates a new linked **amendment** proposal.
* `GET /proposals/:id` returns `allowedTransitions`, `draftEditable`, `readiness {canPublish, blockers[], warnings[]}`, `computed` (pricing), `versions`, `link` status, `acceptances`.

### Publishing
`POST /proposals/:id/publish` `{ bump?: "minor"|"major", changeNote?, overrideWarnings?: string[] }`
* First publish = **1.0**; later `minor` → 1.1, `major` → 2.0.
* **Blockers** (422) cannot be overridden (no client, no scope, fee not set, schedule ≠ fee, currency mismatch …).
* **Warnings** must each be acknowledged by code in `overrideWarnings` (missing exclusions/warranty, estimates, unpriced services, no maintenance …); otherwise 422 lists the unacknowledged ones.
* Response includes `link: {token, url}` **only when a new link was created** (first publish). The raw token is shown once; only its hash is stored. Use `POST /proposals/:id/link {expiresInDays?}` to revoke the old link and get a new one.

### Documents
Document routes return `text/html` (print-optimised, A4, page numbers, **Print / Save as PDF** button). Browsers can't send a Bearer header on navigation, so fetch with the header, then show the text in an `<iframe sandbox srcdoc>` or open a Blob URL. `kind`: `proposal | cost_breakdown | scope | payment_schedule | contract | acceptance_record`. `version`: `latest` (default), `draft` (working copy, watermarked DRAFT), or a version id. The contract is always marked DRAFT.

## Pricing object (inside `draft.pricing`; see `src/lib/pricing/types.ts`)
`{ currency, implementationFee:{amountMinor|null, confirmed}, paymentSchedule[], services[], maintenancePackages[], otherRecurring[], optionalEnhancements[] }`.
* Service: `options[]` each `{period: one_time|monthly|quarterly|annual|usage|custom, periodMonths?, amountMinor|null, taxMinor, currency, confirmed, paymentDeadline?, renewalDate?}`; `selectedOptionId`; `payInActivation` (first period paid before development), `recurring` (renews), `optional`, `clientSelectable`.
* The server calculates everything (`computed`): activation total, recurring **per period** (monthly / quarterly / annual / custom, never mixed), comparable annual & monthly-average (flagged approximate), usage-based lines kept out of totals, `payableBeforeDevelopment`, and `provisional` flags for estimates/unpriced lines. **Do not recompute totals in the UI**: render `computed`.

## Public client portal (no auth, rate-limited)
`{token}` is the secret from the link `/p/{token}`. Unknown, revoked and expired links all return the same 404 `LINK_INVALID`.

| Endpoint | Request | Result |
|---|---|---|
| `POST /public/client-intake` | `{type:"individual"|"organization",contactName,organizationName?,email,phone?,preferredCurrency:"GHS"|"USD"}` | Creates a client record and returns `{id,displayName}`. Country is always Ghana. Phone must contain 1–15 digits when supplied. Limited to 5 submissions per IP per 10 minutes. |

This intake endpoint is public and does not require a proposal token. Share the frontend `/client-intake` page directly with the intended client; anyone who obtains the page/API URL can submit details, so remove the temporary endpoint after the intake period if it is no longer needed.

| | |
|---|---|
| `GET /public/proposals/:token` | client-safe proposal (latest published version), status, `canRespond`, client-visible thread, acceptance (if any) |
| `POST …/negotiations` | `{kind: clarification|scope_change|price_change|payment_term_change|service_selection|general, subject, message, reason?, proposedBudgetMinor?, proposedPaymentTerms?, name, email}`; for `service_selection` add `{services:[{itemId,optionId}], maintenancePackageId?}` |
| `POST …/negotiations/:rid/messages` | `{body}` follow-up on the client's own request |
| `POST …/selection-preview` | same selection body; returns `{current, requested}` pricing for comparison; **saves nothing** |
| `POST …/accept` | `{name, email, title?, organization?, confirm:true, versionId, contentHash}` echo the `version.id` and `version.contentHash` received from GET; refused if the proposal was revised meanwhile |
| `POST …/reject` | `{reason?}` |
| `GET …/document?kind=proposal|cost_breakdown|scope|payment_schedule|acceptance_record` | HTML |

A client request **never** changes terms. Terms change only when you publish a new version and the client accepts it.

## Scheduler
`POST /internal/expire-proposals` with `Authorization: Bearer $CRON_SECRET` (GET also accepted for Vercel Cron). Idempotent. Expiry is also enforced lazily on every portal read/accept.
