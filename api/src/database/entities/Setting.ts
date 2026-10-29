import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("settings")
export class Setting {
  @PrimaryColumn({ type: "varchar", length: 64 }) key!: string;
  @Column({ type: "jsonb" }) value!: Record<string, unknown>;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
