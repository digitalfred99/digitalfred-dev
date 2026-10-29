import { Brackets, type EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { ChangeRequest } from "@/database/entities/ChangeRequest";
import { Client } from "@/database/entities/Client";
import { Milestone } from "@/database/entities/Milestone";
import { Project, PROJECT_STATUSES, type ProjectLists } from "@/database/entities/Project";
import { Proposal } from "@/database/entities/Proposal";
import { REQUIREMENT_KINDS, REQUIREMENT_PREFIX, Requirement } from "@/database/entities/Requirement";
import { audit } from "@/lib/audit/audit";
import { conflict, notFound } from "@/lib/errors/appErrors";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { isCurrencyCode } from "@/lib/money/money";
import { bool, int, isoDate, minorOrNull, obj, oneOf, optStr, str, strArray, uuid, ValidationError } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };
const A = (a: Actor) => ({ actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent });
const LIST_KEYS: (keyof ProjectLists)[] = ["objectives", "targetUsers", "technologyStack", "assumptions", "dependencies", "constraints", "deliverables", "exclusions", "futureEnhancements"];

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

function sanitizeProject(raw: unknown, partial: boolean) {
  const b = obj(raw);
  const out: Partial<Project> = {};
  if (!partial || b.name !== undefined) out.name = str(b.name, "name", { max: 255 });
  if (b.identifier !== undefined || !partial) {
    const id = slugify(String(b.identifier ?? b.name ?? ""));
    if (!id) throw new ValidationError("identifier: is required", "identifier");
    out.identifier = id;
  }
  if (b.clientId !== undefined) out.clientId = b.clientId === null ? null : uuid(b.clientId, "clientId");
  if (b.status !== undefined) out.status = oneOf(b.status, "status", PROJECT_STATUSES);
  for (const k of ["description", "businessProblem", "proposedSolution", "scope", "timelineNotes"] as const)
    if (b[k] !== undefined) out[k] = str(b[k], k, { optional: true, max: 60000, trim: false });
  if (b.lists !== undefined) {
    const l = obj(b.lists, "lists"); const lists: Partial<ProjectLists> = {};
    for (const k of LIST_KEYS) if (l[k] !== undefined) lists[k] = strArray(l[k], `lists.${k}`);
    out.lists = lists;
  }
  if (b.terms !== undefined) {
    const t = obj(b.terms, "terms");
    out.terms = { warranty: str(t.warranty, "terms.warranty", { optional: true, max: 10000 }), ownership: str(t.ownership, "terms.ownership", { optional: true, max: 10000 }), maintenance: str(t.maintenance, "terms.maintenance", { optional: true, max: 10000 }), support: str(t.support, "terms.support", { optional: true, max: 10000 }) };
  }
  if (b.startDate !== undefined) out.startDate = isoDate(b.startDate, "startDate");
  if (b.targetDate !== undefined) out.targetDate = isoDate(b.targetDate, "targetDate");
  return out;
}

export class ProjectsService {
  static async list(q: URLSearchParams) {
    const repo = (await AppDataSource()).getRepository(Project);
    const { page, limit, skip, take } = parsePagination({ page: q.get("page"), limit: q.get("limit") });
    const qb = repo.createQueryBuilder("p").leftJoinAndSelect("p.client", "c").where("p.isDeleted = false");
    if (q.get("clientId")) qb.andWhere("p.clientId = :cid", { cid: uuid(q.get("clientId"), "clientId") });
    if (q.get("status")) qb.andWhere("p.status = :st", { st: oneOf(q.get("status"), "status", PROJECT_STATUSES) });
    const s = q.get("search")?.trim();
    if (s) qb.andWhere(new Brackets((w) => w.where("p.name ILIKE :s", { s: `%${s}%` }).orWhere("p.identifier ILIKE :s")));
    const [rows, total] = await qb.orderBy("p.updatedAt", "DESC").skip(skip).take(take).getManyAndCount();
    return { data: rows, meta: buildPaginationMeta(total, page, limit) };
  }

  static async get(id: string) {
    uuid(id);
    const db = await AppDataSource();
    const project = await db.getRepository(Project).findOne({ where: { id, isDeleted: false }, relations: { client: true } });
    if (!project) throw notFound("Project");
    const [requirements, milestones, proposals, changeRequests] = await Promise.all([
      db.getRepository(Requirement).find({ where: { projectId: id, isDeleted: false }, order: { kind: "ASC", sortOrder: "ASC", code: "ASC" } }),
      db.getRepository(Milestone).find({ where: { projectId: id, isDeleted: false }, order: { sortOrder: "ASC", dueDate: "ASC" } }),
      db.getRepository(Proposal).find({ where: { projectId: id, isDeleted: false }, order: { createdAt: "DESC" }, select: { id: true, reference: true, title: true, status: true, kind: true, latestVersionLabel: true, validUntil: true, createdAt: true } }),
      db.getRepository(ChangeRequest).find({ where: { projectId: id, isDeleted: false }, order: { createdAt: "DESC" } }),
    ]);
    return { project, requirements, milestones, proposals, changeRequests };
  }

  static async create(raw: unknown, a: Actor) {
    const data = sanitizeProject(raw, false);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      if (data.clientId && !(await m.getRepository(Client).findOne({ where: { id: data.clientId, isDeleted: false } }))) throw notFound("Client");
      const repo = m.getRepository(Project);
      if (await repo.findOne({ where: { identifier: data.identifier, isDeleted: false } })) throw conflict(`A project with identifier "${data.identifier}" already exists`);
      const saved = await repo.save(repo.create({ lists: {}, terms: {}, ...data }));
      await audit({ action: "project.created", entityType: "project", entityId: saved.id, ...A(a) }, m);
      return saved;
    });
  }

  static async update(id: string, raw: unknown, a: Actor) {
    uuid(id);
    const patch = sanitizeProject(raw, true);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const repo = m.getRepository(Project);
      const p = await repo.findOne({ where: { id, isDeleted: false } });
      if (!p) throw notFound("Project");
      if (patch.clientId && !(await m.getRepository(Client).findOne({ where: { id: patch.clientId, isDeleted: false } }))) throw notFound("Client");
      if (patch.identifier && patch.identifier !== p.identifier && (await repo.findOne({ where: { identifier: patch.identifier, isDeleted: false } }))) throw conflict(`A project with identifier "${patch.identifier}" already exists`);
      if (patch.lists) patch.lists = { ...p.lists, ...patch.lists };
      if (patch.terms) patch.terms = { ...p.terms, ...patch.terms };
      const saved = await repo.save(repo.merge(p, patch));
      await audit({ action: "project.updated", entityType: "project", entityId: id, metadata: { fields: Object.keys(patch) }, ...A(a) }, m);
      return saved;
    });
  }

  static async remove(id: string, a: Actor) {
    uuid(id);
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      if (!(await m.getRepository(Project).findOne({ where: { id, isDeleted: false } }))) throw notFound("Project");
      if ((await m.getRepository(Proposal).count({ where: { projectId: id } })) > 0) throw conflict("This project has proposals and cannot be deleted. Set its status to cancelled or closed instead.");
      await m.getRepository(Project).update(id, { isDeleted: true });
      await audit({ action: "project.deleted", entityType: "project", entityId: id, ...A(a) }, m);
    });
  }

  // ── Requirements ───────────────────────────────────────────────
  private static sanitizeReq(raw: unknown, partial: boolean) {
    const b = obj(raw); const out: Partial<Requirement> = {};
    if (!partial || b.kind !== undefined) out.kind = oneOf(b.kind ?? "functional", "kind", REQUIREMENT_KINDS);
    if (!partial || b.title !== undefined) out.title = str(b.title, "title", { max: 255 });
    if (b.description !== undefined) out.description = str(b.description, "description", { optional: true, max: 20000, trim: false });
    if (b.priority !== undefined) out.priority = oneOf(b.priority, "priority", ["must", "should", "could", "wont"] as const);
    if (b.status !== undefined) out.status = oneOf(b.status, "status", ["draft", "confirmed"] as const);
    if (b.dependencies !== undefined) out.dependencies = strArray(b.dependencies, "dependencies", { max: 50, itemMax: 20 });
    if (b.acceptanceCriteria !== undefined) out.acceptanceCriteria = strArray(b.acceptanceCriteria, "acceptanceCriteria", { max: 50 });
    return out;
  }

  static async listRequirements(projectId: string) {
    uuid(projectId);
    return (await AppDataSource()).getRepository(Requirement).find({ where: { projectId, isDeleted: false }, order: { kind: "ASC", sortOrder: "ASC", code: "ASC" } });
  }

  /** Assigns FR-001, FR-002... safely: the project row is locked so concurrent creates cannot collide. */
  static async createRequirement(projectId: string, raw: unknown, a: Actor, existing?: EntityManager) {
    uuid(projectId);
    const data = this.sanitizeReq(raw, false);
    const run = async (m: EntityManager) => {
      const proj = await m.getRepository(Project).createQueryBuilder("p").setLock("pessimistic_write").where("p.id = :projectId AND p.isDeleted = false", { projectId }).getOne();
      if (!proj) throw notFound("Project");
      const prefix = REQUIREMENT_PREFIX[data.kind!];
      const rows: { code: string; sortOrder: number }[] = await m.getRepository(Requirement).find({ where: { projectId }, select: { code: true, sortOrder: true } });
      const maxNum = rows.filter((r) => r.code.startsWith(prefix + "-")).reduce((mx, r) => Math.max(mx, parseInt(r.code.split("-")[1], 10) || 0), 0);
      const code = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
      const sortOrder = rows.reduce((mx, r) => Math.max(mx, r.sortOrder), 0) + 1;
      const saved = await m.getRepository(Requirement).save(m.getRepository(Requirement).create({ priority: "must", status: "draft", dependencies: [], acceptanceCriteria: [], ...data, projectId, code, sortOrder }));
      await audit({ action: "requirement.created", entityType: "requirement", entityId: saved.id, metadata: { code, projectId }, ...A(a) }, m);
      return saved;
    };
    return existing ? run(existing) : (await AppDataSource()).transaction(run);
  }

  static async updateRequirement(projectId: string, id: string, raw: unknown, a: Actor) {
    uuid(projectId); uuid(id);
    const patch = this.sanitizeReq(raw, true);
    delete patch.kind; // the code prefix is tied to the kind
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const repo = m.getRepository(Requirement);
      const r = await repo.findOne({ where: { id, projectId, isDeleted: false } });
      if (!r) throw notFound("Requirement");
      const saved = await repo.save(repo.merge(r, patch));
      await audit({ action: "requirement.updated", entityType: "requirement", entityId: id, metadata: { code: r.code, fields: Object.keys(patch) }, ...A(a) }, m);
      return saved;
    });
  }

  static async deleteRequirement(projectId: string, id: string, a: Actor) {
    uuid(projectId); uuid(id);
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      const r = await m.getRepository(Requirement).findOne({ where: { id, projectId, isDeleted: false } });
      if (!r) throw notFound("Requirement");
      await m.getRepository(Requirement).update(id, { isDeleted: true });
      await audit({ action: "requirement.deleted", entityType: "requirement", entityId: id, metadata: { code: r.code }, ...A(a) }, m);
    });
  }

  static async reorderRequirements(projectId: string, raw: unknown, a: Actor) {
    uuid(projectId);
    const ids = (obj(raw).ids as unknown[]) ?? [];
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) throw new ValidationError("ids: must be a list of requirement ids", "ids");
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      for (let i = 0; i < ids.length; i++) await m.getRepository(Requirement).update({ id: uuid(ids[i], "ids"), projectId }, { sortOrder: i + 1 });
      await audit({ action: "requirement.reordered", entityType: "project", entityId: projectId, ...A(a) }, m);
    });
  }

  // ── Milestones ─────────────────────────────────────────────────
  private static sanitizeMilestone(raw: unknown, partial: boolean) {
    const b = obj(raw); const out: Partial<Milestone> = {};
    if (!partial || b.title !== undefined) out.title = str(b.title, "title", { max: 255 });
    if (b.description !== undefined) out.description = str(b.description, "description", { optional: true, max: 5000 });
    if (b.dueDate !== undefined) out.dueDate = isoDate(b.dueDate, "dueDate");
    if (b.status !== undefined) out.status = oneOf(b.status, "status", ["planned", "in_progress", "completed", "delayed"] as const);
    if (b.sortOrder !== undefined) out.sortOrder = int(b.sortOrder, "sortOrder", { min: 0, max: 100000 });
    return out;
  }
  static async createMilestone(projectId: string, raw: unknown, a: Actor) {
    uuid(projectId);
    const data = this.sanitizeMilestone(raw, false);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      if (!(await m.getRepository(Project).findOne({ where: { id: projectId, isDeleted: false } }))) throw notFound("Project");
      const saved = await m.getRepository(Milestone).save(m.getRepository(Milestone).create({ ...data, projectId }));
      await audit({ action: "milestone.created", entityType: "milestone", entityId: saved.id, ...A(a) }, m);
      return saved;
    });
  }
  static async updateMilestone(projectId: string, id: string, raw: unknown, a: Actor) {
    uuid(projectId); uuid(id);
    const patch = this.sanitizeMilestone(raw, true);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(Milestone).findOne({ where: { id, projectId, isDeleted: false } });
      if (!r) throw notFound("Milestone");
      const saved = await m.getRepository(Milestone).save(m.getRepository(Milestone).merge(r, patch));
      await audit({ action: "milestone.updated", entityType: "milestone", entityId: id, metadata: { fields: Object.keys(patch) }, ...A(a) }, m);
      return saved;
    });
  }
  static async deleteMilestone(projectId: string, id: string, a: Actor) {
    uuid(projectId); uuid(id);
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      const r = await m.getRepository(Milestone).findOne({ where: { id, projectId, isDeleted: false } });
      if (!r) throw notFound("Milestone");
      await m.getRepository(Milestone).update(id, { isDeleted: true });
      await audit({ action: "milestone.deleted", entityType: "milestone", entityId: id, ...A(a) }, m);
    });
  }

  // ── Change requests (work outside the agreed scope) ────────────
  private static sanitizeCR(raw: unknown, partial: boolean) {
    const b = obj(raw); const out: Partial<ChangeRequest> = {};
    if (!partial || b.title !== undefined) out.title = str(b.title, "title", { max: 255 });
    if (!partial || b.description !== undefined) out.description = str(b.description, "description", { max: 20000 });
    if (b.requestedBy !== undefined) out.requestedBy = str(b.requestedBy, "requestedBy", { optional: true, max: 255 });
    if (b.additionalWork !== undefined) out.additionalWork = str(b.additionalWork, "additionalWork", { optional: true, max: 20000 });
    if (b.estimateMinor !== undefined) out.estimateMinor = minorOrNull(b.estimateMinor, "estimateMinor");
    if (b.currency !== undefined) { const c = String(b.currency); if (!isCurrencyCode(c)) throw new ValidationError("currency: invalid", "currency"); out.currency = c; }
    if (b.timelineImpact !== undefined) out.timelineImpact = str(b.timelineImpact, "timelineImpact", { optional: true, max: 5000 });
    if (b.status !== undefined) out.status = oneOf(b.status, "status", ["draft", "proposed", "approved", "rejected", "implemented"] as const);
    return out;
  }
  static async listChangeRequests(projectId: string) {
    uuid(projectId);
    return (await AppDataSource()).getRepository(ChangeRequest).find({ where: { projectId, isDeleted: false }, order: { createdAt: "DESC" } });
  }
  static async createChangeRequest(projectId: string, raw: unknown, a: Actor) {
    uuid(projectId);
    const data = this.sanitizeCR(raw, false);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      if (!(await m.getRepository(Project).findOne({ where: { id: projectId, isDeleted: false } }))) throw notFound("Project");
      const saved = await m.getRepository(ChangeRequest).save(m.getRepository(ChangeRequest).create({ ...data, projectId, status: "draft" }));
      await audit({ action: "change_request.created", entityType: "change_request", entityId: saved.id, ...A(a) }, m);
      return saved;
    });
  }
  static async updateChangeRequest(id: string, raw: unknown, a: Actor) {
    uuid(id);
    const patch = this.sanitizeCR(raw, true);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const r = await m.getRepository(ChangeRequest).findOne({ where: { id, isDeleted: false } });
      if (!r) throw notFound("Change request");
      // "approved" may only be set through an accepted amendment proposal, never by a bare edit.
      if (patch.status === "approved" && !r.amendmentProposalId) throw conflict("A change request is approved by the client accepting an amendment proposal. Create the amendment first.");
      const saved = await m.getRepository(ChangeRequest).save(m.getRepository(ChangeRequest).merge(r, patch));
      await audit({ action: "change_request.updated", entityType: "change_request", entityId: id, metadata: { fields: Object.keys(patch) }, ...A(a) }, m);
      return saved;
    });
  }
}
export { bool, optStr };
