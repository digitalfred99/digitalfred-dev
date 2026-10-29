import { AppDataSource } from "@/database/data-source";
import { PaymentRecord } from "@/database/entities/PaymentRecord";
import { audit } from "@/lib/audit/audit";
import { notFound } from "@/lib/errors/appErrors";
import { isoDate, obj, oneOf, str, uuid } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };

export class PaymentsService {
  static async list(q: URLSearchParams) {
    const qb = (await AppDataSource()).getRepository(PaymentRecord).createQueryBuilder("p").where("p.isDeleted = false");
    if (q.get("proposalId")) qb.andWhere("p.proposalId = :pid", { pid: uuid(q.get("proposalId"), "proposalId") });
    if (q.get("status")) qb.andWhere("p.status = :st", { st: oneOf(q.get("status"), "status", ["pending", "paid", "waived"] as const) });
    const rows = await qb.orderBy("p.dueDate", "ASC", "NULLS LAST").addOrderBy("p.createdAt", "ASC").getMany();
    const today = new Date().toISOString().slice(0, 10);
    return rows.map((r) => ({ ...r, overdue: r.status === "pending" && !!r.dueDate && r.dueDate < today }));
  }

  /** Records that you received (or waived) a payment. The agreed amount and label come from the accepted version and cannot be edited. */
  static async update(id: string, raw: unknown, a: Actor) {
    uuid(id);
    const b = obj(raw);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(PaymentRecord).findOne({ where: { id, isDeleted: false } });
      if (!r) throw notFound("Payment");
      if (b.status !== undefined) { r.status = oneOf(b.status, "status", ["pending", "paid", "waived"] as const); r.paidAt = r.status === "paid" ? new Date() : null; }
      if (b.dueDate !== undefined) r.dueDate = isoDate(b.dueDate, "dueDate");
      if (b.paymentReference !== undefined) r.paymentReference = b.paymentReference ? str(b.paymentReference, "paymentReference", { max: 120 }) : null;
      if (b.notes !== undefined) r.notes = b.notes ? str(b.notes, "notes", { max: 5000 }) : null;
      const saved = await m.getRepository(PaymentRecord).save(r);
      await audit({ action: "payment.updated", entityType: "payment", entityId: id, metadata: { status: saved.status }, actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent }, m);
      return saved;
    });
  }
}
