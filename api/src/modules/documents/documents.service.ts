import { AppDataSource } from "@/database/data-source";
import { ChangeRequest } from "@/database/entities/ChangeRequest";
import { Client } from "@/database/entities/Client";
import { DocumentTemplate } from "@/database/entities/DocumentTemplate";
import { Milestone } from "@/database/entities/Milestone";
import { Project } from "@/database/entities/Project";
import { Proposal } from "@/database/entities/Proposal";
import { ProposalAcceptance } from "@/database/entities/ProposalAcceptance";
import { ProposalVersion } from "@/database/entities/ProposalVersion";
import { SrsDocument } from "@/database/entities/SrsDocument";
import { SrsVersion } from "@/database/entities/SrsVersion";
import { notFound, badRequest } from "@/lib/errors/appErrors";
import { renderDocument, type Block, type DocModel } from "@/lib/documents/render";
import { formatMoney } from "@/lib/money/money";
import type { CostLine, PricingResult } from "@/lib/pricing/types";
import type { ProposalSnapshot } from "@/lib/proposals/snapshot";
import { getSettings } from "@/lib/settings";
import { requirementSnapshots } from "@/modules/srs/srs.service";
import { ProposalsService } from "@/modules/proposals/proposals.service";
import { oneOf, uuid } from "@/lib/validation/v";

export const DOC_KINDS = ["proposal", "cost_breakdown", "scope", "payment_schedule", "contract", "acceptance_record"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

const PERIOD: Record<string, string> = { one_time: "one-time", monthly: "per month", quarterly: "per quarter", annual: "per year", usage: "usage-based", custom: "custom cycle" };
const STATUS: Record<string, string> = { confirmed: "Confirmed", estimated: "Estimate", unpriced: "Awaiting confirmation" };
const date = (d?: string | Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "-");

function costTable(title: string, lines: CostLine[], cur: string): Block[] {
  if (!lines.length) return [{ type: "h3", text: title }, { type: "md", text: "None." }];
  return [{ type: "h3", text: title }, {
    type: "table", head: ["Item", "Provider", "Billing", "Amount", "Status", "Notes"], right: [3],
    rows: lines.map((l) => [l.label, l.provider ?? "", PERIOD[l.period] + (l.period === "custom" && l.periodMonths ? ` (${l.periodMonths} mo)` : ""), formatMoney(l.totalMinor, cur) + (l.taxMinor ? ` (incl. ${formatMoney(l.taxMinor, cur)} tax/charges)` : ""), STATUS[l.status], [l.paymentDeadline ? `Pay by ${l.paymentDeadline}` : "", l.renewalDate ? `Renews ${l.renewalDate}` : "", l.note ?? ""].filter(Boolean).join(". ")]),
  }];
}

export function costBlocks(c: PricingResult): Block[] {
  const cur = c.currency; const f = (n: number | null) => formatMoney(n, cur);
  const blocks: Block[] = [];
  blocks.push({ type: "h2", text: "Cost breakdown" });
  blocks.push({ type: "note", text: c.provisional ? "**Some figures below are estimates or awaiting confirmation.** Totals marked provisional are not guaranteed and may change when providers confirm prices." : "All figures below are confirmed." });
  blocks.push({ type: "h3", text: "1. Software implementation fee" });
  blocks.push({ type: "kv", rows: [["Implementation and delivery fee", f(c.implementation.amountMinor) + (c.implementation.confirmed ? "" : " (not yet confirmed)")]] });
  blocks.push({ type: "h3", text: "Payment schedule" });
  blocks.push({ type: "table", head: ["Payment", "When", "Share", "Amount"], right: [2, 3], rows: c.implementation.schedule.map((p) => [p.label, [p.condition, p.dueDate ? `Due ${p.dueDate}` : ""].filter(Boolean).join(". ") || p.trigger.replace(/_/g, " "), p.percentBps != null ? `${p.percentBps / 100}%` : "fixed", f(p.amountMinor)]), foot: ["Total", "", "", f(c.implementation.scheduleTotalMinor)] });
  blocks.push(...costTable("2. Initial external service activation costs (paid before development begins)", c.activation.lines, cur));
  blocks.push({ type: "kv", rows: [["Activation total", f(c.activation.total.totalMinor) + (c.activation.total.provisional ? " (provisional)" : "")]] });
  blocks.push({ type: "note", text: "This payment covers only the agreed **initial** service period and activation expenses. It does **not** mean future renewals are free; renewals are listed below." });
  blocks.push(...costTable("3. Future external service renewals, maintenance and other recurring charges", c.recurring.lines, cur));
  const r = c.recurring;
  blocks.push({ type: "table", head: ["Billing period", "Total", "Status"], right: [1], rows: [
    ["Monthly charges", f(r.byPeriod.monthly.totalMinor), r.byPeriod.monthly.provisional ? "Provisional" : "Confirmed"],
    ["Quarterly charges", f(r.byPeriod.quarterly.totalMinor), r.byPeriod.quarterly.provisional ? "Provisional" : "Confirmed"],
    ["Annual charges", f(r.byPeriod.annual.totalMinor), r.byPeriod.annual.provisional ? "Provisional" : "Confirmed"],
    ["Custom-cycle charges", f(r.byPeriod.custom.totalMinor), r.byPeriod.custom.provisional ? "Provisional" : "Confirmed"],
  ] });
  blocks.push({ type: "kv", rows: [
    ["Comparable annual total", f(r.annualEquivalent.totalMinor) + (r.annualEquivalent.provisional ? " (provisional)" : "")],
    ["Comparable monthly average", f(r.monthlyEquivalent.totalMinor) + (r.monthlyEquivalent.approximate ? " (rounded)" : "") + (r.monthlyEquivalent.provisional ? " (provisional)" : "")],
    ["of which services / maintenance / other (annual)", `${f(r.components.services.totalMinor)} / ${f(r.components.maintenance.totalMinor)} / ${f(r.components.other.totalMinor)}`],
  ] });
  if (c.usage.lines.length) { blocks.push(...costTable("4. Variable, usage-based costs (estimates only)", c.usage.lines, cur)); }
  const opt = c.optional;
  if (opt.enhancements.length || opt.services.length) {
    blocks.push({ type: "h3", text: "5. Optional enhancements (not included in any total)" });
    blocks.push({ type: "table", head: ["Item", "Price", "Status"], right: [1], rows: [...opt.enhancements.map((e) => [e.name, f(e.amountMinor), STATUS[e.status]]), ...opt.services.map((s) => [s.label, f(s.totalMinor), STATUS[s.status]])] });
  }
  blocks.push({ type: "h3", text: "Payable before development begins" });
  blocks.push({ type: "kv", rows: [["Implementation deposit", f(c.payableBeforeDevelopment.implementationDepositMinor)], ["Initial service activation", f(c.payableBeforeDevelopment.activation.totalMinor)], ["Total before development", f(c.payableBeforeDevelopment.totalMinor) + (c.payableBeforeDevelopment.provisional ? " (provisional)" : "")]] });
  return blocks;
}

const sec = (s: ProposalSnapshot, key: string) => s.sections.find((x) => x.key === key);
const sectionBlocks = (s: ProposalSnapshot, keys?: string[]): Block[] =>
  s.sections.filter((x) => (!keys || keys.includes(x.key)) && x.body.trim()).flatMap<Block>((x) => [{ type: "h2", text: x.title }, { type: "md", text: x.body }]);

function base(s: ProposalSnapshot, title: string, watermark?: string): DocModel {
  return {
    title, subtitle: s.title, watermark, accent: s.portal.accentColor, business: s.business, footerNote: s.portal.footerNote,
    meta: [["Reference", s.reference], ["Version", s.versionLabel], ["Date", date(s.publishedAt)], ["Valid until", date(s.validUntil)], ["Client", s.client.displayName], ["Project", s.project.name]],
    blocks: [],
  };
}

export function buildFromSnapshot(kind: DocKind, s: ProposalSnapshot, o: { draft?: boolean; acceptance?: ProposalAcceptance | null } = {}): DocModel {
  const wm = o.draft ? "DRAFT" : undefined;
  switch (kind) {
    case "proposal": {
      const d = base(s, "Project Proposal", wm);
      d.blocks.push({ type: "kv", rows: [["Prepared for", `${s.client.displayName} (${s.client.contactName}, ${s.client.email})`], ["Project", s.project.name]] });
      if (s.changeNote) d.blocks.push({ type: "note", text: `**Changes in this version:** ${s.changeNote}` });
      const order = ["executive_summary", "business_problem", "proposed_solution", "scope", "deliverables", "exclusions", "future_enhancements", "approach", "technology", "security", "deployment", "timeline"];
      const rest = ["client_responsibilities", "developer_responsibilities", "acceptance_criteria", "ip_ownership", "confidentiality", "warranty", "support", "change_requests", "termination", "validity", "acceptance_instructions"];
      d.blocks.push(...sectionBlocks(s, order), ...costBlocks(s.computed), ...sectionBlocks(s, rest));
      const known = new Set([...order, ...rest]);
      d.blocks.push(...s.sections.filter((x) => !known.has(x.key) && x.body.trim()).flatMap<Block>((x) => [{ type: "h2", text: x.title }, { type: "md", text: x.body }]));
      if (s.srs) d.blocks.push({ type: "note", text: `The requirements document **${s.srs.title}** (version ${s.srs.label}) forms part of this proposal and is available for review.` });
      d.blocks.push({ type: "h2", text: "Acknowledgment" }, { type: "md", text: "Acceptance is recorded when an authorised representative confirms this exact version through the secure proposal link, or by signing below. An online acknowledgment records agreement to this version; a separate signed agreement may also be required." }, { type: "signature", parties: [`For ${s.client.displayName}`, `For ${s.business.name || "the developer"}`] });
      return d;
    }
    case "cost_breakdown": { const d = base(s, "Cost Breakdown", wm); d.blocks.push(...costBlocks(s.computed)); return d; }
    case "scope": {
      const d = base(s, "Project Scope and Exclusions", wm);
      d.blocks.push(...sectionBlocks(s, ["scope", "deliverables", "exclusions", "future_enhancements", "acceptance_criteria"]));
      return d;
    }
    case "payment_schedule": {
      const d = base(s, "Payment Schedule", wm); const c = s.computed; const f = (n: number | null) => formatMoney(n, c.currency);
      d.blocks.push({ type: "table", head: ["Payment", "When", "Share", "Amount"], right: [2, 3], rows: c.implementation.schedule.map((p) => [p.label, [p.condition, p.dueDate ? `Due ${p.dueDate}` : ""].filter(Boolean).join(". ") || p.trigger.replace(/_/g, " "), p.percentBps != null ? `${p.percentBps / 100}%` : "fixed", f(p.amountMinor)]), foot: ["Total", "", "", f(c.implementation.scheduleTotalMinor)] });
      d.blocks.push({ type: "note", text: "Initial external service costs are payable separately before development begins. See the cost breakdown." });
      return d;
    }
    case "contract": {
      const d = base(s, "Agreement (Draft)", "DRAFT");
      d.blocks.push({ type: "note", tone: "warn", text: "**DRAFT: not a signed contract.** This agreement is generated from the terms of proposal " + s.reference + " version " + s.versionLabel + (o.acceptance ? ", which the client has accepted" : ", which has not yet been accepted") + ". It must be reviewed (including, where appropriate, by a qualified lawyer) and signed before it takes effect. It does not claim compliance with any particular law." });
      d.blocks.push({ type: "h2", text: "Parties" }, { type: "kv", rows: [["Developer", [s.business.legalName || s.business.name, s.business.address].filter(Boolean).join(", ") || "-"], ["Client", [s.client.organizationName || s.client.displayName, s.client.billingAddress, s.client.taxId ? `Tax ID ${s.client.taxId}` : ""].filter(Boolean).join(", ")]] });
      d.blocks.push(...sectionBlocks(s, ["scope", "deliverables", "exclusions", "timeline", "client_responsibilities", "developer_responsibilities", "acceptance_criteria"]));
      d.blocks.push(...costBlocks(s.computed));
      d.blocks.push(...sectionBlocks(s, ["ip_ownership", "confidentiality", "warranty", "support", "change_requests", "termination"]));
      if (s.contractClauses.length) d.blocks.push({ type: "h2", text: "General clauses" }, ...s.contractClauses.flatMap<Block>((c) => [{ type: "h3", text: c.title }, { type: "md", text: c.body }]));
      d.blocks.push({ type: "h2", text: "Signatures" }, { type: "signature", parties: [`For ${s.client.displayName}`, `For ${s.business.name || "the developer"}`] });
      return d;
    }
    case "acceptance_record": {
      const a = o.acceptance; if (!a) throw badRequest("This proposal has not been accepted yet.");
      const d = base(s, "Acceptance Record");
      d.blocks.push({ type: "kv", rows: [["Proposal", a.proposalReference], ["Version accepted", a.versionLabel], ["Accepted by", `${a.acceptedByName}${a.acceptedByTitle ? ", " + a.acceptedByTitle : ""}`], ["Email", a.acceptedByEmail], ["Organisation", a.organization ?? "-"], ["Accepted at (UTC)", new Date(a.acceptedAt).toISOString()], ["Method", "Online acknowledgment via secure link"], ["IP address", a.ipAddress ?? "-"], ["Content fingerprint (SHA-256)", a.contentHash]] });
      d.blocks.push({ type: "h3", text: "Statement agreed to" }, { type: "md", text: a.statement });
      d.blocks.push({ type: "note", text: "The fingerprint identifies the exact content of the version accepted. It is evidence of which terms were presented, not a guarantee of legal effect." });
      return d;
    }
  }
}

export class DocumentsService {
  static html(model: DocModel) { return renderDocument(model); }

  /** Admin: render any stored version, or "draft" for the live working copy (watermarked DRAFT). */
  static async proposalDocument(id: string, kindRaw: string | null, versionRaw: string | null) {
    const kind = oneOf(kindRaw ?? "proposal", "kind", DOC_KINDS);
    const db = await AppDataSource();
    const p = await db.getRepository(Proposal).findOne({ where: { id: uuid(id), isDeleted: false } });
    if (!p) throw notFound("Proposal");
    const acceptance = await db.getRepository(ProposalAcceptance).findOne({ where: { proposalId: id }, order: { acceptedAt: "DESC" } });
    if (versionRaw === "draft") {
      const pv = await ProposalsService.preview(id);
      if (!pv.snapshot) throw badRequest("Attach a client to the proposal to preview it.");
      return renderDocument(buildFromSnapshot(kind, pv.snapshot, { draft: true, acceptance }));
    }
    const vid = versionRaw && versionRaw !== "latest" ? uuid(versionRaw, "version") : p.latestVersionId;
    if (!vid) throw badRequest("This proposal has no published version yet. Use version=draft to preview the working copy.");
    const v = await db.getRepository(ProposalVersion).findOne({ where: { id: vid, proposalId: id } });
    if (!v) throw notFound("Version");
    return renderDocument(buildFromSnapshot(kind, v.content as unknown as ProposalSnapshot, { acceptance: acceptance && acceptance.versionId === v.id ? acceptance : kind === "acceptance_record" ? acceptance : acceptance }));
  }

  static async srsDocument(projectId: string, versionId: string | null) {
    const db = await AppDataSource(); uuid(projectId);
    const project = await db.getRepository(Project).findOne({ where: { id: projectId, isDeleted: false } });
    if (!project) throw notFound("Project");
    const client = project.clientId ? await db.getRepository(Client).findOne({ where: { id: project.clientId } }) : null;
    const settings = await getSettings();
    let title: string, sections: { title: string; body: string; clientVisible?: boolean }[], reqs: Awaited<ReturnType<typeof requirementSnapshots>>, label: string, watermark: string | undefined, when: Date;
    if (versionId && versionId !== "draft") {
      const v = await db.getRepository(SrsVersion).findOne({ where: { id: uuid(versionId, "version"), projectId } });
      if (!v) throw notFound("Version");
      ({ title, sections, requirements: reqs, label } = { ...v, requirements: v.requirements as never }); when = v.createdAt;
    } else {
      const doc = await db.getRepository(SrsDocument).findOne({ where: { projectId } });
      if (!doc) throw notFound("Requirements document");
      title = doc.title; sections = doc.sections; reqs = await requirementSnapshots(db.manager, projectId); label = "Working draft"; watermark = "DRAFT"; when = doc.updatedAt;
    }
    const blocks: Block[] = sections.filter((s) => s.clientVisible !== false).flatMap<Block>((s) => [{ type: "h2", text: s.title }, ...(s.body.trim() ? [{ type: "md", text: s.body } as Block] : [])]);
    if (reqs.length) {
      blocks.push({ type: "h2", text: "Requirements register" });
      blocks.push({ type: "table", head: ["ID", "Requirement", "Priority", "Depends on", "Acceptance criteria"], rows: reqs.map((r) => [r.code, `**${r.title}**${r.description ? "<br>" : ""}${r.description}`.replace(/<br>/g, " — "), r.priority.toUpperCase(), r.dependencies.join(", ") || "-", r.acceptanceCriteria.map((c) => `• ${c}`).join(" ") || "-"]) });
    }
    return renderDocument({ title, subtitle: project.name, watermark, business: settings.business, accent: settings.portal.accentColor, footerNote: settings.portal.footerNote, meta: [["Project", project.name], ["Version", label], ["Date", date(when)], ["Client", client?.displayName ?? "-"]], blocks });
  }

  static async changeRequestDocument(id: string) {
    const db = await AppDataSource();
    const cr = await db.getRepository(ChangeRequest).findOne({ where: { id: uuid(id), isDeleted: false } });
    if (!cr) throw notFound("Change request");
    const project = await db.getRepository(Project).findOneOrFail({ where: { id: cr.projectId } });
    const settings = await getSettings();
    return renderDocument({
      title: "Change Request", subtitle: cr.title, watermark: cr.status === "draft" ? "DRAFT" : undefined, business: settings.business, accent: settings.portal.accentColor,
      meta: [["Project", project.name], ["Status", cr.status], ["Requested by", cr.requestedBy || "-"], ["Date", date(cr.createdAt)]],
      blocks: [{ type: "h2", text: "Requested change" }, { type: "md", text: cr.description }, { type: "h2", text: "Additional work required" }, { type: "md", text: cr.additionalWork || "To be described." },
        { type: "h2", text: "Estimate and timeline" }, { type: "kv", rows: [["Estimated cost", formatMoney(cr.estimateMinor, cr.currency)], ["Effect on timeline", cr.timelineImpact || "To be confirmed"]] },
        { type: "note", text: "This work will **not** begin until this change request is approved in writing (by acceptance of an amendment proposal)." }, { type: "signature", parties: ["Client approval", "Developer"] }],
    });
  }

  static async handoverChecklist(projectId: string) {
    const db = await AppDataSource(); uuid(projectId);
    const project = await db.getRepository(Project).findOne({ where: { id: projectId, isDeleted: false } });
    if (!project) throw notFound("Project");
    const settings = await getSettings();
    const tpl = await db.getRepository(DocumentTemplate).findOne({ where: { kind: "handover_checklist", isDefault: true, isDeleted: false } });
    const milestones = await db.getRepository(Milestone).find({ where: { projectId, isDeleted: false }, order: { sortOrder: "ASC" } });
    const items = tpl?.sections?.length ? tpl.sections : [{ key: "deliverables", title: "Deliverables received", body: (project.lists?.deliverables ?? []).map((d) => `- [ ] ${d}`).join("\n") }, { key: "access", title: "Access and credentials transferred", body: "- [ ] Hosting\n- [ ] Domain\n- [ ] Database\n- [ ] Third-party services" }, { key: "docs", title: "Documentation handed over", body: "- [ ] User guide\n- [ ] Technical notes" }, { key: "acceptance", title: "Acceptance testing completed", body: "- [ ] Acceptance criteria verified" }];
    return renderDocument({
      title: "Handover Checklist", subtitle: project.name, business: settings.business, accent: settings.portal.accentColor,
      meta: [["Project", project.name], ["Warranty", project.terms?.warranty ? "As per agreed terms" : "Not specified"]],
      blocks: [...items.flatMap<Block>((i) => [{ type: "h2", text: i.title }, { type: "md", text: i.body.replace(/- \[ \]/g, "-  ☐") }]), ...(milestones.length ? [{ type: "h2", text: "Milestones" } as Block, { type: "table", head: ["Milestone", "Due", "Status"], rows: milestones.map((m) => [m.title, m.dueDate ?? "-", m.status]) } as Block] : []), { type: "signature", parties: ["Client", "Developer"] }],
    });
  }
}
