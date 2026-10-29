import { In, type EntityManager } from "typeorm";
import { AppDataSource } from "@/database/data-source";
import { NegotiationMessage } from "@/database/entities/NegotiationMessage";
import { NegotiationRequest, NEGOTIATION_KINDS } from "@/database/entities/NegotiationRequest";
import { PaymentRecord } from "@/database/entities/PaymentRecord";
import { Proposal } from "@/database/entities/Proposal";
import { ProposalAcceptance } from "@/database/entities/ProposalAcceptance";
import { ProposalAccessLink } from "@/database/entities/ProposalAccessLink";
import { ProposalVersion } from "@/database/entities/ProposalVersion";
import { SrsDocument } from "@/database/entities/SrsDocument";
import { audit } from "@/lib/audit/audit";
import { badRequest, linkInvalid, notActionable, notFound } from "@/lib/errors/appErrors";
import { computePricing } from "@/lib/pricing/engine";
import type { PricingInput } from "@/lib/pricing/types";
import { acceptanceStatement, type ProposalSnapshot } from "@/lib/proposals/snapshot";
import { isClientOpen, type ProposalStatus } from "@/lib/proposals/stateMachine";
import { hashToken, looksLikeToken } from "@/lib/security/tokens";
import { bool, email, int, minorOrNull, obj, oneOf, str, strArray, uuid, ValidationError } from "@/lib/validation/v";

type Meta = { ipAddress?: string; userAgent?: string };

/**
 * Public client portal. Everything returned here comes from the frozen, client-safe snapshot of the LATEST
 * published version, plus the client-visible negotiation thread. The raw token is never stored or logged.
 */
export class PortalService {
  /** Same error for unknown, revoked and expired links, so nothing can be probed. */
  private static async resolve(m: EntityManager, token: unknown) {
    if (!looksLikeToken(token)) throw linkInvalid();
    const link = await m.getRepository(ProposalAccessLink).findOne({ where: { tokenHash: hashToken(token) } });
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) throw linkInvalid();
    let p = await m.getRepository(Proposal).findOne({ where: { id: link.proposalId, isDeleted: false } });
    if (!p || !p.latestVersionId || p.status === "withdrawn") throw linkInvalid();
    // Lazy expiry: correct even if the scheduled sweep has not run yet.
    if (p.validUntil && p.validUntil < new Date() && isClientOpen(p.status)) {
      await m.getRepository(Proposal).update(p.id, { status: "expired" });
      await audit({ action: "proposal.expired", entityType: "proposal", entityId: p.id, actorType: "system" }, m);
      p = { ...p, status: "expired" } as Proposal;
    }
    const version = await m.getRepository(ProposalVersion).findOneOrFail({ where: { id: p.latestVersionId! } });
    return { link, proposal: p, version, snapshot: version.content as unknown as ProposalSnapshot };
  }

  static async view(token: string, meta: Meta) {
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const { link, proposal: p, version, snapshot } = await this.resolve(m, token);
      await m.getRepository(ProposalAccessLink).update(link.id, { lastViewedAt: new Date(), viewCount: () => '"viewCount" + 1' as never });
      if (p.status === "sent" || p.status === "revised_sent") {
        await m.getRepository(Proposal).update(p.id, { status: "viewed" });
        p.status = "viewed";
        await audit({ action: "proposal.viewed", entityType: "proposal", entityId: p.id, actorType: "client", metadata: { version: version.label }, ...meta }, m);
      }
      const requests = await m.getRepository(NegotiationRequest).find({ where: { proposalId: p.id, isDeleted: false }, order: { createdAt: "DESC" } });
      const ids = requests.map((r) => r.id);
      const msgs = ids.length ? await m.getRepository(NegotiationMessage).createQueryBuilder("x").where("x.requestId IN (:...ids) AND x.visibility = 'client'", { ids }).orderBy("x.createdAt", "ASC").getMany() : [];
      const acceptance = await m.getRepository(ProposalAcceptance).findOne({ where: { proposalId: p.id }, order: { acceptedAt: "DESC" } });
      return {
        status: p.status as ProposalStatus,
        canRespond: isClientOpen(p.status),
        version: { id: version.id, label: version.label, contentHash: version.contentHash, publishedAt: version.publishedAt, validUntil: version.validUntil },
        proposal: snapshot,
        // Explicit allow-list: only these fields leave the server (no internal notes, resolution is the client-facing note).
        requests: requests.map((r) => ({
          id: r.id, kind: r.kind, status: r.status, subject: r.subject, message: r.message, versionLabel: r.versionLabel, createdAt: r.createdAt, resolutionNote: r.resolutionNote,
          messages: msgs.filter((x) => x.requestId === r.id).map((x) => ({ id: x.id, author: x.author, body: x.body, createdAt: x.createdAt })),
        })),
        acceptance: acceptance ? { versionLabel: acceptance.versionLabel, acceptedByName: acceptance.acceptedByName, acceptedAt: acceptance.acceptedAt, contentHash: acceptance.contentHash } : null,
        acceptanceStatementTemplate: acceptanceStatement({ name: "[your full name]", organization: snapshot.client.organizationName, reference: snapshot.reference, versionLabel: version.label }),
      };
    });
  }

  /** Recalculate totals for hypothetical option choices WITHOUT saving anything or changing the quote. */
  static async previewSelection(token: string, raw: unknown) {
    const db = await AppDataSource();
    const { snapshot } = await this.resolve(db.manager, token);
    const sel = this.parseSelections(raw, snapshot.pricing);
    const alt: PricingInput = JSON.parse(JSON.stringify(snapshot.pricing));
    for (const s of sel.services) alt.services.find((x) => x.id === s.itemId)!.selectedOptionId = s.optionId;
    if (sel.maintenancePackageId) alt.maintenancePackages.forEach((x) => (x.selected = x.id === sel.maintenancePackageId));
    return {
      current: snapshot.computed, requested: computePricing(alt), awaitingDeveloperApproval: true,
      notice: "These figures are for comparison only. Your selection is not applied until it is submitted as a request and a revised proposal is issued and accepted.",
    };
  }

  private static parseSelections(raw: unknown, pricing: PricingInput) {
    const b = obj(raw);
    const services = (Array.isArray(b.services) ? b.services : []).slice(0, 50).map((x, i) => {
      const o = obj(x, `services[${i}]`); const itemId = str(o.itemId, "itemId", { max: 64 }); const optionId = str(o.optionId, "optionId", { max: 64 });
      const svc = pricing.services.find((s) => s.id === itemId);
      if (!svc || !svc.clientSelectable) throw new ValidationError("That service cannot be changed by the client.", "itemId");
      if (!svc.options.some((op) => op.id === optionId)) throw new ValidationError("That option is not offered.", "optionId");
      return { itemId, optionId };
    });
    let maintenancePackageId: string | null = null;
    if (b.maintenancePackageId) {
      maintenancePackageId = str(b.maintenancePackageId, "maintenancePackageId", { max: 64 });
      if (!pricing.maintenancePackages.some((x) => x.id === maintenancePackageId && x.clientSelectable)) throw new ValidationError("That maintenance package cannot be selected.", "maintenancePackageId");
    }
    if (!services.length && !maintenancePackageId) throw new ValidationError("Choose at least one option.", "services");
    return { services, maintenancePackageId };
  }

  /** Client request: clarification, scope/price/payment change, option selection or general comment. Never alters terms. */
  static async submitRequest(token: string, raw: unknown, meta: Meta) {
    const b = obj(raw);
    const kind = oneOf(b.kind, "kind", NEGOTIATION_KINDS);
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const { proposal: p, version, snapshot } = await this.resolve(m, token);
      if (!isClientOpen(p.status)) throw notActionable("This proposal is no longer open for requests.");
      let selections: Record<string, unknown> | null = null;
      if (kind === "service_selection") {
        const sel = this.parseSelections(b, snapshot.pricing);
        const alt: PricingInput = JSON.parse(JSON.stringify(snapshot.pricing));
        for (const s of sel.services) alt.services.find((x) => x.id === s.itemId)!.selectedOptionId = s.optionId;
        if (sel.maintenancePackageId) alt.maintenancePackages.forEach((x) => (x.selected = x.id === sel.maintenancePackageId));
        const r = computePricing(alt);
        selections = { ...sel, provisionalTotals: { payableBeforeDevelopmentMinor: r.payableBeforeDevelopment.totalMinor, annualRecurringMinor: r.recurring.annualEquivalent.totalMinor, provisional: r.provisional }, status: "awaiting_developer_approval" };
      }
      const created = await m.getRepository(NegotiationRequest).save(m.getRepository(NegotiationRequest).create({
        proposalId: p.id, versionId: version.id, versionLabel: version.label, kind, status: "open",
        subject: str(b.subject, "subject", { max: 255 }), message: str(b.message, "message", { max: 10000 }),
        reason: b.reason ? str(b.reason, "reason", { max: 10000 }) : null,
        proposedBudgetMinor: minorOrNull(b.proposedBudgetMinor, "proposedBudgetMinor"),
        proposedPaymentTerms: b.proposedPaymentTerms ? str(b.proposedPaymentTerms, "proposedPaymentTerms", { max: 5000 }) : null,
        selections, submittedByName: str(b.name, "name", { max: 255 }), submittedByEmail: email(b.email, "email").toLowerCase(),
      }));
      const next: ProposalStatus = kind === "clarification" ? "clarification_requested" : "negotiation_requested";
      if (p.status !== next && !(p.status === "negotiation_requested" && next === "clarification_requested")) await m.getRepository(Proposal).update(p.id, { status: next });
      if (kind === "scope_change") await m.getRepository(SrsDocument).update({ projectId: p.projectId }, { clientReviewStatus: "changes_requested" });
      await audit({ action: "negotiation.submitted", entityType: "negotiation", entityId: created.id, actorType: "client", metadata: { kind, proposalId: p.id, version: version.label }, ...meta }, m);
      return { id: created.id, status: created.status, notice: "Your request has been sent. The proposal terms do not change unless a revised proposal is issued and you accept it." };
    });
  }

  static async addMessage(token: string, requestId: string, raw: unknown, meta: Meta) {
    uuid(requestId);
    const body = str(obj(raw).body, "body", { max: 10000 });
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const { proposal: p } = await this.resolve(m, token);
      const r = await m.getRepository(NegotiationRequest).findOne({ where: { id: requestId, proposalId: p.id, isDeleted: false } }); // scoped to THIS proposal
      if (!r) throw notFound("Request");
      if (r.status === "closed") throw notActionable("This request is closed.");
      const msg = await m.getRepository(NegotiationMessage).save(m.getRepository(NegotiationMessage).create({ requestId, author: "client", visibility: "client", body }));
      if (r.status === "answered") await m.getRepository(NegotiationRequest).update(r.id, { status: "open" });
      await audit({ action: "negotiation.client_message", entityType: "negotiation", entityId: requestId, actorType: "client", ...meta }, m);
      return { id: msg.id };
    });
  }

  /**
   * Explicit acceptance of the exact version on screen. The client must echo the version id and content hash they
   * were shown; if the proposal was revised in the meantime, acceptance is refused so no one agrees to terms they did not see.
   */
  static async accept(token: string, raw: unknown, meta: Meta) {
    const b = obj(raw);
    const name = str(b.name, "name", { min: 2, max: 255 });
    const mail = email(b.email, "email").toLowerCase();
    if (b.confirm !== true) throw new ValidationError("confirm: you must tick the confirmation to accept.", "confirm");
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const { link, proposal: p0, version } = await this.resolve(m, token);
      const p = await m.getRepository(Proposal).findOneOrFail({ where: { id: p0.id }, lock: { mode: "pessimistic_write" } });
      if (!isClientOpen(p.status)) throw notActionable(p.status === "accepted" ? "This proposal has already been accepted." : "This proposal can no longer be accepted online.");
      if (p.validUntil && p.validUntil < new Date()) throw notActionable("This proposal has expired.");
      if (b.versionId !== version.id || b.contentHash !== version.contentHash) throw notActionable("This proposal has been updated since you opened it. Please reload and review the latest version.");
      const snapshot = version.content as unknown as ProposalSnapshot;
      const org = b.organization ? str(b.organization, "organization", { max: 255 }) : snapshot.client.organizationName;
      const statement = acceptanceStatement({ name, organization: org, reference: snapshot.reference, versionLabel: version.label });
      const acc = await m.getRepository(ProposalAcceptance).save(m.getRepository(ProposalAcceptance).create({
        proposalId: p.id, versionId: version.id, versionLabel: version.label, proposalReference: p.reference, contentHash: version.contentHash,
        acceptedByName: name, acceptedByEmail: mail, acceptedByTitle: b.title ? str(b.title, "title", { max: 255 }) : null, organization: org ?? null,
        statement, method: "web_acknowledgment", ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent?.slice(0, 500) ?? null, accessLinkId: link.id,
      }));
      await m.getRepository(Proposal).update(p.id, { status: "accepted", acceptedAt: acc.acceptedAt });
      await m.getRepository(NegotiationRequest).update({ proposalId: p.id, status: In(["open", "answered"]) }, { status: "closed", resolvedAt: new Date(), resolutionNote: "Closed automatically because the proposal was accepted." });
      await m.getRepository(SrsDocument).update({ projectId: p.projectId }, { clientReviewStatus: "approved" });
      await this.createPaymentRecords(m, p.id, version.id, snapshot);
      await audit({ action: "proposal.accepted", entityType: "proposal", entityId: p.id, actorType: "client", metadata: { version: version.label, hash: version.contentHash, by: name, email: mail }, ...meta }, m);
      return { acceptedAt: acc.acceptedAt, versionLabel: version.label, contentHash: version.contentHash, statement };
    });
  }

  static async reject(token: string, raw: unknown, meta: Meta) {
    const b = obj(raw);
    const reason = str(b.reason, "reason", { optional: true, max: 5000 });
    const db = await AppDataSource();
    return db.transaction(async (m) => {
      const { proposal: p0, version } = await this.resolve(m, token);
      const p = await m.getRepository(Proposal).findOneOrFail({ where: { id: p0.id }, lock: { mode: "pessimistic_write" } });
      if (!isClientOpen(p.status)) throw notActionable("This proposal is no longer open.");
      await m.getRepository(Proposal).update(p.id, { status: "rejected" });
      await audit({ action: "proposal.rejected", entityType: "proposal", entityId: p.id, actorType: "client", metadata: { version: version.label, reason }, ...meta }, m);
      return { status: "rejected" };
    });
  }

  /** Turns the accepted version's schedule into trackable payment rows. Bookkeeping only; no payment is processed. */
  private static async createPaymentRecords(m: EntityManager, proposalId: string, versionId: string, s: ProposalSnapshot) {
    const repo = m.getRepository(PaymentRecord);
    for (const item of s.computed.implementation.schedule)
      await repo.save(repo.create({ proposalId, versionId, itemKey: item.id, label: item.label, amountMinor: item.amountMinor, currency: s.currency, dueDate: item.dueDate ?? null }));
    if (s.computed.activation.lines.length)
      await repo.save(repo.create({ proposalId, versionId, itemKey: "activation", label: "Initial external service activation costs", amountMinor: s.computed.activation.total.provisional ? null : s.computed.activation.total.totalMinor, currency: s.currency, notes: s.computed.activation.total.provisional ? "Total includes estimates or unconfirmed prices; confirm the final amount before invoicing." : null }));
  }

  /** The token also unlocks the printable documents for this proposal only. */
  static async snapshotFor(token: string) {
    const db = await AppDataSource();
    const r = await this.resolve(db.manager, token);
    const acceptance = await db.getRepository(ProposalAcceptance).findOne({ where: { proposalId: r.proposal.id }, order: { acceptedAt: "DESC" } });
    return { snapshot: r.snapshot, version: r.version, acceptance };
  }
}
export { bool, int, strArray };
