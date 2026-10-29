import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import { Project } from "./Project";

@Entity("milestones")
@Index("IDX_milestones_due", ["dueDate"])
export class Milestone extends AppBaseEntity {
  @Column({ type: "uuid" }) projectId!: string;
  @ManyToOne(() => Project, { onDelete: "CASCADE" }) @JoinColumn({ name: "projectId" }) project?: Relation<Project>;
  @Column({ type: "varchar", length: 255 }) title!: string;
  @Column({ type: "text", default: "" }) description!: string;
  @Column({ type: "date", nullable: true }) dueDate!: string | null;
  @Column({ type: "varchar", length: 20, default: "planned" }) status!: "planned" | "in_progress" | "completed" | "delayed";
  @Column({ type: "int", default: 0 }) sortOrder!: number;
}
