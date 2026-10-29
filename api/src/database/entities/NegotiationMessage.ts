import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("negotiation_messages")
@Index("IDX_negmsg_request", ["requestId", "createdAt"])
export class NegotiationMessage {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) requestId!: string;
  @Column({ type: "varchar", length: 10 }) author!: "client" | "developer";
  /** "internal" = private note. Public portal queries MUST filter visibility = 'client'. */
  @Column({ type: "varchar", length: 10 }) visibility!: "client" | "internal";
  @Column({ type: "text" }) body!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
}
