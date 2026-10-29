import { Column, Entity } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";
import type { ServiceOption } from "../../lib/pricing/types";

/** Reusable external-service definitions (domain, hosting, SMS...). Prices here are templates you confirm per proposal. */
@Entity("service_catalog")
export class ServiceCatalogItem extends AppBaseEntity {
  @Column({ type: "varchar", length: 200 }) name!: string;
  @Column({ type: "varchar", length: 200, default: "" }) provider!: string;
  @Column({ type: "varchar", length: 100, default: "" }) category!: string;
  @Column({ type: "text", default: "" }) description!: string;
  @Column({ type: "jsonb", default: () => "'[]'" }) options!: ServiceOption[];
  @Column({ type: "text", default: "" }) notes!: string;
  @Column({ type: "boolean", default: true }) isActive!: boolean;
}
