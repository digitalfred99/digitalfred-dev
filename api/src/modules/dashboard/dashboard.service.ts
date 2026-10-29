import { AppDataSource } from "@/database/data-source";
import { AuditLog } from "@/database/entities/AuditLog";
import { Client } from "@/database/entities/Client";
import { Milestone } from "@/database/entities/Milestone";
import { NegotiationRequest } from "@/database/entities/NegotiationRequest";
import { PaymentRecord } from "@/database/entities/PaymentRecord";
import { Project } from "@/database/entities/Project";
import { Proposal } from "@/database/entities/Proposal";
import { ProposalVersion } from "@/database/entities/ProposalVersion";
import type { ProposalSnapshot } from "@/lib/proposals/snapshot";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000);

/** Every figure is a live database query. Nothing here is hardcoded or sample data. */
export class DashboardService {
  static async overview() {
    const db = await AppDataSource();
    const today = iso(new Date());
    const P = db.getRepository(Proposal);
    const counts = Object.fromEntries((await P.createQueryBuilder("p").select("p.status", "status").addSelect("COUNT(*)", "n").where("p.isDeleted = false").groupBy("p.status").getRawMany()).map((r) => [r.status, Number(r.n)]));
    const c = (...s: string[]) => s.reduce((t, k) => t + (counts[k] ?? 0), 0);

    const [clients, projects, awaitingMyResponse, expiring, deadlines, recentActivity, recentRevisions, overduePayments, outstandingPayments] = await Promise.all([
      db.getRepository(Client).count({ where: { isDeleted: false } }),
      db.getRepository(Project).count({ where: { isDeleted: false } }),
      db.getRepository(NegotiationRequest).createQueryBuilder("n").where("n.isDeleted = false AND n.status IN ('open')").orderBy("n.createdAt", "ASC").limit(10).getMany(),
      P.createQueryBuilder("p").select(["p.id", "p.reference", "p.title", "p.validUntil", "p.status"]).where("p.isDeleted = false AND p.validUntil IS NOT NULL AND p.validUntil BETWEEN now() AND :to AND p.status IN ('sent','viewed','clarification_requested','negotiation_requested','revised_sent')", { to: addDays(7) }).orderBy("p.validUntil", "ASC").getMany(),
      db.getRepository(Milestone).createQueryBuilder("m").where("m.isDeleted = false AND m.status <> 'completed' AND m.dueDate IS NOT NULL AND m.dueDate <= :to", { to: iso(addDays(14)) }).orderBy("m.dueDate", "ASC").limit(15).getMany(),
      db.getRepository(AuditLog).find({ where: { actorType: "client" }, order: { createdAt: "DESC" }, take: 15, select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true } }),
      db.getRepository(ProposalVersion).find({ order: { publishedAt: "DESC" }, take: 8, select: { id: true, proposalId: true, label: true, changeNote: true, publishedAt: true } }),
      db.getRepository(PaymentRecord).createQueryBuilder("x").where("x.isDeleted = false AND x.status = 'pending' AND x.dueDate IS NOT NULL AND x.dueDate < :today", { today }).getCount(),
      db.getRepository(PaymentRecord).find({ where: { isDeleted: false, status: "pending" }, order: { dueDate: "ASC" }, take: 20 }),
    ]);

    return {
      totals: { clients, projects },
      proposals: {
        draft: c("draft", "ready_for_review"), awaitingClientReview: c("sent", "viewed", "revised_sent"), accepted: c("accepted"),
        requiringNegotiation: c("clarification_requested", "negotiation_requested"), revisionInProgress: c("revision_in_progress"),
        rejected: c("rejected"), expired: c("expired"), byStatus: counts,
      },
      awaitingMyResponse, expiring, upcomingDeadlines: deadlines,
      recentClientActivity: recentActivity, recentRevisions,
      payments: { outstanding: outstandingPayments, overdueCount: overduePayments },
      renewals: await this.renewals(),
    };
  }

  /** Renewal dates configured in ACCEPTED proposals (services, maintenance, other recurring), next 90 days. */
  private static async renewals() {
    const db = await AppDataSource();
    const accepted = await db.getRepository(Proposal).find({ where: { status: "accepted", isDeleted: false }, select: { id: true, reference: true, latestVersionId: true } });
    const out: { proposalId: string; reference: string; kind: "service" | "maintenance" | "other"; label: string; renewalDate: string }[] = [];
    const from = iso(new Date()); const to = iso(addDays(90));
    for (const p of accepted) {
      const v = p.latestVersionId ? await db.getRepository(ProposalVersion).findOne({ where: { id: p.latestVersionId } }) : null;
      if (!v) continue;
      const s = v.content as unknown as ProposalSnapshot;
      const push = (kind: "service" | "maintenance" | "other", label: string, d?: string | null) => { if (d && d >= from && d <= to) out.push({ proposalId: p.id, reference: p.reference, kind, label, renewalDate: d }); };
      for (const l of s.computed.recurring.lines) push(l.source, l.label, l.renewalDate);
    }
    return out.sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  }
}
