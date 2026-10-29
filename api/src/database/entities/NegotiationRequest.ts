import { Column, Entity, Index } from "typeorm";
import { AppBaseEntity, bigintNumber } from "./BaseEntity";

export const NEGOTIATION_KINDS = ["clarification", "scope_change", "price_change", "payment_term_change", "service_selection", "general"] as const;
export const NEGOTIATION_STATUSES = ["open", "answered", "agreed", "declined", "countered", "closed"] as const;

/** A client REQUEST. It never changes the contract: only a newly published version does. */
@Entity("negotiation_requests")
@Index("IDX_neg_proposal", ["proposalId"])
@Index("IDX_neg_status", ["status"])
export class NegotiationRequest extends AppBaseEntity {
  @Column({ type: "uuid" }) proposalId!: string;
  @Column({ type: "uuid" }) versionId!: string;
  @Column({ type: "varchar", length: 20 }) versionLabel!: string;
  @Column({ type: "varchar", length: 30 }) kind!: (typeof NEGOTIATION_KINDS)[number];
  @Column({ type: "varchar", length: 20, default: "open" }) status!: (typeof NEGOTIATION_STATUSES)[number];
  @Column({ type: "varchar", length: 255 }) subject!: string;
  @Column({ type: "text" }) message!: string;
  @Column({ type: "text", nullable: true }) reason!: string | null;
  @Column({ type: "bigint", nullable: true, transformer: bigintNumber }) proposedBudgetMinor!: number | null;
  @Column({ type: "text", nullable: true }) proposedPaymentTerms!: string | null;
  /** For service_selection: [{ itemType, itemId, optionId }] plus the provisional totals the client was shown. */
  @Column({ type: "jsonb", nullable: true }) selections!: Record<string, unknown> | null;
  @Column({ type: "varchar", length: 255 }) submittedByName!: string;
  @Column({ type: "varchar", length: 255 }) submittedByEmail!: string;
  @Column({ type: "text", nullable: true }) resolutionNote!: string | null; // client-visible
  @Column({ type: "timestamptz", nullable: true }) resolvedAt!: Date | null;
}
