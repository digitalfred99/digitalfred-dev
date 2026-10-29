import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { Client } from "./Client";

export const PROJECT_STATUSES = ["draft", "requirements", "proposal", "agreed", "in_development", "delivered", "warranty", "maintenance", "closed", "cancelled"] as const;

export interface ProjectLists {
  objectives: string[]; targetUsers: string[]; technologyStack: string[]; assumptions: string[]; dependencies: string[];
  constraints: string[]; deliverables: string[]; exclusions: string[]; futureEnhancements: string[];
}
export interface ProjectTerms { warranty: string; ownership: string; maintenance: string; support: string }

// Commercial figures (implementation fee, services, maintenance) deliberately live on the PROPOSAL,
// not here, so there is one source of truth and published prices can never drift.
@Entity("projects")
@Index("UQ_projects_identifier", ["identifier"], { unique: true, where: '"isDeleted" = false' })
export class Project extends AppBaseEntity {
  @Column({ type: "uuid", nullable: true }) clientId!: string | null;
  @ManyToOne(() => Client, { nullable: true, onDelete: "RESTRICT" }) @JoinColumn({ name: "clientId" }) client?: Relation<Client> | null;
  @Column({ type: "varchar", length: 255 }) name!: string;
  @Column({ type: "varchar", length: 64 }) identifier!: string;
  @Column({ type: "varchar", length: 30, default: "draft" }) status!: (typeof PROJECT_STATUSES)[number];
  @Column({ type: "text", default: "" }) description!: string;
  @Column({ type: "text", default: "" }) businessProblem!: string;
  @Column({ type: "text", default: "" }) proposedSolution!: string;
  @Column({ type: "text", default: "" }) scope!: string;
  @Column({ type: "jsonb", default: () => "'{}'" }) lists!: Partial<ProjectLists>;
  @Column({ type: "jsonb", default: () => "'{}'" }) terms!: Partial<ProjectTerms>;
  @Column({ type: "text", default: "" }) timelineNotes!: string;
  @Column({ type: "date", nullable: true }) startDate!: string | null;
  @Column({ type: "date", nullable: true }) targetDate!: string | null;
}
