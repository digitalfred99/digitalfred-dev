import type { EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { DocumentTemplate } from "@/database/entities/DocumentTemplate";
import { Project } from "@/database/entities/Project";
import { Requirement } from "@/database/entities/Requirement";
import { SrsDocument } from "@/database/entities/SrsDocument";
import { SrsVersion, type SrsRequirementSnapshot } from "@/database/entities/SrsVersion";
import { audit } from "@/lib/audit/audit";
import { conflict, notFound, staleEdit } from "@/lib/errors/appErrors";
import { DEFAULT_SRS_SECTIONS, makeSections, sanitizeSections, type Section } from "@/lib/proposals/content";
import { contentHash, nextVersion } from "@/lib/proposals/versioning";
import { int, obj, oneOf, str, uuid } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };
const A = (a: Actor) => ({ actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent });
const bullets = (xs?: string[]) => (xs && xs.length ? xs.map((x) => `- ${x}`).join("\n") : "");

/** Pre-fills sections from the project record. Everything stays editable; nothing is invented. */
function seedBodies(p: Project): Record<string, string> {
  const l = p.lists ?? {};
  return {
    overview: p.description, background: p.businessProblem, proposed_solution: p.proposedSolution,
    business_objectives: bullets(l.objectives), stakeholders: bullets(l.targetUsers),
    assumptions: bullets(l.assumptions), constraints: bullets(l.constraints), dependencies: bullets(l.dependencies),
    out_of_scope: bullets(l.exclusions), future: bullets(l.futureEnhancements),
    infrastructure: bullets(l.technologyStack),
  };
}

export async function requirementSnapshots(m: EntityManager, projectId: string): Promise<SrsRequirementSnapshot[]> {
  const rows = await m.getRepository(Requirement).find({ where: { projectId, isDeleted: false }, order: { kind: "ASC", sortOrder: "ASC", code: "ASC" } });
  return rows.map((r) => ({ code: r.code, kind: r.kind, title: r.title, description: r.description, priority: r.priority, dependencies: r.dependencies, acceptanceCriteria: r.acceptanceCriteria }));
}

export class SrsService {
  static async getOrCreate(projectId: string, a: Actor) {
    uuid(projectId);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const existing = await m.getRepository(SrsDocument).findOne({ where: { projectId } });
      const project = await m.getRepository(Project).findOne({ where: { id: projectId, isDeleted: false } });
      if (!project) throw notFound("Project");
      if (existing) return { document: existing, requirements: await requirementSnapshots(m, projectId) };
      const tpl = await m.getRepository(DocumentTemplate).findOne({ where: { kind: "srs", isDefault: true, isDeleted: false } });
      const seeds = seedBodies(project);
      const defs = tpl?.sections?.length ? tpl.sections : DEFAULT_SRS_SECTIONS;
      const sections = makeSections(defs.map((d) => ({ key: d.key, title: d.title, body: seeds[d.key] || ("body" in d ? (d as { body: string }).body : "") })));
      const doc = await m.getRepository(SrsDocument).save(m.getRepository(SrsDocument).create({ projectId, title: `Software Requirements Specification: ${project.name}`, sections }));
      await audit({ action: "srs.created", entityType: "srs_document", entityId: doc.id, metadata: { projectId }, ...A(a) }, m);
      return { document: doc, requirements: await requirementSnapshots(m, projectId) };
    });
  }

  /** Save the working draft. `revision` must match the stored one, so two tabs can never silently overwrite each other. */
  static async save(projectId: string, raw: unknown, a: Actor) {
    uuid(projectId);
    const b = obj(raw);
    const revision = int(b.revision, "revision", { min: 1 });
    const sections = sanitizeSections(b.sections);
    const title = b.title !== undefined ? str(b.title, "title", { max: 255 }) : undefined;
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const doc = await m.getRepository(SrsDocument).findOne({ where: { projectId }, lock: { mode: "pessimistic_write" } });
      if (!doc) throw notFound("Requirements document");
      if (doc.revision !== revision) throw staleEdit("This document was changed elsewhere. Reload it before saving.");
      doc.sections = sections; if (title) doc.title = title;
      doc.revision += 1;
      if (doc.status === "approved") doc.status = "draft"; // editing after approval requires re-approval
      const saved = await m.getRepository(SrsDocument).save(doc);
      await audit({ action: "srs.saved", entityType: "srs_document", entityId: doc.id, metadata: { revision: saved.revision }, ...A(a) }, m);
      return saved;
    });
  }

  static async setStatus(projectId: string, raw: unknown, a: Actor) {
    uuid(projectId);
    const status = oneOf(obj(raw).status, "status", ["draft", "in_review", "approved"] as const);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const doc = await m.getRepository(SrsDocument).findOne({ where: { projectId } });
      if (!doc) throw notFound("Requirements document");
      doc.status = status;
      const saved = await m.getRepository(SrsDocument).save(doc);
      await audit({ action: "srs.status_changed", entityType: "srs_document", entityId: doc.id, metadata: { status }, ...A(a) }, m);
      return saved;
    });
  }

  /** Freeze the current draft (sections + itemised requirements) as an immutable numbered version. */
  static async createVersion(projectId: string, raw: unknown, a: Actor) {
    uuid(projectId);
    const b = obj(raw ?? {});
    const bump = b.bump === "major" ? "major" : "minor";
    const note = str(b.note, "note", { optional: true, max: 2000 });
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const v = await this.freeze(m, projectId, bump, note, a);
      if (!v) throw conflict("Nothing has changed since the last version.");
      return v;
    });
  }

  /** Creates a version only if content differs from the latest. Returns the (new or existing) latest version. */
  static async ensureCurrentVersion(m: EntityManager, projectId: string, note: string, a: Actor) {
    const created = await this.freeze(m, projectId, "minor", note, a);
    if (created) return created;
    const doc = await m.getRepository(SrsDocument).findOneOrFail({ where: { projectId } });
    return m.getRepository(SrsVersion).findOneOrFail({ where: { documentId: doc.id }, order: { major: "DESC", minor: "DESC" } });
  }

  private static async freeze(m: EntityManager, projectId: string, bump: "minor" | "major", note: string, a: Actor) {
    const doc = await m.getRepository(SrsDocument).findOne({ where: { projectId }, lock: { mode: "pessimistic_write" } });
    if (!doc) throw notFound("Requirements document");
    const requirements = await requirementSnapshots(m, projectId);
    const payload = { title: doc.title, sections: doc.sections as Section[], requirements };
    const hash = contentHash(payload);
    const latest = await m.getRepository(SrsVersion).findOne({ where: { documentId: doc.id }, order: { major: "DESC", minor: "DESC" } });
    if (latest && latest.contentHash === hash) return null;
    const n = nextVersion(latest, bump);
    const saved = await m.getRepository(SrsVersion).save(m.getRepository(SrsVersion).create({ documentId: doc.id, projectId, major: n.major, minor: n.minor, label: n.label, ...payload, contentHash: hash, note }));
    await m.getRepository(SrsDocument).update(doc.id, { latestVersionLabel: n.label });
    await audit({ action: "srs.version_created", entityType: "srs_version", entityId: saved.id, metadata: { label: n.label, projectId }, ...A(a) }, m);
    return saved;
  }

  static async listVersions(projectId: string) {
    uuid(projectId);
    const db = await AppDataSource();
    const doc = await db.getRepository(SrsDocument).findOne({ where: { projectId } });
    if (!doc) return [];
    return db.getRepository(SrsVersion).find({ where: { documentId: doc.id }, order: { major: "DESC", minor: "DESC" }, select: { id: true, label: true, contentHash: true, note: true, createdAt: true } });
  }
  static async getVersion(projectId: string, versionId: string) {
    uuid(projectId); uuid(versionId);
    const v = await (await AppDataSource()).getRepository(SrsVersion).findOne({ where: { id: versionId, projectId } });
    if (!v) throw notFound("Version");
    return v;
  }
}
