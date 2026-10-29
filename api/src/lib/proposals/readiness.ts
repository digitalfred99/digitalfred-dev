import { computePricing } from "../pricing/engine";
import type { PricingIssue } from "../pricing/types";
import type { ProposalDraft } from "./content";

export interface ReadinessInput {
  title: string; hasClient: boolean; hasProject: boolean; validityDays: number | null;
  draft: ProposalDraft; srsRequirementCount: number | null; // null = SRS not attached
}
export interface ReadinessReport { canPublish: boolean; blockers: PricingIssue[]; warnings: PricingIssue[] }

const filled = (d: ProposalDraft, key: string) => d.sections.some((s) => s.key === key && s.clientVisible && s.body.trim().length > 0);

export function checkReadiness(i: ReadinessInput): ReadinessReport {
  const issues: PricingIssue[] = [...computePricing(i.draft.pricing).issues];
  const add = (code: string, severity: "blocker" | "warning", message: string) => issues.push({ code, severity, message });

  if (!i.title.trim()) add("title_missing", "blocker", "The proposal needs a title.");
  if (!i.hasClient) add("client_missing", "blocker", "No client is attached to this proposal.");
  if (!i.hasProject) add("project_missing", "blocker", "No project is attached to this proposal.");
  if (!filled(i.draft, "scope")) add("scope_missing", "blocker", "Project scope is empty.");
  if (!filled(i.draft, "deliverables")) add("deliverables_missing", "blocker", "Deliverables are empty.");
  if (!filled(i.draft, "exclusions")) add("exclusions_missing", "warning", "No exclusions are listed. Clients may assume everything is included.");
  if (!filled(i.draft, "warranty")) add("warranty_missing", "warning", "Warranty terms are not specified.");
  if (!filled(i.draft, "ip_ownership")) add("ip_missing", "warning", "Ownership and intellectual property terms are not specified.");
  if (!filled(i.draft, "timeline")) add("timeline_missing", "warning", "Timeline is empty.");
  if (!filled(i.draft, "acceptance_criteria")) add("acceptance_criteria_missing", "warning", "Acceptance criteria are empty.");
  if (!filled(i.draft, "change_requests")) add("change_policy_missing", "warning", "Change request policy is empty.");
  if (!i.validityDays || i.validityDays < 1) add("validity_missing", "warning", "No validity period is set; the proposal will not expire.");
  if (i.srsRequirementCount === null) add("srs_not_attached", "warning", "No requirements document is attached to this proposal.");
  else if (i.srsRequirementCount === 0) add("srs_no_requirements", "warning", "The attached requirements document has no itemised requirements.");

  const blockers = issues.filter((x) => x.severity === "blocker");
  return { canPublish: blockers.length === 0, blockers, warnings: issues.filter((x) => x.severity === "warning") };
}
