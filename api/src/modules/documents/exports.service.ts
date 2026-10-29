import { AppDataSource } from "@/database/data-source";
import { Proposal } from "@/database/entities/Proposal";
import { ProposalVersion } from "@/database/entities/ProposalVersion";
import { notFound } from "@/lib/errors/appErrors";
import type { ProposalSnapshot } from "@/lib/proposals/snapshot";
import { uuid } from "@/lib/validation/v";

// Guard against spreadsheet formula injection (=, +, -, @ at start of a cell).
const cell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
const money = (n: number | null, digits = 2) => (n === null ? "" : (n / 10 ** digits).toFixed(digits));
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export class ExportsService {
  /** One row per cost line of a published version. Amounts are in major units for spreadsheets. */
  static async costLinesCsv(proposalId: string, versionId: string | null) {
    const db = await AppDataSource();
    const p = await db.getRepository(Proposal).findOne({ where: { id: uuid(proposalId), isDeleted: false } });
    if (!p) throw notFound("Proposal");
    const vid = versionId ?? p.latestVersionId;
    const v = vid ? await db.getRepository(ProposalVersion).findOne({ where: { id: uuid(vid, "version"), proposalId } }) : null;
    if (!v) throw notFound("Version");
    const s = v.content as unknown as ProposalSnapshot; const c = s.computed;
    const rows: unknown[][] = [["Group", "Item", "Provider", "Billing period", "Amount", "Tax/other", "Total", "Status", "Currency", "Renewal date"]];
    rows.push(["Implementation", "Implementation fee", "", "", money(c.implementation.amountMinor), "", money(c.implementation.amountMinor), c.implementation.confirmed ? "confirmed" : "unconfirmed", s.currency, ""]);
    for (const x of c.implementation.schedule) rows.push(["Payment schedule", x.label, "", x.trigger, money(x.amountMinor), "", money(x.amountMinor), "", s.currency, x.dueDate ?? ""]);
    const add = (g: string, ls: typeof c.activation.lines) => ls.forEach((l) => rows.push([g, l.label, l.provider ?? "", l.period, money(l.amountMinor), money(l.taxMinor), money(l.totalMinor), l.status, s.currency, l.renewalDate ?? ""]));
    add("Activation", c.activation.lines); add("Recurring", c.recurring.lines); add("Usage (variable)", c.usage.lines);
    return { filename: `${p.reference}-v${v.label}-costs.csv`, csv: toCsv(rows) };
  }

  static async proposalsCsv() {
    const list = await (await AppDataSource()).getRepository(Proposal).find({ where: { isDeleted: false }, order: { createdAt: "DESC" }, relations: { client: true, project: true } });
    return toCsv([["Reference", "Title", "Client", "Project", "Status", "Version", "Valid until", "Accepted at"], ...list.map((p) => [p.reference, p.title, p.client?.displayName ?? "", p.project?.name ?? "", p.status, p.latestVersionLabel ?? "", p.validUntil?.toISOString().slice(0, 10) ?? "", p.acceptedAt?.toISOString() ?? ""])]);
  }
}
