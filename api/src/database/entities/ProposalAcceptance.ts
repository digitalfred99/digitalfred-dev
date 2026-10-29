import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** Immutable record of who accepted exactly which version. One per version. UPDATE/DELETE blocked by trigger. */
@Entity("proposal_acceptances")
@Index("UQ_acceptance_version", ["versionId"], { unique: true })
export class ProposalAcceptance {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) proposalId!: string;
  @Column({ type: "uuid" }) versionId!: string;
  @Column({ type: "varchar", length: 20 }) versionLabel!: string;
  @Column({ type: "varchar", length: 40 }) proposalReference!: string;
  @Column({ type: "char", length: 64 }) contentHash!: string;
  @Column({ type: "varchar", length: 255 }) acceptedByName!: string;
  @Column({ type: "varchar", length: 255 }) acceptedByEmail!: string;
  @Column({ type: "varchar", length: 255, nullable: true }) acceptedByTitle!: string | null;
  @Column({ type: "varchar", length: 255, nullable: true }) organization!: string | null;
  /** The exact wording the client agreed to. */
  @Column({ type: "text" }) statement!: string;
  @Column({ type: "varchar", length: 40, default: "web_acknowledgment" }) method!: string;
  @Column({ type: "varchar", length: 64, nullable: true }) ipAddress!: string | null;
  @Column({ type: "text", nullable: true }) userAgent!: string | null;
  @Column({ type: "uuid", nullable: true }) accessLinkId!: string | null;
  @CreateDateColumn({ type: "timestamptz" }) acceptedAt!: Date;
}
