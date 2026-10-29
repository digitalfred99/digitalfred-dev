import { computePricing } from "../pricing/engine";
import type { PricingInput, PricingResult } from "../pricing/types";
import type { ProposalDraft } from "./content";

/**
 * The ONE place that decides what a client may see. Everything the public portal serves comes from a
 * frozen snapshot built here, so internal notes, hidden sections and admin data cannot leak by accident:
 * they are simply never copied in.
 */
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
  business: { name: string; legalName: string; email: string; phone: string; website: string; address: string; logoDataUrl: string; registrationNumber: string; taxNumber: string };
  portal: { accentColor: string; tagline: string; footerNote: string };
  client: { displayName: string; contactName: string; organizationName: string | null; email: string; phone: string | null; country: string; billingAddress: string | null; taxId: string | null };
  project: { name: string; identifier: string; description: string };
  sections: { id: string; key: string; title: string; body: string }[];
  pricing: PricingInput;
  computed: PricingResult;
  clientCanRequestOptionChanges: boolean;
  /** Default contract clauses as they stood when this version was published (so the contract draft never drifts). */
  contractClauses: { title: string; body: string }[];
  srs: null | { label: string; contentHash: string; title: string; sections: { id: string; key: string; title: string; body: string }[]; requirements: unknown[] };
}

export interface SnapshotSource {
  reference: string; kind: "proposal" | "amendment"; title: string; currency: string;
  draft: ProposalDraft; versionLabel: string; publishedAt: Date; validUntil: Date | null; changeNote: string;
  business: ProposalSnapshot["business"]; portal: ProposalSnapshot["portal"]; contractClauses: { title: string; body: string }[];
  client: ProposalSnapshot["client"]; project: ProposalSnapshot["project"];
  srs: null | { label: string; contentHash: string; title: string; sections: ProposalDraft["sections"]; requirements: unknown[] };
}

const pick = <T extends Record<string, unknown>>(o: T, keys: (keyof T)[]) => Object.fromEntries(keys.map((k) => [k, o[k]])) as T;

export function buildSnapshot(s: SnapshotSource): ProposalSnapshot {
  const pricing = s.draft.pricing;
  const visible = (secs: ProposalDraft["sections"]) => secs.filter((x) => x.clientVisible).map((x) => ({ id: x.id, key: x.key, title: x.title, body: x.body }));
  return {
    schemaVersion: 1, reference: s.reference, kind: s.kind, title: s.title, versionLabel: s.versionLabel, currency: s.currency,
    publishedAt: s.publishedAt.toISOString(), validUntil: s.validUntil ? s.validUntil.toISOString() : null, changeNote: s.changeNote,
    business: pick(s.business, ["name", "legalName", "email", "phone", "website", "address", "logoDataUrl", "registrationNumber", "taxNumber"]),
    portal: pick(s.portal, ["accentColor", "tagline", "footerNote"]),
    client: pick(s.client, ["displayName", "contactName", "organizationName", "email", "phone", "country", "billingAddress", "taxId"]),
    project: pick(s.project, ["name", "identifier", "description"]),
    sections: visible(s.draft.sections),
    pricing, computed: computePricing(pricing),
    clientCanRequestOptionChanges: pricing.services.some((x) => x.clientSelectable && x.options.length > 1) || pricing.maintenancePackages.some((x) => x.clientSelectable),
    contractClauses: s.contractClauses.map((c) => ({ title: c.title, body: c.body })),
    srs: s.srs ? { label: s.srs.label, contentHash: s.srs.contentHash, title: s.srs.title, sections: visible(s.srs.sections), requirements: s.srs.requirements } : null,
  };
}

export function acceptanceStatement(p: { name: string; organization?: string | null; reference: string; versionLabel: string }) {
  const who = p.organization ? `${p.name}, on behalf of ${p.organization}` : p.name;
  return (
    `I, ${who}, confirm that I have read proposal ${p.reference}, version ${p.versionLabel}, in full, ` +
    `that I am authorised to accept it, and that I agree to the scope, costs, payment terms and conditions exactly as presented in that version. ` +
    `I understand this online acknowledgment records my agreement to this specific version; a separate signed agreement may also be required.`
  );
}
