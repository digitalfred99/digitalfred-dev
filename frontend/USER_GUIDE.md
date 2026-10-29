# DigitalFred Studio Console — User Guide

This guide explains how to use the Studio Console to manage clients, projects, proposals, client conversations, and payment records.

## 1. Start the application

The frontend runs on port **3001** and expects the backend API on port **3000** by default.

1. Start the backend using the instructions in the repository root.
2. In a terminal, open `frontend/` and install the dependencies if needed:

   ```bash
   npm install
   ```

3. If the backend is not at `http://localhost:3000`, create `frontend/.env.local` and set its origin (do not append `/api/v1`):

   ```dotenv
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

4. Start the frontend:

   ```bash
   npm run dev
   ```

5. Visit [http://localhost:3001](http://localhost:3001).

The frontend sends API requests to `${NEXT_PUBLIC_API_URL}/api/v1`. It does not contain a separate data store; the API is the source of truth. Use an account provisioned by the backend to sign in.

## 2. Sign in and your workspace

Open `/login`, enter your email and password, and choose **Sign in**. The protected workspace opens after successful authentication. Use **Sign out** in the sidebar or mobile header to end the session.

Access and refresh tokens exist in memory only. They are not written to local storage or cookies. A browser reload clears the session, so you must sign in again. An expired session also returns you to the login screen.

The admin sidebar groups the main areas as follows:

| Area | What it is for |
| --- | --- |
| Overview | Workspace metrics and items needing attention |
| Clients | Client directory and individual client records |
| Projects | Scope, requirements, delivery milestones, and change requests |
| Proposals | Proposal drafts, published versions, and client links |
| Negotiations | Client questions and change requests |
| Payments | Bookkeeping records from accepted proposal versions |
| Services | Reusable service and pricing options |
| Templates | Reusable document section structures |
| Settings | Business identity, defaults, numbering, and portal preferences |
| Audit log | Filterable record of workspace actions |

## 3. Overview dashboard

The dashboard gives you a workspace-wide snapshot:

- **Clients**, **Projects**, **Draft proposals**, **Awaiting client**, **Accepted**, and **Needs negotiation** link to the related areas.
- **Awaiting my response** lists client requests that need attention.
- **Expiring in 7 days** highlights live proposals approaching their validity date.
- **Upcoming milestones** lists project deadlines in the next two weeks.
- **Recent client activity** and **Recent revisions** show recent changes and published proposal versions.
- **Payments** summarizes outstanding and overdue bookkeeping records.

Each list has an empty state when there is nothing to show. Use the linked item to open its record and take action.

## 4. Clients

### Collect details through a client intake link

From the **Clients** page, choose **Copy intake link** and send that URL directly to the intended client. The client can submit an individual or organisation name, contact name, email, optional phone number, and preferred currency. Country is fixed to Ghana; currency choices are GHS and USD (GHS is selected by default); phone input accepts digits only, up to 15 digits.

Submitting the form immediately creates a client record in your workspace, so you can find it in **Clients** and use it when creating a project or proposal. The public intake endpoint is rate-limited, but the link is not access-controlled—anyone who receives it can submit details. Share it privately and remove/disable the temporary endpoint when you no longer need it.

### Add and find clients

Open **Clients** and choose **Add client**. Select **Organisation** or **Individual**, then enter the contact name, email, country, and preferred currency. Organisation records also ask for an organisation name; phone is optional. Save to add the client to the directory.

Use the search field to find a client by the available directory search. Choose the client name or **View** to open the profile.

### Manage a client profile

The profile lets you update identity and contact details, billing address, tax ID, preferred currency, and private internal notes. Choose **Save changes** to submit updates. Details are used on future proposals; do not assume an edit rewrites an already published proposal.

The profile also links to that client's projects and proposals and lists negotiation history. **Delete client** opens a confirmation before the delete request is sent.

## 5. Projects and delivery scope

### Create a project

Open **Projects**, select **New project**, and enter a project name. You can optionally add an identifier, assign a client, and provide a description, business problem, proposed solution, and initial scope. Save to create the project and open its workspace.

Search the project directory by name or identifier. Project rows show client, status, and last update.

### Project workspace tabs

- **Overview:** Read the project brief, business problem, proposed solution, scope, and dates. Open the requirements document or handover checklist from here.
- **Requirements:** Add functional, non-functional, or security requirements. Give each a title, description, and priority (`must`, `should`, `could`, or `won't`). Use the up/down controls to change delivery order.
- **Milestones:** Add a title, optional description, and due date. Update a milestone's status to planned, in progress, completed, or delayed.
- **Requirements doc:** Opens the structured requirements-document editor.
- **Proposals:** Open proposals associated with this project, or start a proposal from this project.
- **Change requests:** Record proposed work beyond the current scope, including an optional estimate, currency, requester, and timeline impact. This is a record of the request, not an automatic change to an accepted agreement.

## 6. Requirements document

From a project, open **Requirements doc**. Edit the document title and sections, use the section controls to reorder or remove sections, and add sections as needed. Save the draft to persist your changes.

The document has a server-managed revision number. If another edit has changed the document since you loaded it, saving reports a conflict; reload the latest version before applying your changes again.

Use the status control to set draft, in review, or approved. Create a version from the saved draft by choosing a minor or major bump and entering a version note. Use **Preview** to open the rendered document; choose a version to preview an earlier version where available.

## 7. Proposals

### Create a draft

Choose **New proposal** from the dashboard or **Create proposal** from a project. Select a project, optionally enter a title, and enter a three-letter currency code. The server initializes pricing as unset; an unset amount is not the same as zero.

### Work through the builder

The builder has four steps:

1. **Details:** Set the title, client, validity, and proposal details. The selected project provides the starting scope context.
2. **Content:** Write and arrange the client-facing sections. Internal notes are for your team and are not included in the published snapshot. Attach the requirements document when appropriate.
3. **Pricing:** Add implementation fees, payment schedule entries, service options, maintenance, recurring costs, and optional enhancements. You can reuse active services from the catalog. Mark prices confirmed only when they are confirmed.
4. **Review & publish:** Review server-returned readiness results. Fix every **blocker**. Each **warning** must be explicitly acknowledged before publishing. Refresh server checks after making edits.

Save the draft as you work. Monetary inputs accept major currency units (for example, `1,234.56`); the app sends integer minor units to the API. Totals and readiness are calculated by the server and displayed from its response—do not treat a client-side estimate as the authoritative total.

### Publish and share the portal link

Publish only when server readiness allows it and any warnings have been acknowledged. Publishing creates an immutable version and, when returned by the API, a client portal link.

**Copy and share the link when it is displayed. The secret URL is shown only once in the browser session and is not recoverable by reloading the page.** Send it privately to the intended client. Do not post it publicly or include it in analytics. If it is lost, use **Regenerate link**; this revokes the previous link and shows a replacement once. **Revoke** immediately disables the active link.

Published proposal terms are read-only. Use **Start revision** to create a new editable revision; publish the revised version for the client to review. After a proposal has been accepted, use **Create amendment** to create a separate amendment rather than changing the accepted terms in place.

### Versions, documents, and exports

The version history shows version labels, publication dates, change notes, and content fingerprints. Use **Preview** to view the rendered proposal document, and select two versions to compare them. The CSV action downloads the latest cost breakdown. The builder also exposes document previews for supported proposal documents, such as scope, cost breakdown, payment schedule, contract, and acceptance record when available.

The proposal list supports text search and status filtering. The shared status badge reflects the status supplied by the server; status transitions are constrained by the server's allowed transitions.

## 8. Client portal

Clients do not need an admin account. They open the private `/p/[token]` link you shared with them. A portal link is a secret, so share it only with its intended recipient. Invalid, revoked, or unavailable links show an unavailable page.

The mobile-first portal presents:

- Proposal overview and client-visible sections, plus the included requirements document when present.
- Server-computed implementation cost and payment schedule, activation costs, recurring services and maintenance, usage estimates, optional items, and selectable options.
- Available proposal documents, including a cost breakdown and payment schedule where provided.
- A conversation area for requests and follow-up messages.

When client-selectable options are present, clients can change their selections and request a server-generated selection preview. The preview is informational and does not change the proposal terms. Clients can then:

- **Accept:** Enter their name and email, review the acceptance statement, and confirm the current version. Acceptance is tied to that exact published version. If the proposal changed while they were reviewing, they must reload and review the current version.
- **Ask a question:** Send a clarification or other request with a subject, message, and contact details.
- **Request a change:** Describe a scope, price, payment-term, or general change; a reason, proposed budget, and proposed payment terms can also be supplied where relevant.
- **Decline:** Submit a decline, optionally with a reason.
- **Continue a conversation:** Send follow-up messages on an existing request and view developer responses.

The portal reflects the server's `canRespond` and proposal status. If it is expired, declined, withdrawn, in revision, or otherwise not open for responses, its available actions can be restricted. A request or selection preview does not itself revise or accept a proposal. You must respond to the request, make any agreed changes in a new proposal version, publish it, and obtain acceptance of that version.

## 9. Negotiations

The **Negotiations** inbox defaults to open requests. Filter by status to view open, answered, agreed, declined, countered, or closed requests. Open a row to see the client submission, the proposal/version it refers to, any proposed budget or payment terms, and the conversation thread.

Use **Reply to client** for a message that the client should see. Choose **Internal note (private)** for notes visible only to your team; check the visibility before sending.

To record a decision, choose a resolution and provide the required client-visible note. Decisions such as agreeing to or countering a request move the proposal to revision in progress. They do **not** silently change proposal terms: edit and publish a new version, then have the client accept that version.

## 10. Payments (bookkeeping only)

Payment rows are created from accepted proposal versions. The **Payments** page lets you filter by pending, paid, or waived, and update a record's due date, payment reference, and notes. Marking a payment paid or waived asks for confirmation.

This application does **not** collect money, connect to a payment processor, or execute a transaction. These records are for bookkeeping. Amounts and labels are fixed from the accepted proposal version.

## 11. Service catalog

Use **Services** to keep reusable provider/service pricing options. Add a service name, optional provider/category/description, billing period, currency, and price. Leave the amount blank when it is not yet known; mark it confirmed only when verified.

Activate or deactivate entries to control their availability for new proposal pricing. Removing an item requires confirmation. Existing proposals retain their own copy of the service details.

## 12. Templates

Templates provide reusable section structures for requirements documents, proposals, contracts, change requests, and handover checklists. They are starting points, not pre-filled business claims or prices.

Choose a kind, name the template, arrange its sections, and optionally set it as the default for that kind. Edit a template from the saved list or delete it after confirmation. Existing documents are not changed when a template is edited or removed.

## 13. Settings

The single **Save settings** action saves the settings page:

- **Business details:** Name, legal name, contact details, website, address, registration/tax numbers, and an optional PNG/JPEG/WebP logo up to 200 KB. These details can appear in proposal documents.
- **Proposal defaults:** Currency, validity period, and standard payment, warranty, intellectual-property, confidentiality, change-request, termination, and support terms. Defaults affect new proposals; they do not rewrite existing terms.
- **Proposal numbering:** Prefix, number padding, and whether to include the year in new proposal references.
- **Client portal branding:** Accent colour, tagline, and footer note.
- **Notifications:** Notification email and whether to email about client activity, according to backend support and configuration.

## 14. Audit log

The **Audit log** provides a filterable workspace action history. Filter by action text, entity type, and actor type (client, developer, or system), then choose **Apply filters**. Each row shows the action, entity and ID, actor, metadata, and timestamp.

## 15. Useful reminders

- The backend is authoritative for pricing totals, readiness, proposal status transitions, versions, and acceptance. The interface displays those server results.
- Prices are stored as integer pesewas/minor units. Enter amounts in normal currency format; do not enter pesewas directly.
- A blank/unset price is different from `0.00`.
- Published proposal versions are immutable. Revisions and amendments create new records/versions rather than silently changing accepted terms.
- Portal URLs contain bearer-like secret tokens. Share them privately; regenerate a lost link or revoke a compromised link.
- If an API request fails, read the inline error, correct any field-specific issue, or use the page's retry/reload control.

## Developer checks

From `frontend/`, the available project checks are:

```bash
npm run typecheck
npm run lint
npm run build
```
