import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { Section } from "../../lib/proposals/content";

export interface SrsRequirementSnapshot { code: string; kind: string; title: string; description: string; priority: string; dependencies: string[]; acceptanceCriteria: string[] }

/** Immutable snapshot (UPDATE/DELETE blocked by a database trigger). */
@Entity("srs_versions")
@Index("UQ_srs_version", ["documentId", "major", "minor"], { unique: true })
export class SrsVersion {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) documentId!: string;
  @Column({ type: "uuid" }) projectId!: string;
  @Column({ type: "int" }) major!: number;
  @Column({ type: "int" }) minor!: number;
  @Column({ type: "varchar", length: 20 }) label!: string;
  @Column({ type: "varchar", length: 255 }) title!: string;
  @Column({ type: "jsonb" }) sections!: Section[];
  @Column({ type: "jsonb" }) requirements!: SrsRequirementSnapshot[];
  @Column({ type: "char", length: 64 }) contentHash!: string;
  @Column({ type: "text", default: "" }) note!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
