import { Column, Entity, Index } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";

@Entity("clients")
@Index("IDX_clients_name", ["displayName"])
export class Client extends AppBaseEntity {
  @Column({ type: "varchar", length: 20, default: "organization" }) type!: "individual" | "organization";
  /** Organisation name, or the person's name for individuals. Shown in lists. */
  @Column({ type: "varchar", length: 255 }) displayName!: string;
  @Column({ type: "varchar", length: 255, nullable: true }) organizationName!: string | null;
  @Column({ type: "varchar", length: 255 }) contactName!: string;
  @Column({ type: "varchar", length: 255 }) email!: string;
  @Column({ type: "varchar", length: 40, nullable: true }) phone!: string | null;
  @Column({ type: "varchar", length: 100, default: "Ghana" }) country!: string;
  @Column({ type: "varchar", length: 3, default: "GHS" }) preferredCurrency!: string;
  @Column({ type: "text", nullable: true }) billingAddress!: string | null;
  /** Free text entered by you (e.g. tax ID). Never invented by the system. */
  @Column({ type: "varchar", length: 120, nullable: true }) taxId!: string | null;
  /** Internal only. Never exposed to the client portal. */
  @Column({ type: "text", nullable: true }) internalNotes!: string | null;
}
