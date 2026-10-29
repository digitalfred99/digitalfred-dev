import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** What the client was shown, frozen. UPDATE/DELETE are blocked by a database trigger. */
@Entity("proposal_versions")
@Index("UQ_proposal_version", ["proposalId", "major", "minor"], { unique: true })
export class ProposalVersion {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) proposalId!: string;
  @Column({ type: "int" }) major!: number;
  @Column({ type: "int" }) minor!: number;
  @Column({ type: "varchar", length: 20 }) label!: string;
  /** Client-safe snapshot: sections, pricing inputs + computed totals, client/project/business details, attached SRS. */
  @Column({ type: "jsonb" }) content!: Record<string, unknown>;
  @Column({ type: "char", length: 64 }) contentHash!: string;
  @Column({ type: "text", default: "" }) changeNote!: string;
  @Column({ type: "timestamptz", nullable: true }) validUntil!: Date | null;
  @CreateDateColumn({ type: "timestamptz" }) publishedAt!: Date;
}
