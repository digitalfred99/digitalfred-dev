import { randomUUID } from "node:crypto";
import { Brackets, type EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { Client } from "@/database/entities/Client";
import { DocumentTemplate } from "@/database/entities/DocumentTemplate";
import { Project } from "@/database/entities/Project";
import { Proposal } from "@/database/entities/Proposal";
import { ProposalAcceptance } from "@/database/entities/ProposalAcceptance";
import { ProposalAccessLink } from "@/database/entities/ProposalAccessLink";
import { ProposalVersion } from "@/database/entities/ProposalVersion";
import { Requirement } from "@/database/entities/Requirement";
import { SrsDocument } from "@/database/entities/SrsDocument";
import { audit } from "@/lib/audit/audit";
import { conflict, notFound, readinessFailed, staleEdit, badRequest } from "@/lib/errors/appErrors";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
import { isCurrencyCode } from "@/lib/money/money";
import { computePricing, emptyPricingInput } from "@/lib/pricing/engine";
import { sanitizePricing } from "@/lib/pricing/validate";
import { DEFAULT_PROPOSAL_SECTIONS, makeSections, sanitizeSections, type ProposalDraft } from "@/lib/proposals/content";
import { checkReadiness } from "@/lib/proposals/readiness";
import { buildSnapshot } from "@/lib/proposals/snapshot";
import { PROPOSAL_STATUSES, allowedTransitions, canTransition, isDraftEditable, type ProposalStatus } from "@/lib/proposals/stateMachine";
import { contentHash, nextVersion } from "@/lib/proposals/versioning";
import { generateToken, hashToken } from "@/lib/security/tokens";
import { getSettings, nextProposalReference, type BusinessSettings } from "@/lib/settings";
import { SrsService, requirementSnapshots } from "@/modules/srs/srs.service";
import { bool, int, obj, oneOf, str, strArray, uuid, ValidationError } from "@/lib/validation/v";

type Actor = { userId: string; ipAddress?: string; userAgent?: string };
const A = (a: Actor) => ({ actorUserId: a.userId, ipAddress: a.ipAddress, userAgent: a.userAgent });
const MANUAL_TARGETS: ProposalStatus[] = ["draft", "ready_for_review", "withdrawn", "revision_in_progress"];

const bullets = (xs?: string[]) => (xs && xs.length ? xs.map((x) => `- ${x}`).join("\n") : "");

function seedSections(project: Project, s: BusinessSettings, tpl: DocumentTemplate | null) {
  const l = project.lists ?? {}; const t = project.terms ?? {}; const d = s.defaults;
  const seeds: Record<string, string> = {
    business_problem: project.businessProblem, proposed_solution: project.proposedSolution, executive_summary: project.description,
    scope: project.scope, deliverables: bullets(l.deliverables), exclusions: bullets(l.exclusions), future_enhancements: bullets(l.futureEnhancements),
    technology: bullets(l.technologyStack), timeline: project.timelineNotes,
    warranty: t.warranty || d.warrantyTerms, ip_ownership: t.ownership || d.ipTerms, support: t.support || t.maintenance || d.supportTerms,
    confidentiality: d.confidentialityTerms, change_requests: d.changeRequestPolicy, termination: d.terminationTerms,
  };
  const defs = tpl?.sections?.length ? tpl.sections : DEFAULT_PROPOSAL_SECTIONS;
  return makeSections(defs.map((x) => ({ key: x.key, title: x.title, body: seeds[x.key] || ("body" in x ? (x as { body: string }).body : "") })));
}

async function load(m: EntityManager, id: string, lock = false) {
  uuid(id);
  const p = await m.getRepository(Proposal).findOne({ where: { id, isDeleted: false }, ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}) });
  if (!p) throw notFound("Proposal");
  return p;
}

export class ProposalsService {
  static async readiness(m: EntityManager, p: Proposal) {
    const reqCount = p.draft.attachSrs ? await m.getRepository(Requirement).count({ where: { projectId: p.projectId, isDeleted: false } }) : null;
    return checkReadiness({ title: p.title, hasClient: !!p.clientId, hasProject: !!p.projectId, validityDays: p.validityDays, draft: p.draft, srsRequirementCount: reqCount });
  }

  static async list(q: URLSearchParams) {
    const repo = (await AppDataSource()).getRepository(Proposal);
    const { page, limit, skip, take } = parsePagination({ page: q.get("page"), limit: q.get("limit") });
    const qb = repo.createQueryBuilder("p").leftJoinAndSelect("p.client", "c").leftJoinAndSelect("p.project", "pr").where("p.isDeleted = false").select([
      "p.id", "p.reference", "p.title", "p.status", "p.kind", "p.currency", "p.latestVersionLabel", "p.validUntil", "p.sentAt", "p.acceptedAt", "p.createdAt", "p.updatedAt", "p.clientId", "p.projectId",
      "c.id", "c.displayName", "pr.id", "pr.name", "pr.identifier"]);
    if (q.get("status")) qb.andWhere("p.status = :st", { st: oneOf(q.get("status"), "status", PROPOSAL_STATUSES) });
    if (q.get("clientId")) qb.andWhere("p.clientId = :cid", { cid: uuid(q.get("clientId"), "clientId") });
    if (q.get("projectId")) qb.andWhere("p.projectId = :pid", { pid: uuid(q.get("projectId"), "projectId") });
    const s = q.get("search")?.trim();
    if (s) qb.andWhere(new Brackets((w) => w.where("p.title ILIKE :s", { s: `%${s}%` }).orWhere("p.reference ILIKE :s")));
    const [rows, total] = await qb.orderBy("p.updatedAt", "DESC").skip(skip).take(take).getManyAndCount();
    return { data: rows, meta: buildPaginationMeta(total, page, limit) };
  }

  static async get(id: string) {
    const db = await AppDataSource();
    const p = await load(db.manager, id);
    const [client, project, versions, link, acceptances, readiness] = await Promise.all([
      p.clientId ? db.getRepository(Client).findOne({ where: { id: p.clientId } }) : null,
      db.getRepository(Project).findOne({ where: { id: p.projectId } }),
      db.getRepository(ProposalVersion).find({ where: { proposalId: id }, order: { major: "DESC", minor: "DESC" }, select: { id: true, label: true, contentHash: true, changeNote: true, validUntil: true, publishedAt: true } }),
      this.linkStatus(db.manager, id),
      db.getRepository(ProposalAcceptance).find({ where: { proposalId: id }, order: { acceptedAt: "DESC" } }),
      this.readiness(db.manager, p),
    ]);
    return { proposal: p, client, project, versions, link, acceptances, readiness, computed: computePricing(p.draft.pricing), allowedTransitions: allowedTransitions(p.status).filter((t) => MANUAL_TARGETS.includes(t)), draftEditable: isDraftEditable(p.status) };
  }

  static async create(raw: unknown, a: Actor) {
    const b = obj(raw);
    const projectId = uuid(b.projectId, "projectId");
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const project = await m.getRepository(Project).findOne({ where: { id: projectId, isDeleted: false } });
      if (!project) throw notFound("Project");
      const clientId = b.clientId !== undefined ? (b.clientId === null ? null : uuid(b.clientId, "clientId")) : project.clientId;
      const client = clientId ? await m.getRepository(Client).findOne({ where: { id: clientId, isDeleted: false } }) : null;
      if (clientId && !client) throw notFound("Client");
      const settings = await getSettings(m);
      const currency = String(b.currency ?? client?.preferredCurrency ?? settings.defaults.currency);
      if (!isCurrencyCode(currency)) throw new ValidationError("currency: must be a 3-letter code", "currency");
      const tpl = await m.getRepository(DocumentTemplate).findOne({ where: { kind: "proposal", isDefault: true, isDeleted: false } });
      const draft: ProposalDraft = { sections: seedSections(project, settings, tpl), pricing: emptyPricingInput(currency), attachSrs: true, internalNotes: "" };
      const saved = await m.getRepository(Proposal).save(m.getRepository(Proposal).create({
        reference: await nextProposalReference(m, settings), projectId, clientId, currency, status: "draft", draft,
        title: b.title ? str(b.title, "title", { max: 255 }) : `Proposal: ${project.name}`, validityDays: settings.defaults.validityDays,
      }));
      await audit({ action: "proposal.created", entityType: "proposal", entityId: saved.id, metadata: { reference: saved.reference }, ...A(a) }, m);
      return saved;
    });
  }

  /** Title, client, validity, currency. Draft-editable states only. */
  static async updateMeta(id: string, raw: unknown, a: Actor) {
    const b = obj(raw);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const p = await load(m, id, true);
      if (!isDraftEditable(p.status)) throw conflict("This proposal is published. Start a revision to change it.");
      if (b.title !== undefined) p.title = str(b.title, "title", { max: 255 });
      if (b.validityDays !== undefined) p.validityDays = b.validityDays === null ? null : int(b.validityDays, "validityDays", { min: 1, max: 365 });
      if (b.clientId !== undefined) {
        const cid = b.clientId === null ? null : uuid(b.clientId, "clientId");
        if (cid && !(await m.getRepository(Client).findOne({ where: { id: cid, isDeleted: false } }))) throw notFound("Client");
        p.clientId = cid;
      }
      if (b.currency !== undefined && b.currency !== p.currency) {
        const cur = String(b.currency); if (!isCurrencyCode(cur)) throw new ValidationError("currency: must be a 3-letter code", "currency");
        const pr = p.draft.pricing;
        const hasAmounts = pr.implementationFee.amountMinor !== null || pr.services.some((s) => s.options.some((o) => o.amountMinor !== null)) || pr.maintenancePackages.some((x) => x.amountMinor !== null) || pr.otherRecurring.some((x) => x.amountMinor !== null) || pr.paymentSchedule.some((x) => x.amountMinor != null);
        if (hasAmounts) throw conflict("Currency cannot be changed once amounts are entered, because amounts are not converted. Clear the prices first.");
        p.currency = cur; p.draft.pricing = { ...pr, currency: cur };
      }
      p.draftRevision += 1;
      const saved = await m.getRepository(Proposal).save(p);
      await audit({ action: "proposal.meta_updated", entityType: "proposal", entityId: id, metadata: { fields: Object.keys(b) }, ...A(a) }, m);
      return saved;
    });
  }

  static async saveDraft(id: string, raw: unknown, a: Actor) {
    const b = obj(raw);
    const revision = int(b.revision, "revision", { min: 1 });
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const p = await load(m, id, true);
      if (!isDraftEditable(p.status)) throw conflict("This proposal is published. Start a revision to change it.");
      if (p.draftRevision !== revision) throw staleEdit("This proposal was changed elsewhere. Reload it before saving.");
      const draft: ProposalDraft = { ...p.draft };
      if (b.sections !== undefined) draft.sections = sanitizeSections(b.sections);
      if (b.pricing !== undefined) { draft.pricing = sanitizePricing(b.pricing, p.currency); if (draft.pricing.currency !== p.currency) throw badRequest("pricing.currency must equal the proposal currency"); }
      if (b.attachSrs !== undefined) draft.attachSrs = bool(b.attachSrs, "attachSrs");
      if (b.internalNotes !== undefined) draft.internalNotes = str(b.internalNotes, "internalNotes", { optional: true, max: 20000, trim: false });
      p.draft = draft; p.draftRevision += 1;
      if (p.status === "ready_for_review") p.status = "draft"; // editing invalidates "ready"
      const saved = await m.getRepository(Proposal).save(p);
      await audit({ action: "proposal.draft_saved", entityType: "proposal", entityId: id, metadata: { revision: saved.draftRevision }, ...A(a) }, m);
      return { proposal: saved, computed: computePricing(saved.draft.pricing), readiness: await this.readiness(m, saved) };
    });
  }

  /** Calculated totals + readiness + the exact client-facing snapshot as it would look if published now. */
  static async preview(id: string) {
    const db = await AppDataSource();
    const m = db.manager;
    const p = await load(m, id);
    const [client, project] = await Promise.all([p.clientId ? m.getRepository(Client).findOne({ where: { id: p.clientId } }) : null, m.getRepository(Project).findOneOrFail({ where: { id: p.projectId } })]);
    const settings = await getSettings(m);
    const srs = p.draft.attachSrs ? await this.currentSrsPreview(m, p.projectId) : null;
    const snapshot = client ? buildSnapshot(this.sourceFor(p, p.latestVersionLabel ?? "DRAFT", client, project, settings, srs, new Date(), null, "")) : null;
    return { snapshot, computed: computePricing(p.draft.pricing), readiness: await this.readiness(m, p) };
  }

  private static async currentSrsPreview(m: EntityManager, projectId: string) {
    const doc = await m.getRepository(SrsDocument).findOne({ where: { projectId } });
    if (!doc) return null;
    return { label: "draft", contentHash: "", title: doc.title, sections: doc.sections, requirements: await requirementSnapshots(m, projectId) as unknown[] };
  }

  private static sourceFor(p: Proposal, label: string, client: Client, project: Project, s: BusinessSettings, srs: buildSnapshotSrs, publishedAt: Date, validUntil: Date | null, note: string) {
    return {
      reference: p.reference, kind: p.kind, title: p.title, currency: p.currency, draft: p.draft, versionLabel: label, publishedAt, validUntil, changeNote: note,
      business: s.business, portal: s.portal, contractClauses: s.defaults.contractClauses,
      client: { displayName: client.displayName, contactName: client.contactName, organizationName: client.organizationName, email: client.email, phone: client.phone, country: client.country, billingAddress: client.billingAddress, taxId: client.taxId },
      project: { name: project.name, identifier: project.identifier, description: project.description }, srs,
    };
  }

  static async transition(id: string, raw: unknown, a: Actor) {
    const to = oneOf(obj(raw).to, "to", PROPOSAL_STATUSES);
    if (!MANUAL_TARGETS.includes(to)) throw conflict(`Status "${to}" is set by the system (publishing, client actions) and cannot be set manually.`);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const p = await load(m, id, true);
      if (!canTransition(p.status, to)) throw conflict(`A proposal that is "${p.status}" cannot move to "${to}".`);
      const from = p.status; p.status = to;
      if (to === "withdrawn") await m.getRepository(ProposalAccessLink).createQueryBuilder().update().set({ revokedAt: new Date() }).where('"proposalId" = :id AND "revokedAt" IS NULL', { id }).execute();
      const saved = await m.getRepository(Proposal).save(p);
      await audit({ action: "proposal.status_changed", entityType: "proposal", entityId: id, metadata: { from, to }, ...A(a) }, m);
      return saved;
    });
  }

  static async remove(id: string, a: Actor) {
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      const p = await load(m, id, true);
      if (p.latestVersionId || p.status !== "draft") throw conflict("Only never-published draft proposals can be deleted. Withdraw this proposal instead.");
      await m.getRepository(Proposal).update(id, { isDeleted: true });
      await audit({ action: "proposal.deleted", entityType: "proposal", entityId: id, metadata: { reference: p.reference }, ...A(a) }, m);
    });
  }

  /**
   * Freezes the current draft as an immutable, hashed version and makes it available to the client.
   * First publish = 1.0. Later: `bump: "minor"` (1.1) or `"major"` (2.0).
   */
  static async publish(id: string, raw: unknown, a: Actor) {
    const b = obj(raw ?? {});
    const bump = b.bump === "major" ? "major" : "minor";
    const note = str(b.changeNote, "changeNote", { optional: true, max: 3000 });
    const overrides = new Set(strArray(b.overrideWarnings, "overrideWarnings", { max: 50, itemMax: 80 }));
    const db = await AppDataSource();

    return db.transaction(async (m) => {
      const p = await load(m, id, true);
      if (!isDraftEditable(p.status)) throw conflict(`A proposal that is "${p.status}" cannot be published. Start a revision first.`);
      const report = await this.readiness(m, p);
      if (!report.canPublish) throw Object.assign(readinessFailed("This proposal has problems that must be fixed before it can be published."), { details: report });
      const unacknowledged = report.warnings.filter((w) => !overrides.has(w.code));
      if (unacknowledged.length) throw Object.assign(readinessFailed("Review the warnings and confirm them (overrideWarnings) to publish."), { details: { ...report, warnings: unacknowledged } });

      const client = await m.getRepository(Client).findOneOrFail({ where: { id: p.clientId! } });
      const project = await m.getRepository(Project).findOneOrFail({ where: { id: p.projectId } });
      const settings = await getSettings(m);

      let srs: Parameters<typeof buildSnapshot>[0]["srs"] = null;
      if (p.draft.attachSrs) {
        if (!(await m.getRepository(SrsDocument).findOne({ where: { projectId: p.projectId } }))) throw readinessFailed("A requirements document is attached but does not exist yet. Create it, or switch off 'attach requirements'.");
        const v = await SrsService.ensureCurrentVersion(m, p.projectId, `Attached to ${p.reference}`, a);
        srs = { label: v.label, contentHash: v.contentHash, title: v.title, sections: v.sections, requirements: v.requirements };
        await m.getRepository(SrsDocument).update({ projectId: p.projectId }, { clientReviewStatus: "shared" });
      }

      const latest = await m.getRepository(ProposalVersion).findOne({ where: { proposalId: id }, order: { major: "DESC", minor: "DESC" } });
      const ver = nextVersion(latest, bump);
      const publishedAt = new Date();
      const validUntil = p.validityDays ? new Date(publishedAt.getTime() + p.validityDays * 86_400_000) : null;
      const snapshot = buildSnapshot(this.sourceFor(p, ver.label, client, project, settings, srs, publishedAt, validUntil, note));
      const saved = await m.getRepository(ProposalVersion).save(m.getRepository(ProposalVersion).create({
        proposalId: id, major: ver.major, minor: ver.minor, label: ver.label, content: snapshot as unknown as Record<string, unknown>,
        contentHash: contentHash(snapshot), changeNote: note, validUntil, publishedAt,
      }));

      const revised = !!latest;
      p.status = revised ? "revised_sent" : "sent";
      p.latestVersionId = saved.id; p.latestVersionLabel = saved.label; p.validUntil = validUntil; p.sentAt = p.sentAt ?? publishedAt;
      await m.getRepository(Proposal).save(p);

      // A link is created on first publish; revisions reuse the same link (it always serves the latest version).
      let link: { token: string; url: string } | null = null;
      const active = await this.linkStatus(m, id);
      if (!active.active) link = await this.issueLink(m, id, null, a);

      await audit({ action: revised ? "proposal.revised_published" : "proposal.published", entityType: "proposal", entityId: id, metadata: { version: saved.label, hash: saved.contentHash, overridden: [...overrides] }, ...A(a) }, m);
      return { version: { id: saved.id, label: saved.label, contentHash: saved.contentHash, validUntil, publishedAt }, status: p.status, link };
    });
  }

  // ── Secure access link ─────────────────────────────────────────
  private static async issueLink(m: EntityManager, proposalId: string, expiresInDays: number | null, a: Actor) {
    await m.getRepository(ProposalAccessLink).createQueryBuilder().update().set({ revokedAt: new Date() }).where('"proposalId" = :proposalId AND "revokedAt" IS NULL', { proposalId }).execute();
    const token = generateToken();
    const link = await m.getRepository(ProposalAccessLink).save(m.getRepository(ProposalAccessLink).create({
      proposalId, tokenHash: hashToken(token), expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
    }));
    await audit({ action: "proposal.link_issued", entityType: "proposal", entityId: proposalId, metadata: { linkId: link.id }, ...A(a) }, m);
    const base = (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
    return { token, url: `${base}/p/${token}` };
  }

  static async linkStatus(m: EntityManager, proposalId: string) {
    const l = await m.getRepository(ProposalAccessLink).findOne({ where: { proposalId }, order: { createdAt: "DESC" } });
    const active = !!l && !l.revokedAt && (!l.expiresAt || l.expiresAt > new Date());
    return l ? { active, createdAt: l.createdAt, expiresAt: l.expiresAt, revokedAt: l.revokedAt, lastViewedAt: l.lastViewedAt, viewCount: l.viewCount } : { active: false };
  }

  /** Revokes any existing link and returns a NEW one. The raw token is shown once and cannot be retrieved later. */
  static async regenerateLink(id: string, raw: unknown, a: Actor) {
    const days = obj(raw ?? {}).expiresInDays;
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const p = await load(m, id, true);
      if (!p.latestVersionId) throw conflict("Publish the proposal before creating a client link.");
      if (p.status === "withdrawn") throw conflict("This proposal has been withdrawn.");
      return this.issueLink(m, id, days == null ? null : int(days, "expiresInDays", { min: 1, max: 365 }), a);
    });
  }
  static async revokeLink(id: string, a: Actor) {
    const db = await AppDataSource();
    await db.transaction(async (m) => {
      await load(m, id);
      await m.getRepository(ProposalAccessLink).createQueryBuilder().update().set({ revokedAt: new Date() }).where('"proposalId" = :id AND "revokedAt" IS NULL', { id }).execute();
      await audit({ action: "proposal.link_revoked", entityType: "proposal", entityId: id, ...A(a) }, m);
    });
  }

  // ── Versions & acceptance (read) ───────────────────────────────
  static async listVersions(id: string) {
    uuid(id);
    return (await AppDataSource()).getRepository(ProposalVersion).find({ where: { proposalId: id }, order: { major: "DESC", minor: "DESC" }, select: { id: true, label: true, contentHash: true, changeNote: true, validUntil: true, publishedAt: true } });
  }
  static async getVersion(id: string, versionId: string) {
    uuid(id); uuid(versionId);
    const v = await (await AppDataSource()).getRepository(ProposalVersion).findOne({ where: { id: versionId, proposalId: id } });
    if (!v) throw notFound("Version");
    return v;
  }

  /** Side-by-side field changes between two published versions (for the "what changed" screen). */
  static async compareVersions(id: string, fromId: string, toId: string) {
    const [a, b] = await Promise.all([this.getVersion(id, fromId), this.getVersion(id, toId)]);
    const A_ = a.content as unknown as ReturnType<typeof buildSnapshot>; const B_ = b.content as unknown as ReturnType<typeof buildSnapshot>;
    const changedSections = B_.sections.filter((s) => A_.sections.find((x) => x.key === s.key && x.id === s.id)?.body !== s.body || !A_.sections.find((x) => x.id === s.id)).map((s) => s.title);
    const removedSections = A_.sections.filter((s) => !B_.sections.find((x) => x.id === s.id)).map((s) => s.title);
    return {
      from: a.label, to: b.label,
      implementationFee: { from: A_.pricing.implementationFee.amountMinor, to: B_.pricing.implementationFee.amountMinor },
      payableBeforeDevelopment: { from: A_.computed.payableBeforeDevelopment.totalMinor, to: B_.computed.payableBeforeDevelopment.totalMinor },
      annualRecurring: { from: A_.computed.recurring.annualEquivalent.totalMinor, to: B_.computed.recurring.annualEquivalent.totalMinor },
      changedSections, removedSections, pricingChanged: contentHash(A_.pricing) !== contentHash(B_.pricing),
    };
  }

  // ── Amendment after acceptance ─────────────────────────────────
  static async createAmendment(id: string, raw: unknown, a: Actor) {
    const b = obj(raw ?? {});
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const parent = await load(m, id);
      if (parent.status !== "accepted") throw conflict("Only an accepted proposal can be amended.");
      const count = await m.getRepository(Proposal).count({ where: { parentProposalId: id } });
      const copy: ProposalDraft = JSON.parse(JSON.stringify(parent.draft));
      copy.internalNotes = "";
      const saved = await m.getRepository(Proposal).save(m.getRepository(Proposal).create({
        reference: `${parent.reference}-A${count + 1}`, kind: "amendment", parentProposalId: id, projectId: parent.projectId, clientId: parent.clientId,
        currency: parent.currency, status: "draft", draft: copy, validityDays: parent.validityDays,
        title: b.title ? str(b.title, "title", { max: 255 }) : `Amendment ${count + 1}: ${parent.title}`,
      }));
      await audit({ action: "proposal.amendment_created", entityType: "proposal", entityId: saved.id, metadata: { parent: parent.reference }, ...A(a) }, m);
      return saved;
    });
  }

  /** Marks published, un-actioned proposals past their validity date as expired. Safe to run repeatedly (cron). */
  static async expireDue() {
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const rows: { id: string }[] = await m.query(
        `UPDATE proposals SET status = 'expired', "updatedAt" = now() WHERE "isDeleted" = false AND "validUntil" IS NOT NULL AND "validUntil" < now()
         AND status IN ('sent','viewed','clarification_requested','negotiation_requested','revised_sent') RETURNING id`);
      for (const r of rows) await audit({ action: "proposal.expired", entityType: "proposal", entityId: r.id, actorType: "system" }, m);
      return { expired: rows.length };
    });
  }
}
type buildSnapshotSrs = Parameters<typeof buildSnapshot>[0]["srs"];
export { randomUUID };
