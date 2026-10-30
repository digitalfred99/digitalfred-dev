import { randomUUID } from "node:crypto";
import { isCurrencyCode } from "../money/money";
import { bool, int, isoDate, minorOrNull, obj, oneOf, str, strArray, ValidationError } from "../validation/v";
import { BILLING_PERIODS, type PricingInput } from "./types";

const arr = (v: unknown, f: string, max = 100): unknown[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new ValidationError(`${f}: must be a list`, f);
  if (v.length > max) throw new ValidationError(`${f}: too many items`, f);
  return v;
};
const id = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : randomUUID());
const months = (v: unknown, f: string) => (v === undefined || v === null ? null : int(v, f, { min: 1, max: 120 }));

/** Validates untrusted JSON into a clean PricingInput. Unknown keys are dropped. */
export function sanitizePricing(raw: unknown, fallbackCurrency: string): PricingInput {
  const r = obj(raw, "pricing");
  const currency = r.currency === undefined ? fallbackCurrency : String(r.currency);
  if (!isCurrencyCode(currency)) throw new ValidationError("pricing.currency: must be a 3-letter currency code", "pricing.currency");
  const fee = obj(r.implementationFee ?? { amountMinor: null, confirmed: false }, "pricing.implementationFee");

  return {
    currency,
    implementationFee: {
      amountMinor: minorOrNull(fee.amountMinor, "pricing.implementationFee.amountMinor"),
      confirmed: bool(fee.confirmed, "pricing.implementationFee.confirmed"),
      description: fee.description ? str(fee.description, "pricing.implementationFee.description", { max: 2000 }) : undefined,
    },
    paymentSchedule: arr(r.paymentSchedule, "pricing.paymentSchedule", 20).map((x, i) => {
      const p = obj(x, `pricing.paymentSchedule[${i}]`);
      const kind = oneOf(p.kind, "kind", ["percent", "fixed"] as const);
      return {
        id: id(p.id), label: str(p.label, "label", { max: 200 }), kind,
        percentBps: kind === "percent" && p.percentBps != null ? int(p.percentBps, "percentBps", { min: 0, max: 10000 }) : null,
        amountMinor: kind === "fixed" ? minorOrNull(p.amountMinor, "amountMinor") : null,
        trigger: oneOf(p.trigger, "trigger", ["before_development", "on_milestone", "on_delivery", "on_acceptance_handover", "custom"] as const),
        condition: str(p.condition, "condition", { optional: true, max: 1000 }),
        dueDate: isoDate(p.dueDate, "dueDate"),
      };
    }),
    services: arr(r.services, "pricing.services", 50).map((x, i) => {
      const s = obj(x, `pricing.services[${i}]`);
      const options = arr(s.options, `pricing.services[${i}].options`, 12).map((y, j) => {
        const o = obj(y, `options[${j}]`);
        const period = oneOf(o.period, "period", BILLING_PERIODS);
        const cur = o.currency === undefined ? currency : String(o.currency);
        if (!isCurrencyCode(cur)) throw new ValidationError("options.currency: invalid currency code", "currency");
        return {
          id: id(o.id), period, periodMonths: period === "custom" ? months(o.periodMonths, "periodMonths") : null,
          label: o.label ? str(o.label, "label", { max: 100 }) : undefined,
          amountMinor: minorOrNull(o.amountMinor, "amountMinor"), taxMinor: o.taxMinor == null ? 0 : int(o.taxMinor, "taxMinor", { min: 0 }),
          currency: cur, confirmed: bool(o.confirmed, "confirmed"),
          paymentDeadline: isoDate(o.paymentDeadline, "paymentDeadline"), renewalDate: isoDate(o.renewalDate, "renewalDate"),
          notes: o.notes ? str(o.notes, "notes", { max: 2000 }) : undefined,
        };
      });
      const selected = s.selectedOptionId == null ? null : String(s.selectedOptionId);
      return {
        id: id(s.id), name: str(s.name, "name", { max: 200 }), provider: str(s.provider, "provider", { optional: true, max: 200 }),
        description: str(s.description, "description", { optional: true, max: 2000 }), category: str(s.category, "category", { optional: true, max: 100 }),
        options, selectedOptionId: selected && options.some((o) => o.id === selected) ? selected : selected,
        payInActivation: bool(s.payInActivation, "payInActivation"), recurring: bool(s.recurring, "recurring"),
        optional: bool(s.optional, "optional"), clientSelectable: bool(s.clientSelectable, "clientSelectable"),
        notes: s.notes ? str(s.notes, "notes", { max: 2000 }) : undefined,
      };
    }),
    maintenancePackages: arr(r.maintenancePackages, "pricing.maintenancePackages", 10).map((x, i) => {
      const m = obj(x, `pricing.maintenancePackages[${i}]`);
      const period = oneOf(m.period, "period", ["monthly", "annual", "custom"] as const);
      return {
        id: id(m.id), name: str(m.name, "name", { max: 200 }), period, periodMonths: period === "custom" ? months(m.periodMonths, "periodMonths") : null,
        amountMinor: minorOrNull(m.amountMinor, "amountMinor"), taxMinor: m.taxMinor == null ? 0 : int(m.taxMinor, "taxMinor", { min: 0 }),
        currency: m.currency ? String(m.currency) : currency, confirmed: bool(m.confirmed, "confirmed"),
        includedSupport: str(m.includedSupport, "includedSupport", { optional: true, max: 3000 }),
        excludedSupport: str(m.excludedSupport, "excludedSupport", { optional: true, max: 3000 }),
        renewalDate: isoDate(m.renewalDate, "renewalDate"), status: oneOf(m.status ?? "proposed", "status", ["proposed", "active", "lapsed"] as const),
        selected: bool(m.selected, "selected"), clientSelectable: bool(m.clientSelectable, "clientSelectable"),
      };
    }),
    otherRecurring: arr(r.otherRecurring, "pricing.otherRecurring", 30).map((x, i) => {
      const f = obj(x, `pricing.otherRecurring[${i}]`);
      const period = oneOf(f.period, "period", ["monthly", "quarterly", "annual", "custom"] as const);
      return {
        id: id(f.id), label: str(f.label, "label", { max: 200 }), period, periodMonths: period === "custom" ? months(f.periodMonths, "periodMonths") : null,
        amountMinor: minorOrNull(f.amountMinor, "amountMinor"), taxMinor: f.taxMinor == null ? 0 : int(f.taxMinor, "taxMinor", { min: 0 }),
        currency: f.currency ? String(f.currency) : currency, confirmed: bool(f.confirmed, "confirmed"), renewalDate: isoDate(f.renewalDate, "renewalDate"),
        notes: f.notes ? str(f.notes, "notes", { max: 2000 }) : undefined,
      };
    }),
    optionalEnhancements: arr(r.optionalEnhancements, "pricing.optionalEnhancements", 30).map((x, i) => {
      const e = obj(x, `pricing.optionalEnhancements[${i}]`);
      return {
        id: id(e.id), name: str(e.name, "name", { max: 200 }), description: str(e.description, "description", { optional: true, max: 2000 }),
        amountMinor: minorOrNull(e.amountMinor, "amountMinor"), currency: e.currency ? String(e.currency) : currency,
        confirmed: bool(e.confirmed, "confirmed"), notes: e.notes ? str(e.notes, "notes", { max: 2000 }) : undefined,
      };
    }),
  };
}
export { strArray };
