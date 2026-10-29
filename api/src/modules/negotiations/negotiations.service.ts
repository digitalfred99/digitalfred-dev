import type { EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { NegotiationMessage } from "@/database/entities/NegotiationMessage";
import { NegotiationRequest, NEGOTIATION_STATUSES } from "@/database/entities/NegotiationRequest";
import { Proposal } from "@/database/entities/Proposal";
import { audit } from "@/lib/audit/audit";
import { conflict, notFound } from "@/lib/errors/appErrors";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { canTransition } from "@/lib/proposals/stateMachine";
import { obj, oneOf, str, uuid } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };
const A = (a: Actor) => ({ actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent });
const RESOLUTIONS = ["answered", "agreed", "declined", "countered", "closed"] as const;

/**
 * Admin side of negotiation.
 * IMPORTANT: nothing here edits contract terms. "agreed" / "countered" only mean "I will reflect this in a
 * revision"; the terms change only when a NEW version is published and the client accepts it.
 */
export class NegotiationsService {
  static async list(q: URLSearchParams) {
    const repo = (await AppDataSource()).getRepository(NegotiationRequest);
    const { page, limit, skip, take } = parsePagination({ page: q.get("page"), limit: q.get("limit") });
    const qb = repo.createQueryBuilder("n").leftJoin(Proposal, "p", "p.id = n.proposalId").addSelect(["p.reference", "p.title"]).where("n.isDeleted = false");
    if (q.get("status")) qb.andWhere("n.status = :st", { st: oneOf(q.get("status"), "status", NEGOTIATION_STATUSES) });
    if (q.get("proposalId")) qb.andWhere("n.proposalId = :pid", { pid: uuid(q.get("proposalId"), "proposalId") });
    const total = await qb.getCount();
    const { entities, raw } = await qb.orderBy("n.createdAt", "DESC").skip(skip).take(take).getRawAndEntities();
    const data = entities.map((e, i) => ({ ...e, proposalReference: raw[i]?.p_reference ?? null, proposalTitle: raw[i]?.p_title ?? null }));
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  /** Full thread INCLUDING internal notes. Admin only. */
  static async get(id: string) {
    uuid(id);
    const db = await AppDataSource();
    const request = await db.getRepository(NegotiationRequest).findOne({ where: { id, isDeleted: false } });
    if (!request) throw notFound("Negotiation request");
    const [messages, proposal] = await Promise.all([
      db.getRepository(NegotiationMessage).find({ where: { requestId: id }, order: { createdAt: "ASC" } }),
      db.getRepository(Proposal).findOne({ where: { id: request.proposalId }, select: { id: true, reference: true, title: true, status: true, latestVersionLabel: true } }),
    ]);
    return { request, messages, proposal };
  }

  /** visibility "client" = reply the client can read; "internal" = private note. */
  static async addMessage(id: string, raw: unknown, a: Actor) {
    uuid(id);
    const b = obj(raw);
    const visibility = oneOf(b.visibility ?? "internal", "visibility", ["client", "internal"] as const);
    const body = str(b.body, "body", { max: 10000 });
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(NegotiationRequest).findOne({ where: { id, isDeleted: false } });
      if (!r) throw notFound("Negotiation request");
      const msg = await m.getRepository(NegotiationMessage).save(m.getRepository(NegotiationMessage).create({ requestId: id, author: "developer", visibility, body }));
      if (visibility === "client" && r.status === "open") await m.getRepository(NegotiationRequest).update(id, { status: "answered" });
      await audit({ action: visibility === "client" ? "negotiation.replied" : "negotiation.note_added", entityType: "negotiation", entityId: id, ...A(a) }, m);
      return msg;
    });
  }

  /**
   * Record your decision. `note` is shown to the client. If you agree to or counter a change, the proposal
   * moves to "revision_in_progress" so you can edit the draft and publish a new version.
   */
  static async resolve(id: string, raw: unknown, a: Actor) {
    uuid(id);
    const b = obj(raw);
    const resolution = oneOf(b.resolution, "resolution", RESOLUTIONS);
    const note = str(b.note, "note", { optional: true, max: 10000 });
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(NegotiationRequest).findOne({ where: { id, isDeleted: false }, lock: { mode: "pessimistic_write" } });
      if (!r) throw notFound("Negotiation request");
      if (r.status === "closed") throw conflict("This request is already closed.");
      r.status = resolution; r.resolvedAt = new Date(); r.resolutionNote = note || null;
      await m.getRepository(NegotiationRequest).save(r);
      if (note) await m.getRepository(NegotiationMessage).save(m.getRepository(NegotiationMessage).create({ requestId: id, author: "developer", visibility: "client", body: note }));

      const p = await m.getRepository(Proposal).findOneOrFail({ where: { id: r.proposalId }, lock: { mode: "pessimistic_write" } });
      let newStatus = p.status;
      if (resolution === "agreed" || resolution === "countered") {
        if (canTransition(p.status, "revision_in_progress")) newStatus = "revision_in_progress";
      } else if (p.status === "clarification_requested" || p.status === "negotiation_requested") {
        const stillOpen = await this.openCount(m, p.id, id);
        if (stillOpen === 0 && canTransition(p.status, "viewed")) newStatus = "viewed";
      }
      if (newStatus !== p.status) await m.getRepository(Proposal).update(p.id, { status: newStatus });
      await audit({ action: "negotiation.resolved", entityType: "negotiation", entityId: id, metadata: { resolution, proposalStatus: newStatus }, ...A(a) }, m);
      return { request: r, proposalStatus: newStatus };
    });
  }

  private static openCount(m: EntityManager, proposalId: string, excludeId: string) {
    return m.getRepository(NegotiationRequest).createQueryBuilder("n").where("n.proposalId = :proposalId AND n.isDeleted = false AND n.status IN ('open','answered') AND n.id <> :excludeId", { proposalId, excludeId }).getCount();
  }
}
