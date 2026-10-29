# Digital Fred: Proposals, Requirements & Negotiation backend

Backend (Next.js route handlers + PostgreSQL via TypeORM) for preparing requirements documents and commercial proposals, sharing them with clients through secure links, handling negotiation, issuing revisions and recording acceptance. Single owner (you) signs in to the dashboard; clients use a secret link and need no account.

* API contract: [`docs/API.md`](docs/API.md) · Frontend instructions: [`docs/FRONTEND_BRIEF.md`](docs/FRONTEND_BRIEF.md)

## Setup
```bash
npm install
cp .env.example .env        # fill DATABASE_URL, JWT secrets, PUBLIC_APP_URL, CRON_SECRET, ADMIN_*
npm run migration:generate  # creates the schema migration from the entities (first time and after entity changes)
npm run migration:run       # applies it, then the immutability triggers (src/migrations/1893456000000-…)
npm run seed:admin          # creates your login (then delete ADMIN_PASSWORD from .env)
npm run seed:exeat360gh     # optional: loads the exeat360gh draft project, requirements, SRS and proposal (no prices)
npm run dev
```
> Run `migration:generate` **once** on a fresh database before `migration:run`. The hand-written `ImmutabilityGuards` migration is dated so it always runs after the generated schema.

## Environment variables
| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`DATABASE_SSL=true/false` to override auto-detect) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ chars each; never commit |
| `PUBLIC_APP_URL` | base for client links → `{PUBLIC_APP_URL}/p/{token}` |
| `ALLOWED_ORIGINS` | production CORS allow-list (only needed for a separate frontend origin) |
| `CRON_SECRET` | 24+ chars; protects `POST /api/v1/internal/expire-proposals` |
| `ADMIN_EMAIL/PASSWORD/FIRST_NAME/LAST_NAME` | used only by `seed:admin` |

## Scripts
`dev · build · start · lint · typecheck · test` (pure-logic tests, no database needed) · `migration:generate|run|revert` · `seed:admin` · `seed:exeat360gh`.

## How it protects the record
* Published proposal versions, requirement-document versions, acceptance records and the audit log are **append-only at the database level** (triggers reject UPDATE/DELETE).
* A published version is a frozen, hashed (SHA-256) snapshot. Clients only ever see data copied into that snapshot: internal notes, hidden sections and admin data are never copied.
* Client requests never alter terms. Only a newly published version, explicitly accepted, does. Accepting requires the client to echo the version id + hash they saw.
* Client links: 256-bit random token, only its hash stored, revocable, optional expiry; unknown/revoked/expired are indistinguishable.
* Money: integer minor units, BigInt percentage maths, unset price = `null` (never 0). Totals are computed only on the server.

## Using it: preparing and sending the exeat360gh proposal
1. **Settings** → business name, contact, logo, default currency/validity, default warranty/IP/etc. clauses (nothing is invented; empty fields print nothing).
2. **Client** → create the school/organisation. **Project** → open *exeat360gh* (seeded) and assign the client; review/edit scope, requirements (FR-001…), exclusions, future enhancements.
3. **Requirements document** → review sections, mark *approved*, create version 1.0.
4. **Proposal** → open the seeded draft. Set the implementation fee once decided; adjust the 50/50 schedule; for each external service add the provider's billing options and prices (mark *confirmed* only when verified); choose a maintenance package once decided; fill any empty sections (timeline, IP/ownership, support).
5. **Review & publish** → fix blockers, acknowledge warnings, publish → version 1.0 + a client link (shown once). Send the link.
6. **Negotiation** → requests appear on the dashboard. Reply / add private notes → *resolve*. If you agree/counter, the proposal goes to *revision in progress*: edit, publish **1.1** (small) or **2.0** (substantial). The old version stays untouched.
7. **Acceptance** → client accepts exact version → acceptance record + payment rows created. Download the acceptance record; generate the **contract draft** for review/signature.
8. **Later changes** → *Create amendment* (new linked proposal) or a **change request** quote.

## Production notes
* Deploy to any Node host with PostgreSQL. Set a scheduler to call the expiry endpoint (e.g. Vercel Cron, daily).
* The in-memory rate limiter is per server instance. Behind several instances/serverless, add a shared limiter (e.g. Redis) or edge rate limiting. Login additionally has a database-backed lockout.
* The database SSL option uses `rejectUnauthorized: false` for hosted databases; supply your provider's CA for strict verification.
* Back up the database: it is the only copy of the record.
