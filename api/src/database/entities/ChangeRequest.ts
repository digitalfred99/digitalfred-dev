import { Column, Entity, Index } from "typeorm";
import { AppBaseEntity, bigintNumber } from "./BaseEntity";

@Entity("change_requests")
@Index("IDX_cr_project", ["projectId"])
export class ChangeRequest extends AppBaseEntity {
  @Column({ type: "uuid" }) projectId!: string;
  /** Amendment proposal that carries the quote for this change, once issued. */
  @Column({ type: "uuid", nullable: true }) amendmentProposalId!: string | null;
  @Column({ type: "varchar", length: 255 }) title!: string;
  @Column({ type: "text" }) description!: string;
  @Column({ type: "varchar", length: 255, default: "" }) requestedBy!: string;
  @Column({ type: "text", default: "" }) additionalWork!: string;
  @Column({ type: "bigint", nullable: true, transformer: bigintNumber }) estimateMinor!: number | null;
  @Column({ type: "varchar", length: 3, default: "GHS" }) currency!: string;
  @Column({ type: "text", default: "" }) timelineImpact!: string;
  @Column({ type: "varchar", length: 20, default: "draft" }) status!: "draft" | "proposed" | "approved" | "rejected" | "implemented";
}
