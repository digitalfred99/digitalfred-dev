import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { Project } from "./Project";

export const REQUIREMENT_KINDS = ["functional", "non_functional", "security", "data", "integration", "reporting"] as const;
export const REQUIREMENT_PREFIX: Record<(typeof REQUIREMENT_KINDS)[number], string> = {
  functional: "FR", non_functional: "NFR", security: "SEC", data: "DR", integration: "INT", reporting: "RPT",
};

@Entity("requirements")
@Index("UQ_requirements_code", ["projectId", "code"], { unique: true, where: '"isDeleted" = false' })
export class Requirement extends AppBaseEntity {
  @Column({ type: "uuid" }) projectId!: string;
  @ManyToOne(() => Project, { onDelete: "CASCADE" }) @JoinColumn({ name: "projectId" }) project?: Relation<Project>;
  @Column({ type: "varchar", length: 20 }) kind!: (typeof REQUIREMENT_KINDS)[number];
  @Column({ type: "varchar", length: 20 }) code!: string; // FR-001
  @Column({ type: "varchar", length: 255 }) title!: string;
  @Column({ type: "text", default: "" }) description!: string;
  @Column({ type: "varchar", length: 10, default: "must" }) priority!: "must" | "should" | "could" | "wont";
  @Column({ type: "jsonb", default: () => "'[]'" }) dependencies!: string[]; // requirement codes
  @Column({ type: "jsonb", default: () => "'[]'" }) acceptanceCriteria!: string[];
  @Column({ type: "varchar", length: 12, default: "draft" }) status!: "draft" | "confirmed";
  @Column({ type: "int", default: 0 }) sortOrder!: number;
}
