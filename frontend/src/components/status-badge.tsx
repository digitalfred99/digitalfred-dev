import type { ProposalStatus } from "@/types/api";

const STATUS: Record<ProposalStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  ready_for_review: { label: "Ready for review", tone: "blue" },
  sent: { label: "Sent", tone: "blue" },
  viewed: { label: "Viewed", tone: "blue" },
  clarification_requested: { label: "Clarification", tone: "amber" },
  negotiation_requested: { label: "Negotiation", tone: "amber" },
  revision_in_progress: { label: "Revision in progress", tone: "amber" },
  revised_sent: { label: "Revised", tone: "blue" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Declined", tone: "red" },
  expired: { label: "Expired", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export function StatusBadge({ status }: { status: ProposalStatus | string }) {
  const value = STATUS[status as ProposalStatus] ?? { label: status.replaceAll("_", " "), tone: "neutral" };
  return <span className={`badge badge-${value.tone}`}>{value.label}</span>;
}
