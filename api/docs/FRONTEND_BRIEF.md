# Frontend brief (for GitHub Copilot)

You are a senior frontend engineer. Build the UI for the proposal/contract/negotiation platform whose **backend is already complete** in this repo. Read `docs/API.md` first; it is the contract. **Do not change anything under `src/lib`, `src/modules`, `src/database`, `src/migrations` or `src/app/api`.** If the API seems to be missing something, write the gap down instead of working around it.

## Stack & rules
* Next.js App Router + TypeScript in this repo (pages under `src/app/(admin)/…` and `src/app/p/[token]`), calling `/api/v1` on the same origin. Tailwind or CSS modules, no heavy UI kit.
* Money arrives as **integer minor units**; format with `Intl.NumberFormat` only for display. Never use floats for money. Send `null` (not 0) for "not set". **Never recompute totals in the browser**: render `computed` from the API.
* Keep the access token **in memory** (refresh with the refresh token on 401; do not log tokens). The proposal link token is a secret: never log it, never send it to analytics, use `rel="noreferrer"`.
* Render all server text as plain text/escaped. Documents come as HTML: show them only inside `<iframe sandbox srcdoc>` or a Blob URL.
* Every form: labels, inline validation from `field` in error responses, loading / empty / error states, confirmation dialogs for destructive actions, keyboard accessible, AA contrast.

## Design language (reuse the portfolio branding)
Warm paper background `#f6f2ea`, ink `#1b1b18`, accent green `#1f6b57`, display font Bricolage Grotesque, mono JetBrains Mono, light + dark mode, generous spacing, calm premium feel. Status badges: one consistent component mapping each proposal status to a colour + label.

## Admin screens (`/login` then sidebar layout)
1. **Dashboard** from `GET /dashboard`: cards (clients, projects, drafts, awaiting client, accepted, needs negotiation), "Awaiting my response" list linking to negotiations, expiring in 7 days, upcoming milestones, recent client activity, recent revisions, outstanding/overdue payments, upcoming renewals. Empty states for each.
2. **Clients**: list+search, create/edit form (individual vs organisation, currency), profile page with projects, proposals and negotiation history.
3. **Projects**: list, create/edit with progressive disclosure (essentials first; lists such as objectives/exclusions as add/remove rows). Tabs: Overview · Requirements (FR/NFR/SEC table, drag to reorder, priority, dependencies, acceptance criteria) · Milestones · Requirements document · Proposals · Change requests.
4. **Requirements document editor** (`/srs`): ordered sections (add, rename, delete, drag-reorder, per-section "visible to client"), markdown-lite textarea (paragraphs, `- ` bullets, `1.` lists, `**bold**`), explicit **Save** with revision handling (409 → "changed elsewhere, reload"), status (draft/in review/approved), **Create version** (note, minor/major), version list, document preview/print.
5. **Proposal builder** (`/proposals/:id`): left stepper, right live preview. Steps: Details (client, title, validity, currency) → Content sections → **Pricing** → Review & publish.
   * **Pricing step (most important):** implementation fee (+ "confirmed" toggle); payment schedule rows (percent or fixed, trigger, condition, due date) with a running "adds up to fee ✓/✗"; external services table with per-service billing options, "paid at activation" / "renews" / "optional" / "client can choose" toggles, estimated vs confirmed badge, "awaiting confirmation" for null prices; maintenance packages (choose one); other recurring fees; optional enhancements. Beside it, a summary panel from `computed`: **Payable before development**, **Recurring per period** (monthly / quarterly / annual separately), annual & monthly-average (show "approx."), usage-based costs clearly marked variable, and a "Provisional" banner when `provisional`.
   * **Review & publish:** show `readiness.blockers` (red, publish disabled) and `warnings` (amber, each needs a checkbox → `overrideWarnings`). Choose minor/major bump and change note on revisions. After the first publish show the **client link once** with a copy button and a warning that it cannot be shown again; offer Revoke / Regenerate.
   * Read-only banner + "Start revision" when the draft isn't editable; "Create amendment" when accepted.
   * Version history with "compare" (`/compare`), per-version document preview (proposal, cost breakdown, scope, payment schedule, contract draft, acceptance record) and CSV download.
6. **Negotiations inbox** → detail: request (kind, message, reason, proposed budget/terms, selections), thread with **internal notes visually distinct** from client replies, composer (reply to client / internal note), and decision buttons (answered, agreed, declined, countered, closed) with a client-visible note. Explain in the UI that *agreed/countered moves the proposal to "revision in progress"* and nothing changes until a new version is published.
7. **Payments**, **Service catalog**, **Templates**, **Settings** (business details, logo ≤ ~200 KB PNG/JPEG/WebP, defaults, numbering, portal branding), **Audit log** (filterable).

## Client portal (`/p/[token]`, mobile-first, no admin chrome)
* Header with your business branding (from `proposal.business`/`portal`), proposal reference, version label, validity date, status.
* Sections in reading order with a sticky mobile table of contents; the requirements document (`proposal.srs`) in a collapsible area.
* **Costs** laid out in the order: Implementation fee & payment schedule → Initial service activation (paid before development) → Future renewals & maintenance → Usage-based (estimates) → Optional. Label every estimate/"awaiting confirmation". Show the note that the initial payment covers only the initial period.
* If `clientCanRequestOptionChanges`: option pickers for `clientSelectable` services/maintenance calling `selection-preview`, showing current vs requested totals and the text "awaiting developer approval; not applied until a revised proposal is issued"; "Submit request" posts `service_selection`.
* Actions (only when `canRespond`): **Accept** (name, email, optional title/organisation, the exact `acceptanceStatementTemplate` text with the typed name filled in, required checkbox; send `versionId` + `contentHash`; on 409 show "proposal was updated, reload"), **Ask a question**, **Request a change** (scope / price with proposed budget / payment terms / general), **Decline**. Show the client's requests and your replies (thread).
* After acceptance: confirmation panel with timestamp, version, fingerprint, and "Download acceptance record". Statuses `expired`, `rejected`, `revision_in_progress` show a calm explanatory state with actions disabled.
* Document buttons (`/public/proposals/:token/document?kind=…`) open in a new tab/iframe. Print stylesheet friendly.
* Wording rule: never say the online acceptance is "legally binding in all cases"; use the server-provided statement text.

## Definition of done
`npm run typecheck`, `npm run lint`, `npm run build` pass; keyboard-only walkthrough of the proposal builder works; portal verified at 360 px width; no money arithmetic in the UI; no use of `localStorage` for tokens.
