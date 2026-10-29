import { randomUUID } from "node:crypto";
import { bool, obj, str, ValidationError } from "../validation/v";

export interface Section { id: string; key: string; title: string; body: string; clientVisible: boolean }

/** STRUCTURE ONLY: section titles. No prices, terms or business claims are hardcoded here. */
export const DEFAULT_PROPOSAL_SECTIONS: { key: string; title: string }[] = [
  ["executive_summary", "Executive summary"], ["business_problem", "Business problem"], ["proposed_solution", "Proposed solution"],
  ["scope", "Project scope"], ["deliverables", "Deliverables"], ["exclusions", "Exclusions (out of scope)"],
  ["future_enhancements", "Future enhancements"], ["approach", "Development approach"], ["technology", "Technology overview"],
  ["security", "Security considerations"], ["deployment", "Deployment approach"], ["timeline", "Timeline and milestones"],
  ["client_responsibilities", "Client responsibilities"], ["developer_responsibilities", "Developer responsibilities"],
  ["acceptance_criteria", "Acceptance criteria"], ["ip_ownership", "Intellectual property and ownership"], ["confidentiality", "Confidentiality"],
  ["warranty", "Warranty terms"], ["support", "Support terms"], ["change_requests", "Change request policy"],
  ["termination", "Cancellation and termination"], ["validity", "Proposal validity"], ["acceptance_instructions", "How to accept this proposal"],
].map(([key, title]) => ({ key, title }));

export const DEFAULT_SRS_SECTIONS: { key: string; title: string }[] = [
  ["document_information", "Document information"], ["overview", "Project overview"], ["background", "Background and problem statement"],
  ["business_objectives", "Business objectives"], ["proposed_solution", "Proposed solution"], ["stakeholders", "Stakeholders"],
  ["user_roles", "User roles and permissions"], ["functional", "Functional requirements"], ["non_functional", "Non-functional requirements"],
  ["security_privacy", "Security and privacy requirements"], ["data", "Data requirements"], ["workflows", "User workflows"],
  ["integrations", "Integrations"], ["infrastructure", "Infrastructure and hosting"], ["reporting", "Reporting requirements"],
  ["assumptions", "Assumptions"], ["constraints", "Constraints"], ["dependencies", "Dependencies"], ["acceptance", "Acceptance criteria"],
  ["out_of_scope", "Out-of-scope features"], ["future", "Future enhancements"], ["risks", "Risks"],
  ["delivery_handover", "Delivery and handover requirements"], ["change_management", "Change management"],
].map(([key, title]) => ({ key, title }));

export const makeSections = (defs: { key: string; title: string; body?: string }[]): Section[] =>
  defs.map((d) => ({ id: randomUUID(), key: d.key, title: d.title, body: d.body ?? "", clientVisible: true }));

export function sanitizeSections(raw: unknown, f = "sections"): Section[] {
  if (!Array.isArray(raw)) throw new ValidationError(`${f}: must be a list`, f);
  if (raw.length > 80) throw new ValidationError(`${f}: too many sections`, f);
  const seen = new Set<string>();
  return raw.map((x, i) => {
    const s = obj(x, `${f}[${i}]`);
    let id = typeof s.id === "string" && s.id.length <= 64 ? s.id : randomUUID();
    if (seen.has(id)) id = randomUUID();
    seen.add(id);
    return {
      id, key: str(s.key ?? "custom", "key", { max: 64 }), title: str(s.title, "title", { max: 200 }),
      body: str(s.body, "body", { optional: true, max: 60000, trim: false }), clientVisible: bool(s.clientVisible, "clientVisible", true),
    };
  });
}

export interface ProposalDraft {
  sections: Section[];
  pricing: import("../pricing/types").PricingInput;
  attachSrs: boolean;
  /** Admin-only. Never copied into a published snapshot. */
  internalNotes: string;
}
