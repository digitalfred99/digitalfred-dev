import { Column, Entity, Index } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";

// Single-owner system: normally exactly one row, created by `npm run seed:admin`.
@Entity("users")
@Index("UQ_users_email", ["email"], { unique: true })
export class User extends AppBaseEntity {
  @Column({ type: "varchar", length: 255 }) firstName!: string;
  @Column({ type: "varchar", length: 255 }) lastName!: string;
  @Column({ type: "varchar", length: 255 }) email!: string;
  @Column({ name: "password_hash", type: "varchar", length: 255 }) passwordHash!: string;
  @Column({ type: "boolean", default: true }) isActive!: boolean;
  /** Bumped on password change: invalidates every issued token. */
  @Column({ type: "int", default: 0 }) tokenVersion!: number;
  @Column({ type: "int", default: 0 }) failedLogins!: number;
  @Column({ type: "timestamptz", nullable: true }) lockedUntil!: Date | null;
}
