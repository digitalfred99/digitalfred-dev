import { Column, Entity, Index } from "typeorm";
import { AppBaseEntity, bigintNumber } from "./BaseEntity";

/** Tracks payment of schedule instalments from an ACCEPTED version. Recording a payment here is bookkeeping only; no payment is processed. */
@Entity("payment_records")
@Index("IDX_payments_proposal", ["proposalId"])
@Index("UQ_payment_item", ["versionId", "itemKey"], { unique: true })
export class PaymentRecord extends AppBaseEntity {
  @Column({ type: "uuid" }) proposalId!: string;
  @Column({ type: "uuid" }) versionId!: string;
  /** Payment-schedule item id, or "activation" for the initial external-service costs. */
  @Column({ type: "varchar", length: 64 }) itemKey!: string;
  @Column({ type: "varchar", length: 255 }) label!: string;
  @Column({ type: "bigint", nullable: true, transformer: bigintNumber }) amountMinor!: number | null;
  @Column({ type: "varchar", length: 3 }) currency!: string;
  @Column({ type: "date", nullable: true }) dueDate!: string | null;
  @Column({ type: "varchar", length: 12, default: "pending" }) status!: "pending" | "paid" | "waived";
  @Column({ type: "timestamptz", nullable: true }) paidAt!: Date | null;
  @Column({ type: "varchar", length: 120, nullable: true }) paymentReference!: string | null;
  @Column({ type: "text", nullable: true }) notes!: string | null;
}
