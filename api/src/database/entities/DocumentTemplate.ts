import { Column, Entity } from "typeorm";
import { AppBaseEntity } from "./BaseEntity";

export const TEMPLATE_KINDS = ["srs", "proposal", "contract", "change_request", "handover_checklist"] as const;

@Entity("document_templates")
export class DocumentTemplate extends AppBaseEntity {
  @Column({ type: "varchar", length: 30 }) kind!: (typeof TEMPLATE_KINDS)[number];
  @Column({ type: "varchar", length: 200 }) name!: string;
  @Column({ type: "jsonb", default: () => "'[]'" }) sections!: { key: string; title: string; body: string }[];
  @Column({ type: "boolean", default: false }) isDefault!: boolean;
}
