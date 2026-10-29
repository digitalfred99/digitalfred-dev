import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export abstract class AppBaseEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
  @Column({ type: "boolean", default: false }) isDeleted!: boolean;
}

/** bigint <-> number (money is integer minor units; always far below 2^53). */
export const bigintNumber = {
  to: (v?: number | null) => (v === undefined ? null : v),
  from: (v: string | null) => (v === null || v === undefined ? null : Number(v)),
};
