import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Append-only (enforced by a database trigger in the immutability migration).
@Entity("audit_logs")
@Index("IDX_audit_entity", ["entityType", "entityId"])
@Index("IDX_audit_created", ["createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid") id!: string;
  /** null for client (public portal) actions. */
  @Column({ type: "uuid", nullable: true }) actorUserId!: string | null;
  @Column({ type: "varchar", length: 20, default: "admin" }) actorType!: "admin" | "client" | "system";
  @Column({ type: "varchar", length: 80 }) action!: string;
  @Column({ type: "varchar", length: 60 }) entityType!: string;
  @Column({ type: "varchar", length: 64, nullable: true }) entityId!: string | null;
  @Column({ type: "jsonb", nullable: true }) metadata!: Record<string, unknown> | null;
  @Column({ type: "varchar", length: 64, nullable: true }) ipAddress!: string | null;
  @Column({ type: "text", nullable: true }) userAgent!: string | null;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
