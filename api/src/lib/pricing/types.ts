// Pricing INPUT (what you configure) and OUTPUT (what the engine calculates).
// All amounts are integer minor units. `null` means "not configured / awaiting
// confirmation" and is NEVER treated as zero or guessed.

export type BillingPeriod = "one_time" | "monthly" | "quarterly" | "annual" | "usage" | "custom";
export const BILLING_PERIODS: BillingPeriod[] = ["one_time", "monthly", "quarterly", "annual", "usage", "custom"];

export interface ServiceOption {
  id: string;
  period: BillingPeriod;
  /** Required when period = "custom": the renewal cycle length in months. */
  periodMonths?: number | null;
  label?: string;
  amountMinor: number | null;
  /** Tax / other charges for this option, in addition to amountMinor. */
  taxMinor: number;
  currency: string;
  confirmed: boolean;
  paymentDeadline?: string | null; // ISO date
  renewalDate?: string | null; // ISO date
  notes?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: string;
  options: ServiceOption[];
  selectedOptionId: string | null;
  /** The selected option's first period is paid up-front, before development begins. */
  payInActivation: boolean;
  /** The service renews after the first period. */
  recurring: boolean;
  /** Optional services are listed but excluded from totals. */
  optional: boolean;
  /** The client may ask for a different configured option (recorded as a request). */
  clientSelectable: boolean;
  notes?: string;
}

export interface MaintenancePackage {
  id: string;
  name: string;
  period: "monthly" | "annual" | "custom";
  periodMonths?: number | null;
  amountMinor: number | null;
  taxMinor: number;
  currency: string;
  confirmed: boolean;
  includedSupport: string;
  excludedSupport: string;
  renewalDate?: string | null;
  status: "proposed" | "active" | "lapsed";
  /** Only the selected package contributes to totals. */
  selected: boolean;
  clientSelectable: boolean;
}

export interface OtherRecurringFee {
  id: string;
  label: string;
  period: "monthly" | "quarterly" | "annual" | "custom";
  periodMonths?: number | null;
  amountMinor: number | null;
  taxMinor: number;
  currency: string;
  confirmed: boolean;
  renewalDate?: string | null;
  notes?: string;
}

export interface OptionalEnhancement {
  id: string;
  name: string;
  description: string;
  amountMinor: number | null;
  currency: string;
  confirmed: boolean;
  notes?: string;
}

export type PaymentTrigger =
  | "before_development"
  | "on_milestone"
  | "on_delivery"
  | "on_acceptance_handover"
  | "custom";

export interface PaymentScheduleItem {
  id: string;
  label: string;
  kind: "percent" | "fixed";
  /** Basis points: 50% = 5000. Used when kind = "percent". */
  percentBps?: number | null;
  /** Used when kind = "fixed". */
  amountMinor?: number | null;
  trigger: PaymentTrigger;
  condition: string;
  dueDate?: string | null;
}

export interface PricingInput {
  currency: string;
  implementationFee: { amountMinor: number | null; confirmed: boolean; description?: string };
  paymentSchedule: PaymentScheduleItem[];
  services: ServiceItem[];
  maintenancePackages: MaintenancePackage[];
  otherRecurring: OtherRecurringFee[];
  optionalEnhancements: OptionalEnhancement[];
}

// ───────────────────────── OUTPUT ─────────────────────────

export type LineStatus = "confirmed" | "estimated" | "unpriced";

export interface Bucket {
  confirmedMinor: number;
  estimatedMinor: number;
  totalMinor: number;
  /** Lines with no configured price (awaiting confirmation). Counted as 0 in totals. */
  unpricedCount: number;
  estimateCount: number;
  /** True when the total includes estimates or unpriced lines. */
  provisional: boolean;
}

export interface CostLine {
  id: string;
  label: string;
  source: "service" | "maintenance" | "other";
  provider?: string;
  period: BillingPeriod;
  periodMonths?: number | null;
  amountMinor: number | null;
  taxMinor: number;
  totalMinor: number | null; // amount + tax; null if unpriced
  status: LineStatus;
  paymentDeadline?: string | null;
  renewalDate?: string | null;
  note?: string;
}

export interface ComputedPayment {
  id: string;
  label: string;
  trigger: PaymentTrigger;
  condition: string;
  dueDate?: string | null;
  percentBps?: number | null;
  amountMinor: number | null;
}

export interface PricingIssue {
  code: string;
  severity: "blocker" | "warning";
  message: string;
  path?: string;
}

export interface PricingResult {
  currency: string;
  implementation: {
    amountMinor: number | null;
    confirmed: boolean;
    schedule: ComputedPayment[];
    scheduleTotalMinor: number | null;
    scheduleMatchesFee: boolean | null;
  };
  /** Paid before development begins: external services' first period. */
  activation: { lines: CostLine[]; total: Bucket };
  recurring: {
    lines: CostLine[];
    /** Exact totals per billing period: never mixed together. */
    byPeriod: { monthly: Bucket; quarterly: Bucket; annual: Bucket; custom: Bucket };
    /** Comparable figures. Monthly is rounded half-up and flagged approximate when not exact. */
    annualEquivalent: Bucket;
    monthlyEquivalent: Bucket & { approximate: boolean };
    components: { services: Bucket; maintenance: Bucket; other: Bucket }; // annual-equivalent per component
  };
  /** Usage-based charges: always variable, never guaranteed. */
  usage: { lines: CostLine[] };
  optional: { enhancements: { id: string; name: string; amountMinor: number | null; status: LineStatus }[]; services: CostLine[] };
  payableBeforeDevelopment: {
    implementationDepositMinor: number | null;
    activation: Bucket;
    totalMinor: number;
    provisional: boolean;
  };
  provisional: boolean;
  issues: PricingIssue[];
}
