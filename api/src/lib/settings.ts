import { AppDataSource } from "@/database/data-source";
import { Setting } from "@/database/entities/Setting";
import { Counter } from "@/database/entities/Counter";
import { audit } from "@/lib/audit/audit";
import { isCurrencyCode } from "@/lib/money/money";
import { int, obj, optStr, str, strArray, ValidationError, bool } from "@/lib/validation/v";
import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";

export interface BusinessSettings {
  business: { name: string; legalName: string; email: string; phone: string; website: string; address: string; logoDataUrl: string; registrationNumber: string; taxNumber: string };
  defaults: {
    currency: string; validityDays: number; paymentTerms: string; warrantyTerms: string; ipTerms: string; confidentialityTerms: string;
    changeRequestPolicy: string; terminationTerms: string; supportTerms: string; contractClauses: { id: string; title: string; body: string }[];
  };
  numbering: { proposalPrefix: string; padding: number; includeYear: boolean };
  portal: { accentColor: string; tagline: string; footerNote: string };
  notifications: { notifyEmail: string; emailOnClientActivity: boolean };
}

// Empty by design: nothing about your business is invented. Registration/tax numbers print only if you enter them.
export const DEFAULT_SETTINGS: BusinessSettings = {
  business: { name: "", legalName: "", email: "", phone: "", website: "", address: "", logoDataUrl: "", registrationNumber: "", taxNumber: "" },
  defaults: { currency: "GHS", validityDays: 30, paymentTerms: "", warrantyTerms: "", ipTerms: "", confidentialityTerms: "", changeRequestPolicy: "", terminationTerms: "", supportTerms: "", contractClauses: [] },
  numbering: { proposalPrefix: "PRP", padding: 4, includeYear: true },
  portal: { accentColor: "#1f6b57", tagline: "", footerNote: "" },
  notifications: { notifyEmail: "", emailOnClientActivity: false },
};

const KEY = "business";

export async function getSettings(manager?: EntityManager): Promise<BusinessSettings> {
  const em = manager ?? (await AppDataSource()).manager;
  const row = await em.getRepository(Setting).findOne({ where: { key: KEY } });
  const v = (row?.value ?? {}) as Partial<BusinessSettings>;
  return {
    business: { ...DEFAULT_SETTINGS.business, ...v.business },
    defaults: { ...DEFAULT_SETTINGS.defaults, ...v.defaults },
    numbering: { ...DEFAULT_SETTINGS.numbering, ...v.numbering },
    portal: { ...DEFAULT_SETTINGS.portal, ...v.portal },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...v.notifications },
  };
}

export function sanitizeSettings(raw: unknown): BusinessSettings {
  const r = obj(raw); const b = obj(r.business ?? {}, "business"); const d = obj(r.defaults ?? {}, "defaults");
  const n = obj(r.numbering ?? {}, "numbering"); const p = obj(r.portal ?? {}, "portal"); const nt = obj(r.notifications ?? {}, "notifications");
  const cur = str(d.currency ?? "GHS", "defaults.currency", { max: 3 });
  if (!isCurrencyCode(cur)) throw new ValidationError("defaults.currency: must be a 3-letter code", "defaults.currency");
  const logo = str(b.logoDataUrl, "business.logoDataUrl", { optional: true, max: 300_000 });
  if (logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)) throw new ValidationError("business.logoDataUrl: must be a PNG, JPEG or WebP data URL (SVG is not accepted)", "business.logoDataUrl");
  const accent = str(p.accentColor ?? "#1f6b57", "portal.accentColor", { max: 7 });
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new ValidationError("portal.accentColor: must be a hex colour like #1f6b57", "portal.accentColor");
  const t = (o: Record<string, unknown>, k: string, f: string, max = 20000) => str(o[k], f, { optional: true, max });
  return {
    business: { name: t(b, "name", "business.name", 200), legalName: t(b, "legalName", "business.legalName", 200), email: t(b, "email", "business.email", 255), phone: t(b, "phone", "business.phone", 40), website: t(b, "website", "business.website", 255), address: t(b, "address", "business.address", 1000), logoDataUrl: logo, registrationNumber: t(b, "registrationNumber", "business.registrationNumber", 100), taxNumber: t(b, "taxNumber", "business.taxNumber", 100) },
    defaults: {
      currency: cur, validityDays: int(d.validityDays ?? 30, "defaults.validityDays", { min: 1, max: 365 }),
      paymentTerms: t(d, "paymentTerms", "defaults.paymentTerms"), warrantyTerms: t(d, "warrantyTerms", "defaults.warrantyTerms"), ipTerms: t(d, "ipTerms", "defaults.ipTerms"),
      confidentialityTerms: t(d, "confidentialityTerms", "defaults.confidentialityTerms"), changeRequestPolicy: t(d, "changeRequestPolicy", "defaults.changeRequestPolicy"),
      terminationTerms: t(d, "terminationTerms", "defaults.terminationTerms"), supportTerms: t(d, "supportTerms", "defaults.supportTerms"),
      contractClauses: (Array.isArray(d.contractClauses) ? d.contractClauses : []).slice(0, 60).map((c, i) => { const o = obj(c, `defaults.contractClauses[${i}]`); return { id: typeof o.id === "string" ? o.id : randomUUID(), title: str(o.title, "title", { max: 200 }), body: str(o.body, "body", { optional: true, max: 20000 }) }; }),
    },
    numbering: { proposalPrefix: str(n.proposalPrefix ?? "PRP", "numbering.proposalPrefix", { max: 10 }).toUpperCase(), padding: int(n.padding ?? 4, "numbering.padding", { min: 1, max: 8 }), includeYear: bool(n.includeYear, "numbering.includeYear", true) },
    portal: { accentColor: accent, tagline: t(p, "tagline", "portal.tagline", 300), footerNote: t(p, "footerNote", "portal.footerNote", 1000) },
    notifications: { notifyEmail: t(nt, "notifyEmail", "notifications.notifyEmail", 255), emailOnClientActivity: bool(nt.emailOnClientActivity, "notifications.emailOnClientActivity") },
  };
}

export async function saveSettings(raw: unknown, userId: string, meta: { ipAddress?: string; userAgent?: string }) {
  const value = sanitizeSettings(raw);
  const db = await AppDataSource();
  await db.transaction(async (m) => {
    await m.getRepository(Setting).save({ key: KEY, value: value as unknown as Record<string, unknown> });
    await audit({ action: "settings.updated", entityType: "settings", entityId: KEY, actorUserId: userId, ...meta }, m);
  });
  return value;
}

/** Atomic, gap-tolerant sequence: safe under concurrent requests. */
export async function nextNumber(manager: EntityManager, key: string): Promise<number> {
  const rows = await manager.query(`INSERT INTO counters ("key", "value") VALUES ($1, 1) ON CONFLICT ("key") DO UPDATE SET "value" = counters."value" + 1 RETURNING "value"`, [key]);
  return Number(rows[0].value);
}
export async function nextProposalReference(manager: EntityManager, s: BusinessSettings): Promise<string> {
  const year = new Date().getFullYear();
  const n = await nextNumber(manager, `proposal:${s.numbering.includeYear ? year : "all"}`);
  const num = String(n).padStart(s.numbering.padding, "0");
  return s.numbering.includeYear ? `${s.numbering.proposalPrefix}-${year}-${num}` : `${s.numbering.proposalPrefix}-${num}`;
}
export { Counter, strArray, optStr };
