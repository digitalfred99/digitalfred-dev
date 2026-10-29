// Working scope for exeat360gh, stored as EDITABLE database records by `npm run seed:exeat360gh`.
// Nothing here is a price or a commitment. The implementation fee, service prices and maintenance are intentionally left unset.

export const PROJECT = {
  name: "exeat360gh",
  identifier: "exeat360gh",
  status: "requirements" as const,
  description:
    "exeat360gh is a multi-school secondary-school exeat management platform that improves accountability when students leave school temporarily and are expected to return. It distinguishes exeat authorisation, actual departure through the gate, actual return, overdue return, and exceptional closure or cancellation. It does not claim that a recorded departure proves the student arrived home.",
  businessProblem:
    "Schools need a reliable record of who was authorised to leave, who actually left, and who has returned, so that overdue students are identified quickly and guardians are informed.",
  proposedSolution:
    "A web platform where authorised staff create and approve exeat requests on behalf of students, gate officers verify students (by QR identifier or student ID) and record actual departure and return, overdue returns are detected by a scheduled job, and guardians are informed by SMS.",
  scope:
    "Multi-school web platform with isolated school data; staff roles (platform super administrator, headmaster/school administrator, exeat officer, security/gate officer); student and guardian records with QR identification and bulk import; exeat request and approval workflow; mobile-friendly gate operations (online); status and audit history; scheduled overdue processing; SMS notifications; school dashboards and reports; school-specific service and maintenance charge display.",
  lists: {
    objectives: ["Record exeat authorisation, departure and return separately", "Identify overdue returns reliably without anyone opening a dashboard", "Keep each school's data isolated", "Keep guardians informed by SMS"],
    targetUsers: ["Headmasters / school administrators", "Exeat officers and authorised staff", "Security / gate officers", "Platform super administrator (the developer)"],
    technologyStack: ["To be confirmed with the client during requirements review"],
    assumptions: ["Gate devices have internet access (gate operations need live server verification)", "An SMS provider with Ghana coverage is selected after verifying coverage, pricing, sender ID rules and delivery reports", "Guardian phone numbers are supplied by the school"],
    dependencies: ["SMS gateway provider", "Domain and hosting accounts", "Database and file/image storage hosting", "Email delivery service (if used)"],
    constraints: ["Internet is required for gate operations in version one", "A QR code is an identifier, not authorisation"],
    deliverables: ["Deployed multi-school web application", "Staff accounts and role permissions", "Student/guardian management with QR identification and validated bulk import", "Exeat request and approval workflow", "Gate scanning and manual-entry interface", "Scheduled overdue detection with SMS notifications", "School dashboards, reports and CSV export", "Handover documentation"],
    exclusions: ["Student accounts or student-facing apps", "Parent dashboards, portals or login accounts", "GPS tracking", "Real-time in-app parent notifications", "Automatic proof that a student arrived home; parent confirmation of home arrival", "Fully offline gate operations and local school servers", "Native Android or iOS applications", "Online payment processing", "Advanced school-management-system integrations", "Unspecified advanced analytics", "Any feature not in the approved requirements and proposal"],
    futureEnhancements: ["Offline gate support (locally cached records, queued gate events, sync and conflict handling): assessed and quoted separately", "Other items above, each assessed separately: only the incremental work is quoted where the existing architecture is reused"],
  },
  terms: {
    warranty: "30-day post-delivery defect warranty (proposed): covers reproducible defects that prevent the delivered application from meeting the approved requirements. It does not automatically cover new features, scope changes, third-party provider outages, unrelated infrastructure failures, client modifications, or issues caused by unauthorised changes or misuse. Final terms to be confirmed in the agreement.",
    ownership: "",
    maintenance: "Maintenance after the warranty period is defined separately. Future work is not automatically free support.",
    support: "",
  },
  timelineNotes: "To be confirmed after research and final scope confirmation.",
};

type R = { kind: "functional" | "non_functional" | "security" | "data" | "integration" | "reporting"; title: string; description: string; priority?: "must" | "should" | "could"; acceptanceCriteria?: string[] };
export const REQUIREMENTS: R[] = [
  { kind: "functional", title: "Multi-school tenancy", description: "Each school has its own profile, students, guardians, staff, roles, exeat requests, approval policies, gate records, reports and configuration.", acceptanceCriteria: ["A school administrator cannot read or change another school's data through the UI or by altering API requests"] },
  { kind: "functional", title: "Platform administration", description: "Platform super administrator can onboard schools, configure services and charges, and administer platform settings. Access to school records is limited to legitimate operational needs and audited." },
  { kind: "functional", title: "Role-based access", description: "Roles: Platform Super Administrator, Headmaster/School Administrator, Exeat Officer/Authorised Staff, Security/Gate Officer. Each role sees only the functions and data it is authorised to access; checks are enforced server-side." },
  { kind: "functional", title: "Staff and permission management", description: "School administrator manages staff accounts and configures which staff may create and approve exeat requests. Security officers do not automatically receive approval permission." },
  { kind: "functional", title: "Student records", description: "Register, update and deactivate students with profile information, optional photograph, and a unique student identification number per school." },
  { kind: "functional", title: "Guardian records", description: "Store guardian contact details per student for SMS communication." },
  { kind: "functional", title: "QR identification", description: "Generate a QR code per student that carries only an identifier, with no unnecessary sensitive data. Scanning never approves an exeat or authorises departure.", acceptanceCriteria: ["Scanning a valid QR for a student without an approved exeat shows a clear warning and does not allow departure"] },
  { kind: "functional", title: "Bulk student import", description: "Import students from a defined, validated file format with row-level error reporting.", priority: "should" },
  { kind: "functional", title: "Create exeat request", description: "Authorised staff create a request on behalf of a student recording reason, creation time, requested departure and expected return date/time, guardian contact, comments or exceptional circumstances." },
  { kind: "functional", title: "Approve / reject exeat", description: "Authorised staff approve or reject requests per school-configured permissions, recording approver, decision and timestamps. Routine approvals must not be cumbersome." },
  { kind: "functional", title: "Exeat status model", description: "Statuses: pending, approved, rejected, departed, overdue, returned, returned late, cancelled, expired without use, closed exceptionally, with validated transitions.", acceptanceCriteria: ["Invalid state transitions are rejected by the server"] },
  { kind: "functional", title: "Gate lookup", description: "Security officer finds a student by QR scan (device camera) or manual student ID entry and sees the current exeat status (online verification)." },
  { kind: "functional", title: "Record departure", description: "Security officer confirms actual departure and the time is recorded, only when an approved exeat exists. Duplicate or unauthorised gate actions are prevented." },
  { kind: "functional", title: "Record return", description: "Security officer confirms return and the time is recorded; late returns are flagged." },
  { kind: "functional", title: "Gate warnings", description: "Warnings for rejected, unapproved, cancelled, expired or overdue requests, and a way to record exceptional situations per configured rules." },
  { kind: "functional", title: "Overdue detection", description: "A scheduled job identifies students past their expected return time without a recorded return. It must not depend on anyone opening a dashboard; it must be idempotent, avoid duplicate notifications, and retry transient failures." },
  { kind: "functional", title: "SMS notifications", description: "Configurable SMS for approval/rejection, departure confirmation, overdue notification per policy, return confirmation, and relevant cancellation or exceptional changes. Message status recorded where the provider supports it (queued, sent, delivered, failed, retrying); failures can be retried; refreshing a dashboard never re-sends." },
  { kind: "functional", title: "Event history", description: "Important events (approvals, rejections, departures, returns, cancellations, administrative changes) are kept as history and never silently overwritten." },
  { kind: "functional", title: "Headmaster dashboard", description: "Total students, pending and approved exeats, students currently away, overdue returns, returned, recent gate activity, recent approvals/rejections, staff activity, historical reports with date filters and export." },
  { kind: "functional", title: "Gate dashboard", description: "Gate-focused, fast, readable and mobile-first, without complex reports." },
  { kind: "functional", title: "Exeat officer dashboard", description: "Prioritises request creation, review and approval." },
  { kind: "functional", title: "School service and maintenance charges", description: "Platform administrator configures per-school services, billing periods, amounts, currency, renewal dates, maintenance and other recurring fees, marked estimated or confirmed. The headmaster dashboard shows the applicable charges and calculated totals read-only. No online payment collection." },
  { kind: "non_functional", title: "Mobile-first gate UI", description: "Gate screens are optimised for speed and readability on phones." },
  { kind: "non_functional", title: "Reliability of background jobs", description: "Scheduled jobs are idempotent, retried on transient failure, and observable." },
  { kind: "non_functional", title: "Auditability", description: "Significant actions are recorded in an append-only history." },
  { kind: "non_functional", title: "Internet dependency", description: "Version one requires internet access for gate operations. Offline operation is out of scope." },
  { kind: "security", title: "Server-side tenant isolation", description: "Tenant authorisation is enforced on the server and with database constraints, not only by hiding navigation.", priority: "must" },
  { kind: "security", title: "Authentication and sessions", description: "Secure authentication and session management for staff accounts." },
  { kind: "security", title: "Minimal data in QR codes", description: "QR codes contain an identifier only." },
  { kind: "security", title: "Protection of personal data", description: "Student, guardian and photo data is accessible only to authorised roles; sensitive access by platform administrators is limited and audited." },
  { kind: "integration", title: "Ghana-compatible SMS provider", description: "Integrate one SMS provider after verifying current Ghana coverage, pricing, sender ID requirements, delivery reports and API capabilities. No delivery guarantees are promised." },
  { kind: "reporting", title: "Reports and exports", description: "Date-filtered historical reports and exportable records." },
];

export const SRS_BODIES: Record<string, string> = {
  user_roles: "- **Platform Super Administrator**: onboards schools, configures services and charges, administers the platform.\n- **Headmaster / School Administrator**: manages school profile, staff, permissions, exeat settings, students, guardians, reports and dashboard.\n- **Exeat Officer / Authorised Staff**: creates requests on behalf of students and approves or rejects per configured permissions.\n- **Security / Gate Officer**: searches students, scans QR codes, verifies status online, records departure and return.\n\nParents/guardians and students have no accounts in version one. Guardians are contacted by SMS.",
  workflows: "1. Staff create an exeat request on behalf of a student.\n2. An authorised approver approves or rejects it.\n3. At the gate, the officer verifies the student and records actual departure.\n4. On return, the officer records actual return.\n5. If the expected return time passes with no return, the scheduled job marks it overdue and notifies per policy.",
  delivery_handover: "Delivery as the agreed complete initial version. Milestone demonstrations are used for feedback without changing contractual scope. Handover includes deployment, acceptance and documentation.",
  change_management: "Work outside the approved scope is recorded, described, estimated (cost and timeline impact), issued as a change proposal, and implemented only after approval.",
  security_privacy: "- Server-side tenant isolation and role-based access control\n- QR codes carry an identifier only and never authorise by themselves\n- Limited, audited platform-administrator access to school records",
  risks: "- SMS provider coverage, pricing and delivery behaviour in Ghana must be verified\n- Gate operations depend on internet availability\n- Third-party provider price changes affect recurring costs",
};

export const SERVICES = [
  { name: "Domain registration", category: "Domain", payInActivation: true, recurring: true },
  { name: "Web application hosting", category: "Hosting", payInActivation: true, recurring: true },
  { name: "Database hosting", category: "Hosting", payInActivation: true, recurring: true },
  { name: "Image and file storage", category: "Storage", payInActivation: true, recurring: true },
  { name: "SMS gateway", category: "Messaging", payInActivation: true, recurring: true },
  { name: "Email delivery service", category: "Messaging", payInActivation: true, recurring: true },
];
