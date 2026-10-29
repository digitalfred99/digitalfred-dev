import { divRound, percentOfBps } from "../money/money";
import type {
  Bucket, ComputedPayment, CostLine, LineStatus, PricingInput, PricingIssue, PricingResult,
  ServiceOption, BillingPeriod,
} from "./types";

const emptyBucket = (): Bucket => ({
  confirmedMinor: 0, estimatedMinor: 0, totalMinor: 0, unpricedCount: 0, estimateCount: 0, provisional: false,
});

function addToBucket(b: Bucket, status: LineStatus, minor: number | null) {
  if (status === "unpriced" || minor === null) {
    b.unpricedCount += 1;
  } else if (status === "estimated") {
    b.estimatedMinor += minor;
    b.estimateCount += 1;
  } else {
    b.confirmedMinor += minor;
  }
  b.totalMinor = b.confirmedMinor + b.estimatedMinor;
  b.provisional = b.estimateCount > 0 || b.unpricedCount > 0;
}

function lineStatus(amount: number | null, confirmed: boolean): LineStatus {
  if (amount === null) return "unpriced";
  return confirmed ? "confirmed" : "estimated";
}

/** Months in one billing cycle, or null when the period has no fixed cycle. */
export function cycleMonths(period: BillingPeriod, periodMonths?: number | null): number | null {
  switch (period) {
    case "monthly": return 1;
    case "quarterly": return 3;
    case "annual": return 12;
    case "custom": return Number.isInteger(periodMonths) && (periodMonths as number) > 0 ? (periodMonths as number) : null;
    default: return null;
  }
}

function makeLine(
  base: Pick<CostLine, "id" | "label" | "source" | "provider" | "period" | "periodMonths" | "paymentDeadline" | "renewalDate" | "note">,
  amount: number | null, tax: number, confirmed: boolean,
): CostLine {
  const status = lineStatus(amount, confirmed);
  return { ...base, amountMinor: amount, taxMinor: tax, totalMinor: amount === null ? null : amount + tax, status };
}

function optionLine(svc: PricingInput["services"][number], opt: ServiceOption | undefined): CostLine {
  const base = {
    id: svc.id, label: svc.name, source: "service" as const, provider: svc.provider,
    period: (opt?.period ?? "one_time") as BillingPeriod, periodMonths: opt?.periodMonths ?? null,
    paymentDeadline: opt?.paymentDeadline ?? null, renewalDate: opt?.renewalDate ?? null,
    note: opt ? opt.notes : "No billing option selected",
  };
  if (!opt) return makeLine(base, null, 0, false);
  return makeLine(base, opt.amountMinor, opt.taxMinor ?? 0, opt.confirmed);
}

export function computePricing(input: PricingInput): PricingResult {
  const issues: PricingIssue[] = [];
  const issue = (code: string, severity: PricingIssue["severity"], message: string, path?: string) =>
    issues.push({ code, severity, message, path });
  const cur = input.currency;

  // ── Implementation fee & payment schedule ──
  const fee = input.implementationFee.amountMinor;
  const percentItems = input.paymentSchedule.filter((p) => p.kind === "percent");
  const percentBpsTotal = percentItems.reduce((s, p) => s + (p.percentBps ?? 0), 0);
  if (percentBpsTotal > 10000) issue("schedule_percent_over_100", "blocker", "Payment schedule percentages add up to more than 100%.", "pricing.paymentSchedule");

  const schedule: ComputedPayment[] = input.paymentSchedule.map((p) => {
    let amount: number | null = null;
    if (p.kind === "fixed") amount = p.amountMinor ?? null;
    else if (fee !== null && p.percentBps != null) amount = percentOfBps(fee, p.percentBps);
    return { id: p.id, label: p.label, trigger: p.trigger, condition: p.condition, dueDate: p.dueDate ?? null, percentBps: p.percentBps ?? null, amountMinor: amount };
  });

  // Give rounding remainder to the last percentage instalment when percentages total exactly 100%,
  // so the schedule always sums to the fee to the last pesewa.
  if (fee !== null && percentBpsTotal === 10000 && percentItems.length > 0) {
    const allocated = schedule.filter((_, i) => input.paymentSchedule[i].kind === "percent").reduce((s, p) => s + (p.amountMinor ?? 0), 0);
    const fixedSum = schedule.filter((_, i) => input.paymentSchedule[i].kind === "fixed").reduce((s, p) => s + (p.amountMinor ?? 0), 0);
    const lastIdx = input.paymentSchedule.map((p) => p.kind).lastIndexOf("percent");
    if (fixedSum === 0) schedule[lastIdx].amountMinor = (schedule[lastIdx].amountMinor ?? 0) + (fee - allocated);
  }

  const anyUnknown = schedule.some((p) => p.amountMinor === null);
  const scheduleTotal = schedule.length === 0 || anyUnknown ? null : schedule.reduce((s, p) => s + (p.amountMinor ?? 0), 0);
  const scheduleMatchesFee = fee === null || scheduleTotal === null ? null : scheduleTotal === fee;
  if (fee === null) issue("fee_not_set", "blocker", "Implementation fee has not been set.", "pricing.implementationFee");
  else if (!input.implementationFee.confirmed) issue("fee_not_confirmed", "warning", "Implementation fee is marked as not yet confirmed.", "pricing.implementationFee");
  if (input.paymentSchedule.length === 0) issue("schedule_empty", "blocker", "No payment schedule has been defined.", "pricing.paymentSchedule");
  if (scheduleMatchesFee === false) issue("schedule_total_mismatch", "blocker", "Payment schedule does not add up to the implementation fee.", "pricing.paymentSchedule");
  for (const p of input.paymentSchedule) {
    if (p.kind === "fixed" && p.amountMinor == null) issue("schedule_amount_missing", "blocker", `Payment "${p.label}" has no amount.`, "pricing.paymentSchedule");
    if (p.kind === "percent" && p.percentBps == null) issue("schedule_percent_missing", "blocker", `Payment "${p.label}" has no percentage.`, "pricing.paymentSchedule");
  }

  // ── Services ──
  const activationLines: CostLine[] = [];
  const recurringLines: CostLine[] = [];
  const usageLines: CostLine[] = [];
  const optionalServices: CostLine[] = [];

  for (const svc of input.services) {
    const opt = svc.options.find((o) => o.id === svc.selectedOptionId);
    if (svc.selectedOptionId && !opt) issue("service_option_invalid", "blocker", `"${svc.name}" refers to an option that does not exist.`, `pricing.services.${svc.id}`);
    if (!opt && !svc.optional) issue("service_no_option", "warning", `"${svc.name}" has no billing option selected.`, `pricing.services.${svc.id}`);
    for (const o of svc.options) {
      if (o.currency !== cur) issue("currency_mismatch", "blocker", `"${svc.name}" has an option in ${o.currency}; the proposal currency is ${cur}.`, `pricing.services.${svc.id}`);
      if (o.period === "custom" && cycleMonths("custom", o.periodMonths) === null) issue("custom_period_invalid", "blocker", `"${svc.name}" has a custom period without a valid number of months.`, `pricing.services.${svc.id}`);
    }
    const line = optionLine(svc, opt);
    if (svc.optional) { optionalServices.push(line); continue; }
    if (opt?.period === "usage") { usageLines.push({ ...line, status: line.amountMinor === null ? "unpriced" : "estimated" }); continue; }
    if (svc.payInActivation) activationLines.push(line);
    if (svc.recurring) {
      if (opt && (opt.period === "one_time")) issue("one_time_marked_recurring", "warning", `"${svc.name}" is marked as renewing but its selected option is one-time.`, `pricing.services.${svc.id}`);
      else recurringLines.push(line);
    }
    if (!svc.payInActivation && !svc.recurring) issue("service_not_counted", "warning", `"${svc.name}" is neither paid at activation nor recurring, so it is not included in any total.`, `pricing.services.${svc.id}`);
  }

  // ── Maintenance & other recurring ──
  const selectedPkgs = input.maintenancePackages.filter((m) => m.selected);
  if (selectedPkgs.length > 1) issue("multiple_maintenance_selected", "blocker", "More than one maintenance package is selected.", "pricing.maintenancePackages");
  for (const m of selectedPkgs) {
    if (m.currency !== cur) issue("currency_mismatch", "blocker", `Maintenance "${m.name}" is in ${m.currency}; the proposal currency is ${cur}.`);
    if (m.period === "custom" && cycleMonths("custom", m.periodMonths) === null) issue("custom_period_invalid", "blocker", `Maintenance "${m.name}" has a custom period without a valid number of months.`);
    recurringLines.push(makeLine({ id: m.id, label: `Maintenance: ${m.name}`, source: "maintenance", period: m.period, periodMonths: m.periodMonths ?? null, renewalDate: m.renewalDate ?? null }, m.amountMinor, m.taxMinor ?? 0, m.confirmed));
  }
  if (selectedPkgs.length === 0) issue("no_maintenance", "warning", "No maintenance package is selected.", "pricing.maintenancePackages");
  for (const f of input.otherRecurring) {
    if (f.currency !== cur) issue("currency_mismatch", "blocker", `Recurring fee "${f.label}" is in ${f.currency}; the proposal currency is ${cur}.`);
    if (f.period === "custom" && cycleMonths("custom", f.periodMonths) === null) issue("custom_period_invalid", "blocker", `Recurring fee "${f.label}" has a custom period without a valid number of months.`);
    recurringLines.push(makeLine({ id: f.id, label: f.label, source: "other", period: f.period, periodMonths: f.periodMonths ?? null, renewalDate: f.renewalDate ?? null, note: f.notes }, f.amountMinor, f.taxMinor ?? 0, f.confirmed));
  }

  // ── Totals ──
  const activationTotal = emptyBucket();
  for (const l of activationLines) addToBucket(activationTotal, l.status, l.totalMinor);

  const byPeriod = { monthly: emptyBucket(), quarterly: emptyBucket(), annual: emptyBucket(), custom: emptyBucket() };
  const annualEq = emptyBucket();
  const comp = { services: emptyBucket(), maintenance: emptyBucket(), other: emptyBucket() };
  let approximate = false;

  for (const l of recurringLines) {
    const key = l.period === "monthly" || l.period === "quarterly" || l.period === "annual" ? l.period : "custom";
    addToBucket(byPeriod[key], l.status, l.totalMinor);

    const months = cycleMonths(l.period, l.periodMonths);
    let annual: number | null = null;
    if (l.totalMinor !== null && months !== null) {
      const num = l.totalMinor * 12;
      annual = num % months === 0 ? num / months : divRound(num, months);
      if (num % months !== 0) approximate = true;
    }
    const st: LineStatus = l.totalMinor === null || months === null ? "unpriced" : l.status;
    addToBucket(annualEq, st, annual);
    const compKey = l.source === "service" ? "services" : l.source === "maintenance" ? "maintenance" : "other";
    addToBucket(comp[compKey], st, annual);
  }

  const monthlyEq: Bucket & { approximate: boolean } = {
    ...annualEq,
    confirmedMinor: divRound(annualEq.confirmedMinor, 12),
    estimatedMinor: divRound(annualEq.estimatedMinor, 12),
    totalMinor: 0, approximate: false,
  };
  monthlyEq.totalMinor = monthlyEq.confirmedMinor + monthlyEq.estimatedMinor;
  monthlyEq.approximate = approximate || annualEq.confirmedMinor % 12 !== 0 || annualEq.estimatedMinor % 12 !== 0;

  const depositMinor = schedule.filter((p) => p.trigger === "before_development").reduce<number | null>((s, p) => (s === null || p.amountMinor === null ? null : s + p.amountMinor), 0);
  const hasDeposit = schedule.some((p) => p.trigger === "before_development");
  const beforeDev = {
    implementationDepositMinor: hasDeposit ? depositMinor : 0,
    activation: activationTotal,
    totalMinor: (hasDeposit ? depositMinor ?? 0 : 0) + activationTotal.totalMinor,
    provisional: activationTotal.provisional || (hasDeposit && depositMinor === null) || fee === null,
  };
  if (!schedule.some((p) => p.trigger === "before_development")) issue("no_pre_dev_payment", "warning", "No payment is scheduled before development begins.", "pricing.paymentSchedule");

  // Surface unconfirmed money on the review page (warnings: the owner must acknowledge them before publishing).
  const counted = [...activationLines, ...recurringLines];
  const unpricedNames = counted.filter((l) => l.status === "unpriced").map((l) => l.label);
  const estimatedNames = [...counted, ...usageLines].filter((l) => l.status === "estimated").map((l) => l.label);
  if (unpricedNames.length) issue("unpriced_costs", "warning", `Awaiting confirmation (shown as "Awaiting confirmation", not 0): ${[...new Set(unpricedNames)].join(", ")}.`, "pricing");
  if (estimatedNames.length) issue("estimated_costs", "warning", `Estimates, not guaranteed: ${[...new Set(estimatedNames)].join(", ")}.`, "pricing");

  const recurringProvisional = annualEq.provisional;
  const provisional = beforeDev.provisional || recurringProvisional || fee === null || !input.implementationFee.confirmed || usageLines.length > 0;

  return {
    currency: cur,
    implementation: { amountMinor: fee, confirmed: input.implementationFee.confirmed, schedule, scheduleTotalMinor: scheduleTotal, scheduleMatchesFee },
    activation: { lines: activationLines, total: activationTotal },
    recurring: { lines: recurringLines, byPeriod, annualEquivalent: annualEq, monthlyEquivalent: monthlyEq, components: comp },
    usage: { lines: usageLines },
    optional: {
      enhancements: input.optionalEnhancements.map((e) => ({ id: e.id, name: e.name, amountMinor: e.amountMinor, status: lineStatus(e.amountMinor, e.confirmed) })),
      services: optionalServices,
    },
    payableBeforeDevelopment: beforeDev,
    provisional,
    issues,
  };
}

export const emptyPricingInput = (currency: string): PricingInput => ({
  currency,
  implementationFee: { amountMinor: null, confirmed: false },
  paymentSchedule: [], services: [], maintenancePackages: [], otherRecurring: [], optionalEnhancements: [],
});
