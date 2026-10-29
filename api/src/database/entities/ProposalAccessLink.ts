import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** Secure client link. Only the SHA-256 hash of the token is stored. */
@Entity("proposal_access_links")
@Index("UQ_link_token_hash", ["tokenHash"], { unique: true })
@Index("IDX_link_proposal", ["proposalId"])
export class ProposalAccessLink {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) proposalId!: string;
  @Column({ type: "char", length: 64 }) tokenHash!: string;
  @Column({ type: "timestamptz", nullable: true }) expiresAt!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) revokedAt!: Date | null;
  @Column({ type: "timestamptz", nullable: true }) lastViewedAt!: Date | null;
  @Column({ type: "int", default: 0 }) viewCount!: number;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
