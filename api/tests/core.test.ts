import test from "node:test";
import assert from "node:assert/strict";
import { computePricing, emptyPricingInput } from "../src/lib/pricing/engine";
import type { PricingInput, ServiceItem } from "../src/lib/pricing/types";
import { sanitizePricing } from "../src/lib/pricing/validate";
import { parseMajorToMinor, formatMoney, divRound } from "../src/lib/money/money";
import { canTransition, isDraftEditable } from "../src/lib/proposals/stateMachine";
import { contentHash, nextVersion, canonicalize } from "../src/lib/proposals/versioning";
import { generateToken, hashToken, looksLikeToken, rateLimit } from "../src/lib/security/tokens";
import { checkReadiness } from "../src/lib/proposals/readiness";
import { makeSections } from "../src/lib/proposals/content";

const svc = (o: Partial<ServiceItem> & { id: string }): ServiceItem => ({
  name: o.id, provider: "", description: "", category: "", options: [], selectedOptionId: null,
  payInActivation: false, recurring: false, optional: false, clientSelectable: false, ...o,
});
const opt = (id: string, period: any, amountMinor: number | null, confirmed = true, extra: any = {}) =>
  ({ id, period, amountMinor, taxMinor: 0, currency: "GHS", confirmed, ...extra });

function base(): PricingInput {
  const p = emptyPricingInput("GHS");
  p.implementationFee = { amountMinor: 1_000_001, confirmed: true }; // GHS 10,000.01 (odd amount to test rounding)
  p.paymentSchedule = [
    { id: "a", label: "Deposit", kind: "percent", percentBps: 5000, trigger: "before_development", condition: "" },
    { id: "b", label: "Final", kind: "percent", percentBps: 5000, trigger: "on_acceptance_handover", condition: "" },
  ];
  return p;
}

test("money: parse and format without floats", () => {
  assert.equal(parseMajorToMinor("1,234.56", "GHS"), 123456);
  assert.equal(parseMajorToMinor("0.1", "GHS") + parseMajorToMinor("0.2", "GHS"), 30);
  assert.throws(() => parseMajorToMinor("1.234", "GHS"));
  assert.throws(() => parseMajorToMinor("abc", "GHS"));
  assert.equal(parseMajorToMinor("500", "JPY"), 500);
  assert.equal(formatMoney(123456, "GHS"), "GHS 1,234.56");
  assert.equal(formatMoney(null, "GHS"), "Awaiting confirmation");
  assert.equal(divRound(5, 2), 3);
});

test("50/50 schedule on an odd fee sums exactly to the fee", () => {
  const r = computePricing(base());
  const [a, b] = r.implementation.schedule;
  assert.equal(a.amountMinor, 500_000);
  assert.equal(b.amountMinor, 500_001); // remainder goes to the last instalment
  assert.equal(r.implementation.scheduleTotalMinor, 1_000_001);
  assert.equal(r.implementation.scheduleMatchesFee, true);
  assert.equal(r.payableBeforeDevelopment.implementationDepositMinor, 500_000);
});

test("unset fee is never invented", () => {
  const p = base(); p.implementationFee = { amountMinor: null, confirmed: false };
  const r = computePricing(p);
  assert.equal(r.implementation.amountMinor, null);
  assert.equal(r.implementation.schedule[0].amountMinor, null);
  assert.ok(r.issues.some((i) => i.code === "fee_not_set" && i.severity === "blocker"));
  assert.equal(r.provisional, true);
});

test("monthly and annual recurring are never added together as one 'monthly' total", () => {
  const p = base();
  p.services = [
    svc({ id: "sms", recurring: true, options: [opt("o1", "monthly", 10_000)], selectedOptionId: "o1" }),
    svc({ id: "domain", recurring: true, options: [opt("o2", "annual", 24_000)], selectedOptionId: "o2" }),
  ];
  const r = computePricing(p).recurring;
  assert.equal(r.byPeriod.monthly.totalMinor, 10_000);
  assert.equal(r.byPeriod.annual.totalMinor, 24_000);
  assert.equal(r.annualEquivalent.totalMinor, 10_000 * 12 + 24_000);
  assert.equal(r.monthlyEquivalent.totalMinor, 12_000);
  assert.equal(r.monthlyEquivalent.approximate, false);
});

test("quarterly and custom periods convert correctly; non-exact monthly is flagged approximate", () => {
  const p = base();
  p.services = [
    svc({ id: "q", recurring: true, options: [opt("o", "quarterly", 10_000)], selectedOptionId: "o" }),
    svc({ id: "c", recurring: true, options: [opt("x", "custom", 7_000, true, { periodMonths: 5 })], selectedOptionId: "x" }),
  ];
  const r = computePricing(p).recurring;
  assert.equal(r.annualEquivalent.totalMinor, 40_000 + 16_800); // 7000*12/5 = 16800
  p.services = [svc({ id: "q", recurring: true, options: [opt("o", "quarterly", 10_001)], selectedOptionId: "o" })];
  const r2 = computePricing(p).recurring;
  assert.equal(r2.annualEquivalent.totalMinor, 40_004);
  assert.equal(r2.monthlyEquivalent.totalMinor, 3_334);
  assert.equal(r2.monthlyEquivalent.approximate, true);
});

test("one-time activation is separate from recurring; estimates and unpriced are labelled", () => {
  const p = base();
  p.services = [
    svc({ id: "host", payInActivation: true, recurring: true, options: [opt("h", "annual", 120_000, false)], selectedOptionId: "h" }),
    svc({ id: "dom", payInActivation: true, options: [opt("d", "one_time", 15_000, true, { taxMinor: 500 })], selectedOptionId: "d" }),
    svc({ id: "sms", payInActivation: true, recurring: true, options: [opt("s", "monthly", null, false)], selectedOptionId: "s" }),
  ];
  const r = computePricing(p);
  assert.equal(r.activation.total.confirmedMinor, 15_500); // amount + tax
  assert.equal(r.activation.total.estimatedMinor, 120_000);
  assert.equal(r.activation.total.unpricedCount, 1);
  assert.equal(r.activation.total.provisional, true);
  assert.equal(r.recurring.byPeriod.annual.estimatedMinor, 120_000);
  assert.equal(r.recurring.byPeriod.monthly.unpricedCount, 1);
  assert.equal(r.recurring.byPeriod.monthly.totalMinor, 0); // unpriced is NOT guessed
  assert.equal(r.payableBeforeDevelopment.totalMinor, 500_000 + 135_500);
  assert.equal(r.provisional, true);
});

test("usage-based charges stay out of fixed totals and are always estimates", () => {
  const p = base();
  p.services = [svc({ id: "sms", recurring: true, payInActivation: true, options: [opt("u", "usage", 5_000)], selectedOptionId: "u" })];
  const r = computePricing(p);
  assert.equal(r.usage.lines.length, 1);
  assert.equal(r.usage.lines[0].status, "estimated");
  assert.equal(r.recurring.annualEquivalent.totalMinor, 0);
  assert.equal(r.activation.total.totalMinor, 0);
});

test("changing the selected service period changes the right totals", () => {
  const p = base();
  p.services = [svc({ id: "h", recurring: true, clientSelectable: true, options: [opt("m", "monthly", 10_000), opt("y", "annual", 100_000)], selectedOptionId: "m" })];
  assert.equal(computePricing(p).recurring.annualEquivalent.totalMinor, 120_000);
  p.services[0].selectedOptionId = "y";
  const r = computePricing(p).recurring;
  assert.equal(r.annualEquivalent.totalMinor, 100_000);
  assert.equal(r.byPeriod.monthly.totalMinor, 0);
});

test("maintenance: only selected package counts; two selected is a blocker; optional excluded", () => {
  const p = base();
  const pkg = (id: string, sel: boolean) => ({ id, name: id, period: "monthly" as const, amountMinor: 50_000, taxMinor: 0, currency: "GHS", confirmed: true, includedSupport: "", excludedSupport: "", status: "proposed" as const, selected: sel, clientSelectable: false });
  p.maintenancePackages = [pkg("basic", true), pkg("plus", false)];
  p.optionalEnhancements = [{ id: "e", name: "Extra", description: "", amountMinor: 99, currency: "GHS", confirmed: true }];
  assert.equal(computePricing(p).recurring.components.maintenance.totalMinor, 600_000);
  p.maintenancePackages = [pkg("basic", true), pkg("plus", true)];
  assert.ok(computePricing(p).issues.some((i) => i.code === "multiple_maintenance_selected"));
});

test("currency mismatch and >100% schedule are blockers", () => {
  const p = base();
  p.services = [svc({ id: "x", payInActivation: true, options: [{ ...opt("o", "one_time", 1), currency: "USD" }], selectedOptionId: "o" })];
  p.paymentSchedule.push({ id: "c", label: "x", kind: "percent", percentBps: 100, trigger: "custom", condition: "" });
  const codes = computePricing(p).issues.filter((i) => i.severity === "blocker").map((i) => i.code);
  assert.ok(codes.includes("currency_mismatch")); assert.ok(codes.includes("schedule_percent_over_100"));
});

test("sanitizePricing drops unknown keys and rejects bad input", () => {
  const clean = sanitizePricing({ currency: "GHS", hacked: 1, implementationFee: { amountMinor: 100, confirmed: true }, services: [{ name: "S", options: [{ period: "monthly", amountMinor: 5, confirmed: true }] }] }, "GHS");
  assert.equal((clean as any).hacked, undefined);
  assert.equal(clean.services[0].options[0].currency, "GHS");
  assert.throws(() => sanitizePricing({ implementationFee: { amountMinor: 1.5 } }, "GHS"));
  assert.throws(() => sanitizePricing({ implementationFee: { amountMinor: -5 } }, "GHS"));
  assert.throws(() => sanitizePricing({ currency: "ghs" }, "GHS"));
});

test("state machine", () => {
  assert.ok(canTransition("draft", "sent"));
  assert.ok(canTransition("sent", "viewed"));
  assert.ok(canTransition("negotiation_requested", "revision_in_progress"));
  assert.ok(canTransition("revision_in_progress", "revised_sent"));
  assert.equal(canTransition("accepted", "revision_in_progress"), false); // amend instead
  assert.equal(canTransition("accepted", "draft"), false);
  assert.equal(canTransition("draft", "accepted"), false);
  assert.equal(canTransition("withdrawn", "draft"), false);
  assert.ok(canTransition("expired", "revision_in_progress"));
  assert.equal(isDraftEditable("sent"), false);
  assert.equal(isDraftEditable("accepted"), false);
  assert.equal(isDraftEditable("revision_in_progress"), true);
});

test("versions and hashes", () => {
  assert.equal(nextVersion(null).label, "1.0");
  assert.equal(nextVersion({ major: 1, minor: 0 }).label, "1.1");
  assert.equal(nextVersion({ major: 1, minor: 3 }, "major").label, "2.0");
  assert.equal(contentHash({ b: 1, a: [2, { d: 1, c: 2 }] }), contentHash({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.notEqual(contentHash({ a: 1 }), contentHash({ a: 2 }));
  assert.equal(canonicalize({ a: undefined, b: 1 }), '{"b":1}');
});

test("tokens: random, hash-only storage, rate limit", () => {
  const t = generateToken();
  assert.ok(looksLikeToken(t)); assert.notEqual(t, generateToken());
  assert.equal(hashToken(t).length, 64); assert.notEqual(hashToken(t), t);
  assert.equal(looksLikeToken("123"), false);
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", 3, 1000), true);
  assert.equal(rateLimit("k", 3, 1000), false);
});

test("readiness blocks incomplete proposals and warns on soft gaps", () => {
  const draft = { sections: makeSections([{ key: "scope", title: "Scope", body: "x" }]), pricing: base(), attachSrs: false, internalNotes: "" };
  const r = checkReadiness({ title: "T", hasClient: false, hasProject: true, validityDays: 30, draft, srsRequirementCount: null });
  assert.equal(r.canPublish, false);
  const codes = r.blockers.map((b) => b.code);
  assert.ok(codes.includes("client_missing")); assert.ok(codes.includes("deliverables_missing"));
  assert.ok(r.warnings.some((w) => w.code === "exclusions_missing"));
  assert.ok(r.warnings.some((w) => w.code === "srs_not_attached"));
});

import { buildSnapshot, acceptanceStatement } from "../src/lib/proposals/snapshot";
test("snapshot never contains internal notes or hidden sections, and is hash-stable", () => {
  const sections = makeSections([{ key: "scope", title: "Scope", body: "Public scope" }, { key: "secret", title: "Private", body: "SECRET-PRICING-STRATEGY" }]);
  sections[1].clientVisible = false;
  const draft = { sections, pricing: base(), attachSrs: false, internalNotes: "INTERNAL-ONLY-NOTE" };
  const src = {
    reference: "PRP-2026-0001", kind: "proposal" as const, title: "T", currency: "GHS", draft, versionLabel: "1.0", publishedAt: new Date("2026-01-01T00:00:00Z"), validUntil: null, changeNote: "",
    business: { name: "Biz", legalName: "", email: "", phone: "", website: "", address: "", logoDataUrl: "", registrationNumber: "", taxNumber: "" },
    portal: { accentColor: "#000000", tagline: "", footerNote: "" }, contractClauses: [],
    client: { displayName: "C", contactName: "N", organizationName: null, email: "c@x.com", phone: null, country: "Ghana", billingAddress: null, taxId: null },
    project: { name: "P", identifier: "p", description: "" }, srs: null,
  };
  const snap = buildSnapshot(src);
  const json = JSON.stringify(snap);
  assert.ok(!json.includes("INTERNAL-ONLY-NOTE")); assert.ok(!json.includes("SECRET-PRICING-STRATEGY"));
  assert.equal(snap.sections.length, 1);
  assert.equal(contentHash(snap), contentHash(buildSnapshot(src)));
  const edited = buildSnapshot({ ...src, draft: { ...draft, pricing: { ...base(), implementationFee: { amountMinor: 1, confirmed: true } } } });
  assert.notEqual(contentHash(snap), contentHash(edited)); // any change to terms changes the hash
  assert.match(acceptanceStatement({ name: "Ama", organization: "School", reference: "PRP-1", versionLabel: "1.1" }), /version 1\.1/);
});

import { renderDocument, mdToHtml } from "../src/lib/documents/render";
test("document renderer escapes HTML and renders lists", () => {
  const html = renderDocument({ title: "<script>alert(1)</script>", business: { name: "B<b>" , logoDataUrl: "javascript:alert(1)" }, meta: [["Reference", "X\"Y"]], blocks: [{ type: "md", text: "- a <img src=x onerror=1>\n- b\n\n**bold** text" }, { type: "table", head: ["A"], rows: [["<i>"]] }] });
  assert.ok(!html.includes("<script>alert")); assert.ok(!html.includes("<img src=x")); assert.ok(!html.includes("javascript:"));
  assert.ok(html.includes("<li>a &lt;img")); assert.ok(html.includes("<strong>bold</strong>"));
  assert.match(mdToHtml("1. one\n2. two"), /<ol>/);
});
