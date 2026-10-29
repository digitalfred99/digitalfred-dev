export const PROPOSAL_STATUSES = [
  "draft", "ready_for_review", "sent", "viewed", "clarification_requested", "negotiation_requested",
  "revision_in_progress", "revised_sent", "accepted", "rejected", "expired", "withdrawn",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** States in which the client has a live, published version in front of them. */
export const CLIENT_OPEN: ProposalStatus[] = ["sent", "viewed", "clarification_requested", "negotiation_requested", "revised_sent"];

const TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["ready_for_review", "sent", "withdrawn"],
  ready_for_review: ["draft", "sent", "withdrawn"],
  sent: ["viewed", "clarification_requested", "negotiation_requested", "accepted", "rejected", "expired", "withdrawn", "revision_in_progress"],
  viewed: ["clarification_requested", "negotiation_requested", "accepted", "rejected", "expired", "withdrawn", "revision_in_progress"],
  clarification_requested: ["viewed", "negotiation_requested", "revision_in_progress", "accepted", "rejected", "expired", "withdrawn"],
  negotiation_requested: ["viewed", "clarification_requested", "revision_in_progress", "accepted", "rejected", "expired", "withdrawn"],
  revision_in_progress: ["revised_sent", "withdrawn"],
  revised_sent: ["viewed", "clarification_requested", "negotiation_requested", "accepted", "rejected", "expired", "withdrawn", "revision_in_progress"],
  // Accepted and withdrawn are final. Changes after acceptance are made as an AMENDMENT (a new proposal).
  accepted: [],
  withdrawn: [],
  // Expired / rejected proposals may be re-opened for a fresh revision.
  expired: ["revision_in_progress"],
  rejected: ["revision_in_progress"],
};

export const canTransition = (from: ProposalStatus, to: ProposalStatus) => TRANSITIONS[from]?.includes(to) ?? false;
export const allowedTransitions = (from: ProposalStatus) => [...(TRANSITIONS[from] ?? [])];
/** The draft may only be edited while it is not live in front of the client. */
export const isDraftEditable = (s: ProposalStatus) => s === "draft" || s === "ready_for_review" || s === "revision_in_progress";
export const isClientOpen = (s: ProposalStatus) => CLIENT_OPEN.includes(s);
export const isFinal = (s: ProposalStatus) => s === "accepted" || s === "withdrawn";
