import { Brackets } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { Client } from "@/database/entities/Client";
import { Project } from "@/database/entities/Project";
import { Proposal } from "@/database/entities/Proposal";
import { NegotiationRequest } from "@/database/entities/NegotiationRequest";
import { audit } from "@/lib/audit/audit";
import { notFound, conflict } from "@/lib/errors/appErrors";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { isCurrencyCode } from "@/lib/money/money";
import { email, obj, oneOf, optStr, str, uuid, ValidationError } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };
type PublicActor = { ipAddress?: string; userAgent?: string };

function sanitize(raw: unknown, partial = false) {
  const b = obj(raw);
  const out: Partial<Client> = {};
  const has = (k: string) => !partial || b[k] !== undefined;
  if (has("type")) out.type = oneOf(b.type ?? "organization", "type", ["individual", "organization"] as const);
  if (has("contactName")) out.contactName = str(b.contactName, "contactName", { max: 255 });
  if (has("email")) out.email = email(b.email).toLowerCase();
  if (b.organizationName !== undefined) out.organizationName = optStr(b.organizationName, "organizationName", 255);
  if (b.phone !== undefined) out.phone = optStr(b.phone, "phone", 40);
  if (has("country")) out.country = str(b.country ?? "Ghana", "country", { max: 100 });
  if (has("preferredCurrency")) { const c = String(b.preferredCurrency ?? "GHS"); if (!isCurrencyCode(c)) throw new ValidationError("preferredCurrency: must be a 3-letter code", "preferredCurrency"); out.preferredCurrency = c; }
  if (b.billingAddress !== undefined) out.billingAddress = optStr(b.billingAddress, "billingAddress", 2000);
  if (b.taxId !== undefined) out.taxId = optStr(b.taxId, "taxId", 120);
  if (b.internalNotes !== undefined) out.internalNotes = optStr(b.internalNotes, "internalNotes", 10000);
  if (!partial && out.type === "organization" && !out.organizationName) throw new ValidationError("organizationName: is required for organisations", "organizationName");
  return out;
}
const displayNameOf = (c: Pick<Client, "type" | "organizationName" | "contactName">) => (c.type === "individual" ? c.contactName : c.organizationName || c.contactName);

export class ClientsService {
  static async list(q: URLSearchParams) {
    const repo = (await AppDataSource()).getRepository(Client);
    const { page, limit, skip, take } = parsePagination({ page: q.get("page"), limit: q.get("limit") });
    const qb = repo.createQueryBuilder("c").where("c.isDeleted = false");
    const s = q.get("search")?.trim();
    if (s) qb.andWhere(new Brackets((w) => w.where("c.displayName ILIKE :s", { s: `%${s}%` }).orWhere("c.email ILIKE :s").orWhere("c.contactName ILIKE :s")));
    const [rows, total] = await qb.orderBy("c.displayName", "ASC").skip(skip).take(take).getManyAndCount();
    return { data: rows, meta: buildPaginationMeta(total, page, limit) };
  }

  /** Profile with projects and the full proposal + negotiation history. */
  static async get(id: string) {
    uuid(id);
    const db = await AppDataSource();
    const client = await db.getRepository(Client).findOne({ where: { id, isDeleted: false } });
    if (!client) throw notFound("Client");
    const projects = await db.getRepository(Project).find({ where: { clientId: id, isDeleted: false }, order: { createdAt: "DESC" } });
    const proposals = await db.getRepository(Proposal).find({
      where: { clientId: id, isDeleted: false }, order: { createdAt: "DESC" },
      select: { id: true, reference: true, title: true, status: true, kind: true, latestVersionLabel: true, projectId: true, currency: true, validUntil: true, createdAt: true },
    });
    const ids = proposals.map((p) => p.id);
    const negotiations = ids.length
      ? await db.getRepository(NegotiationRequest).createQueryBuilder("n").where("n.proposalId IN (:...ids)", { ids }).orderBy("n.createdAt", "DESC").getMany()
      : [];
    return { client, projects, proposals, negotiations };
  }

  static async create(raw: unknown, a: Actor) {
    const data = sanitize(raw);
    data.displayName = displayNameOf(data as Client);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const saved = await m.getRepository(Client).save(m.getRepository(Client).create(data));
      await audit({ action: "client.created", entityType: "client", entityId: saved.id, actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent }, m);
      return saved;
    });
  }

  static async createFromPublicIntake(raw: unknown, actor: PublicActor) {
    const body = obj(raw);
    const type = oneOf(body.type ?? "individual", "type", ["individual", "organization"] as const);
    const contactName = str(body.contactName, "contactName", { max: 255 });
    const organizationName = body.organizationName === undefined ? null : optStr(body.organizationName, "organizationName", 255);
    if (type === "organization" && !organizationName) throw new ValidationError("organizationName: is required for organisations", "organizationName");

    const phone = body.phone === undefined || body.phone === null || body.phone === ""
      ? null
      : str(body.phone, "phone", { max: 15 });
    if (phone !== null && !/^\d{1,15}$/.test(phone)) {
      throw new ValidationError("phone: must contain digits only and be no more than 15 digits", "phone");
    }

    const preferredCurrency = oneOf(body.preferredCurrency ?? "GHS", "preferredCurrency", ["GHS", "USD"] as const);
    const client = {
      type,
      contactName,
      organizationName,
      email: email(body.email).toLowerCase(),
      phone,
      country: "Ghana",
      preferredCurrency,
      displayName: type === "individual" ? contactName : organizationName || contactName,
    };

    const db = await AppDataSource();
    return db.transaction(async (manager) => {
      const saved = await manager.getRepository(Client).save(manager.getRepository(Client).create(client));
      await audit({
        action: "client.created",
        entityType: "client",
        entityId: saved.id,
        actorType: "client",
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      }, manager);
      return { id: saved.id, displayName: saved.displayName };
    });
  }

  static async update(id: string, raw: unknown, a: Actor) {
    uuid(id);
    const patch = sanitize(raw, true);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const repo = m.getRepository(Client);
      const c = await repo.findOne({ where: { id, isDeleted: false } });
      if (!c) throw notFound("Client");
      const merged = repo.merge(c, patch);
      merged.displayName = displayNameOf(merged);
      const saved = await repo.save(merged);
      await audit({ action: "client.updated", entityType: "client", entityId: id, actorUserId: a.userId, metadata: { fields: Object.keys(patch) }, ipAddress: a.ipAddress, userAgent: a.userAgent }, m);
      return saved;
    });
  }

  static async remove(id: string, a: Actor) {
    uuid(id);
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      const c = await m.getRepository(Client).findOne({ where: { id, isDeleted: false } });
      if (!c) throw notFound("Client");
      if ((await m.getRepository(Proposal).count({ where: { clientId: id } })) > 0) throw conflict("This client has proposals and cannot be deleted. Their records must be preserved.");
      await m.getRepository(Client).update(id, { isDeleted: true });
      await audit({ action: "client.deleted", entityType: "client", entityId: id, actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent }, m);
    });
  }
}
