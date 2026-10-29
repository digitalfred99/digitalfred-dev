export type BillingPeriod = "one_time" | "monthly" | "quarterly" | "annual" | "usage" | "custom";

export interface ServiceOption {
  id: string;
  period: BillingPeriod;
  periodMonths?: number | null;
  label?: string;
  amountMinor: number | null;
  taxMinor: number;
  currency: string;
  confirmed: boolean;
  paymentDeadline?: string | null;
  renewalDate?: string | null;
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
  payInActivation: boolean;
  recurring: boolean;
  optional: boolean;
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

export type PaymentTrigger = "before_development" | "on_milestone" | "on_delivery" | "on_acceptance_handover" | "custom";

export interface PaymentScheduleItem {
  id: string;
  label: string;
  kind: "percent" | "fixed";
  percentBps?: number | null;
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

export type LineStatus = "confirmed" | "estimated" | "unpriced";

export interface Bucket {
  confirmedMinor: number;
  estimatedMinor: number;
  totalMinor: number;
  unpricedCount: number;
  estimateCount: number;
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
  totalMinor: number | null;
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
  activation: { lines: CostLine[]; total: Bucket };
  recurring: {
    lines: CostLine[];
    byPeriod: { monthly: Bucket; quarterly: Bucket; annual: Bucket; custom: Bucket };
    annualEquivalent: Bucket;
    monthlyEquivalent: Bucket & { approximate: boolean };
    components: { services: Bucket; maintenance: Bucket; other: Bucket };
  };
  usage: { lines: CostLine[] };
  optional: {
    enhancements: { id: string; name: string; amountMinor: number | null; status: LineStatus }[];
    services: CostLine[];
  };
  payableBeforeDevelopment: {
    implementationDepositMinor: number | null;
    activation: Bucket;
    totalMinor: number;
    provisional: boolean;
  };
  provisional: boolean;
  issues: PricingIssue[];
}

export interface Section {
  id: string;
  key: string;
  title: string;
  body: string;
  clientVisible: boolean;
}

export interface ProposalDraft {
  sections: Section[];
  pricing: PricingInput;
  attachSrs: boolean;
  internalNotes: string;
}

export interface ProposalSnapshot {
  schemaVersion: 1;
  reference: string;
  kind: "proposal" | "amendment";
  title: string;
  versionLabel: string;
  currency: string;
  publishedAt: string;
  validUntil: string | null;
  changeNote: string;
  business: {
    name: string;
    legalName: string;
    email: string;
    phone: string;
    website: string;
    address: string;
    logoDataUrl: string;
    registrationNumber: string;
    taxNumber: string;
  };
  portal: { accentColor: string; tagline: string; footerNote: string };
  client: {
    displayName: string;
    contactName: string;
    organizationName: string | null;
    email: string;
    phone: string | null;
    country: string;
    billingAddress: string | null;
    taxId: string | null;
  };
  project: { name: string; identifier: string; description: string };
  sections: Pick<Section, "id" | "key" | "title" | "body">[];
  pricing: PricingInput;
  computed: PricingResult;
  clientCanRequestOptionChanges: boolean;
  contractClauses: { title: string; body: string }[];
  srs: null | {
    label: string;
    contentHash: string;
    title: string;
    sections: Pick<Section, "id" | "key" | "title" | "body">[];
    requirements: unknown[];
  };
}

export interface SnapshotSource {
  reference: string;
  kind: "proposal" | "amendment";
  title: string;
  currency: string;
  draft: ProposalDraft;
  versionLabel: string;
  publishedAt: Date;
  validUntil: Date | null;
  changeNote: string;
  business: ProposalSnapshot["business"];
  portal: ProposalSnapshot["portal"];
  contractClauses: { title: string; body: string }[];
  client: ProposalSnapshot["client"];
  project: ProposalSnapshot["project"];
  srs: null | {
    label: string;
    contentHash: string;
    title: string;
    sections: Section[];
    requirements: unknown[];
  };
}

export type ProposalStatus =
  | "draft"
  | "ready_for_review"
  | "sent"
  | "viewed"
  | "clarification_requested"
  | "negotiation_requested"
  | "revision_in_progress"
  | "revised_sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn";

export interface Readiness {
  canPublish: boolean;
  blockers: { code: string; message: string; path?: string }[];
  warnings: { code: string; message: string; path?: string }[];
}

export interface ApiEnvelope<T> {
  success: true;
  code: string;
  message: string;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code?: string;
  label?: string;
  key?: string;
  field?: string;
  details?: unknown;
}
