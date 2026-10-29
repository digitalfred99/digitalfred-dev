import { Column, Entity, Index, JoinColumn, OneToOne, type Relation, UpdateDateColumn, CreateDateColumn, PrimaryGeneratedColumn } from "typeorm";
import type { Section } from "../../lib/proposals/content";
import { Project } from "./Project";

/** The editable working copy of a project's requirements document (one per project). */
@Entity("srs_documents")
@Index("UQ_srs_project", ["projectId"], { unique: true })
export class SrsDocument {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) projectId!: string;
  @OneToOne(() => Project, { onDelete: "CASCADE" }) @JoinColumn({ name: "projectId" }) project?: Relation<Project>;
  @Column({ type: "varchar", length: 255 }) title!: string;
  @Column({ type: "jsonb", default: () => "'[]'" }) sections!: Section[];
  /** Optimistic-concurrency counter: a save with a stale revision is rejected, so nothing is silently overwritten. */
  @Column({ type: "int", default: 1 }) revision!: number;
  @Column({ type: "varchar", length: 20, default: "draft" }) status!: "draft" | "in_review" | "approved";
  @Column({ type: "varchar", length: 20, default: "not_shared" }) clientReviewStatus!: "not_shared" | "shared" | "changes_requested" | "approved";
  @Column({ type: "varchar", length: 20, nullable: true }) latestVersionLabel!: string | null;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
