import { Column, Entity, PrimaryColumn } from "typeorm";

/** Atomic sequence numbers (proposal references etc.). Incremented with a single upsert. */
@Entity("counters")
export class Counter {
  @PrimaryColumn({ type: "varchar", length: 64 }) key!: string;
  @Column({ type: "int", default: 0 }) value!: number;
}
