import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { Client } from "./Client";
import { Project } from "./Project";
import type { ProposalDraft } from "../../lib/proposals/content";
import type { ProposalStatus } from "../../lib/proposals/stateMachine";

@Entity("proposals")
@Index("UQ_proposals_reference", ["reference"], { unique: true })
@Index("IDX_proposals_status", ["status"])
export class Proposal extends AppBaseEntity {
  @Column({ type: "varchar", length: 40 }) reference!: string;
  /** "amendment" proposals change an ACCEPTED proposal and reference it via parentProposalId. */
  @Column({ type: "varchar", length: 20, default: "proposal" }) kind!: "proposal" | "amendment";
  @Column({ type: "uuid", nullable: true }) parentProposalId!: string | null;
  @Column({ type: "uuid" }) projectId!: string;
  @ManyToOne(() => Project, { onDelete: "RESTRICT" }) @JoinColumn({ name: "projectId" }) project?: Relation<Project>;
  @Column({ type: "uuid", nullable: true }) clientId!: string | null;
  @ManyToOne(() => Client, { nullable: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "clientId" }) client?: Relation<Client> | null;
  @Column({ type: "varchar", length: 255 }) title!: string;
  @Column({ type: "varchar", length: 3 }) currency!: string;
  @Column({ type: "varchar", length: 30, default: "draft" }) status!: ProposalStatus;
  /** Working copy. Becomes an immutable ProposalVersion only when published. */
  @Column({ type: "jsonb" }) draft!: ProposalDraft;
  @Column({ type: "int", default: 1 }) draftRevision!: number;
  @Column({ type: "int", nullable: true }) validityDays!: number | null;
  @Column({ type: "uuid", nullable: true }) latestVersionId!: string | null;
  @Column({ type: "varchar", length: 20, nullable: true }) latestVersionLabel!: string | null;
  @Column({ type: "timestamptz", nullable: true }) validUntil!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) sentAt!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) acceptedAt!: Date | null;
}
