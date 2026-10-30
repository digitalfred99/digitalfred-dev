"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { downloadDocument, printDocument } from "@/lib/document-actions";
import { ConfirmDialog, EmptyState, FormField, useToast } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import type { BillingPeriod, PricingInput, PricingResult, ProposalDraft, ProposalStatus, Readiness, Section, ServiceItem, ServiceOption } from "@/types/api";

type Version = { id: string; label: string; contentHash: string; changeNote: string; validUntil: string | null; publishedAt: string };
type ProposalEntity = {
  id: string; reference: string; title: string; status: ProposalStatus; kind: string; currency: string; validityDays: number | null;
  clientId: string | null; projectId: string; draft: ProposalDraft; draftRevision: number; latestVersionLabel?: string | null;
};
type ProposalData = {
  proposal: ProposalEntity;
  client: { id: string; displayName: string } | null;
  project: { id: string; name: string };
  versions: Version[];
  link: { active: boolean; expiresAt?: string | null } | null;
  acceptances: { id: string; acceptedAt: string; versionLabel: string; contentHash: string; name: string; email: string }[];
  readiness: Readiness;
  computed: PricingResult;
  allowedTransitions: ProposalStatus[];
  draftEditable: boolean;
};
type ClientOption = { id: string; displayName: string; preferredCurrency?: string };
type CatalogService = { id: string; name: string; provider: string; description: string; category: string; options: ServiceOption[]; isActive: boolean };
type Step = "Details" | "Content" | "Pricing" | "Review & publish";
const STEPS: Step[] = ["Details", "Content", "Pricing", "Review & publish"];
const PERIODS: BillingPeriod[] = ["one_time", "monthly", "quarterly", "annual", "usage", "custom"];
const TRIGGERS = ["before_development", "on_milestone", "on_delivery", "on_acceptance_handover", "custom"] as const;
const DOCUMENT_KINDS = ["proposal", "cost_breakdown", "scope", "payment_schedule", "contract", "acceptance_record"] as const;

const moneyInputValue = (amount: number | null | undefined) => {
  if (amount == null) return "";
  const absolute = BigInt(amount);
  const negative = absolute < BigInt(0);
  const magnitude = negative ? -absolute : absolute;
  return `${negative ? "-" : ""}${magnitude / BigInt(100)}.${String(magnitude % BigInt(100)).padStart(2, "0")}`;
};
const newId = () => crypto.randomUUID();
const blankOption = (currency: string): ServiceOption => ({ id: newId(), period: "monthly", amountMinor: null, taxMinor: 0, currency, confirmed: false });
const blankService = (currency: string): ServiceItem => {
  const option = blankOption(currency);
  return { id: newId(), name: "", provider: "", description: "", category: "", options: [option], selectedOptionId: option.id, payInActivation: false, recurring: true, optional: false, clientSelectable: false };
};
const defaultPricing = (currency: string): PricingInput => ({ currency, implementationFee: { amountMinor: null, confirmed: false }, paymentSchedule: [], services: [], maintenancePackages: [], otherRecurring: [], optionalEnhancements: [] });

export default function ProposalBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<ProposalData | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [step, setStep] = useState<Step>("Details");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [validityDays, setValidityDays] = useState("");
  const [pricing, setPricing] = useState<PricingInput>(defaultPricing("GHS"));
  const [sections, setSections] = useState<Section[]>([]);
  const [attachSrs, setAttachSrs] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [versionBump, setVersionBump] = useState<"minor" | "major">("minor");
  const [overrideWarnings, setOverrideWarnings] = useState<string[]>([]);
  const [publishedLinkUrl, setPublishedLinkUrl] = useState("");
  const [documentHtml, setDocumentHtml] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const documentFrame = useRef<HTMLIFrameElement>(null);
  const [compareFrom, setCompareFrom] = useState("");
  const [compareTo, setCompareTo] = useState("");
  const [compareResult, setCompareResult] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  async function load() {
    setError("");
    try {
      const result = await api.get<ProposalData>(`/proposals/${encodeURIComponent(id)}`);
      setData(result);
      setTitle(result.proposal.title);
      setClientId(result.proposal.clientId || "");
      setValidityDays(result.proposal.validityDays == null ? "" : String(result.proposal.validityDays));
      setPricing(result.proposal.draft.pricing);
      setSections(result.proposal.draft.sections);
      setAttachSrs(result.proposal.draft.attachSrs);
      setInternalNotes(result.proposal.draft.internalNotes);
      setOverrideWarnings([]);
      setCompareFrom(result.versions[1]?.id ?? result.versions[0]?.id ?? "");
      setCompareTo(result.versions[0]?.id ?? "");
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The proposal could not be loaded."); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<ProposalData>(`/proposals/${encodeURIComponent(id)}`),
      api.get<ClientOption[] | { data: ClientOption[] }>("/clients"),
      api.get<CatalogService[]>("/service-catalog"),
    ]).then(([result, clientResult, services]) => {
      if (!active) return;
      setData(result); setTitle(result.proposal.title); setClientId(result.proposal.clientId || "");
      setValidityDays(result.proposal.validityDays == null ? "" : String(result.proposal.validityDays));
      setPricing(result.proposal.draft.pricing); setSections(result.proposal.draft.sections);
      setAttachSrs(result.proposal.draft.attachSrs); setInternalNotes(result.proposal.draft.internalNotes);
      setClients(Array.isArray(clientResult) ? clientResult : clientResult.data); setCatalog(services.filter((service) => service.isActive));
      setCompareFrom(result.versions[1]?.id ?? result.versions[0]?.id ?? ""); setCompareTo(result.versions[0]?.id ?? "");
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "The proposal could not be loaded.");
    });
    return () => { active = false; };
  }, [id]);

  const serverComputed = data?.computed;
  const readiness = data?.readiness ?? { canPublish: false, blockers: [], warnings: [] };
  const activeStepIndex = STEPS.indexOf(step);
  const currency = data?.proposal.currency ?? pricing.currency;
  const publishBlocked = !readiness?.canPublish || Boolean(readiness.warnings.some((warning) => !overrideWarnings.includes(warning.code)));

  function updatePricing(update: (value: PricingInput) => PricingInput) {
    setPricing((current) => update(current));
  }
  function updateSection(index: number, patch: Partial<Section>) {
    setSections((current) => current.map((section, i) => i === index ? { ...section, ...patch } : section));
  }
  function updateService(index: number, patch: Partial<ServiceItem>) {
    updatePricing((current) => ({ ...current, services: current.services.map((service, i) => i === index ? { ...service, ...patch } : service) }));
  }
  function updateOption(serviceIndex: number, optionIndex: number, patch: Partial<ServiceOption>) {
    updatePricing((current) => ({ ...current, services: current.services.map((service, i) => i === serviceIndex ? { ...service, options: service.options.map((option, j) => j === optionIndex ? { ...option, ...patch } : option) } : service) }));
  }
  function removePricingItem(key: "services" | "paymentSchedule" | "maintenancePackages" | "otherRecurring" | "optionalEnhancements", index: number, label: string) {
    setConfirm({ title: `Remove ${label}?`, description: "This item will be removed from the working draft the next time you save.", action: () => updatePricing((current) => ({ ...current, [key]: current[key].filter((_, i) => i !== index) })) });
  }
  function addCatalogService() {
    const item = catalog.find((service) => service.id === selectedCatalogId);
    if (!item) return;
    const options = item.options.map((option) => ({ ...option, id: newId(), currency }));
    const service: ServiceItem = { id: newId(), name: item.name, provider: item.provider, description: item.description, category: item.category, options, selectedOptionId: options[0]?.id ?? null, payInActivation: false, recurring: true, optional: false, clientSelectable: false };
    updatePricing((current) => ({ ...current, services: [...current.services, service] }));
    setSelectedCatalogId("");
  }
  function addSchedule() {
    updatePricing((current) => ({ ...current, paymentSchedule: [...current.paymentSchedule, { id: newId(), label: "", kind: "percent", percentBps: null, trigger: "before_development", condition: "" }] }));
  }
  function addMaintenance() {
    updatePricing((current) => ({ ...current, maintenancePackages: [...current.maintenancePackages, { id: newId(), name: "", period: "monthly", amountMinor: null, taxMinor: 0, currency, confirmed: false, includedSupport: "", excludedSupport: "", status: "proposed", selected: false, clientSelectable: false }] }));
  }
  function addRecurring() {
    updatePricing((current) => ({ ...current, otherRecurring: [...current.otherRecurring, { id: newId(), label: "", period: "monthly", amountMinor: null, taxMinor: 0, currency, confirmed: false }] }));
  }
  function addEnhancement() {
    updatePricing((current) => ({ ...current, optionalEnhancements: [...current.optionalEnhancements, { id: newId(), name: "", description: "", amountMinor: null, currency, confirmed: false }] }));
  }

  async function saveMeta(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!data) return;
    setBusy(true); setError(""); setFieldError("");
    try {
      const saved = await api.patch<ProposalEntity>(`/proposals/${encodeURIComponent(id)}`, { title, clientId: clientId || null, validityDays: validityDays ? Number(validityDays) : null, currency: data.proposal.currency });
      setData({ ...data, proposal: { ...data.proposal, ...saved } });
      toast("Proposal details saved.");
    } catch (issue) { setFieldError(toFieldError(issue, "The details could not be saved.")); }
    finally { setBusy(false); }
  }
  async function saveDraft(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!data) return false;
    if (pricing.paymentSchedule.some((item) => item.kind === "percent" && item.percentBps != null && !Number.isSafeInteger(item.percentBps))) {
      setFieldError("Payment percentages must convert to whole basis points. Correct the percentage values before saving.");
      return false;
    }
    setBusy(true); setError(""); setFieldError("");
    try {
      const saved = await api.put<{ proposal: ProposalEntity; computed: PricingResult; readiness: Readiness }>(`/proposals/${encodeURIComponent(id)}/draft`, {
        revision: data.proposal.draftRevision, sections, pricing, attachSrs, internalNotes,
      });
      setData({ ...data, proposal: saved.proposal, computed: saved.computed, readiness: saved.readiness, draftEditable: true });
      setPricing(saved.proposal.draft.pricing); setSections(saved.proposal.draft.sections);
      toast("Draft saved. Totals and readiness refreshed by the server.");
      return true;
    } catch (issue) {
      const msg = issue instanceof ApiError && issue.status === 409
        ? "This proposal changed elsewhere. Reload it before saving your edits."
        : toFieldError(issue, "The draft could not be saved.");
      setFieldError(msg);
      return false;
    } finally { setBusy(false); }
  }
  async function refreshPreview() {
    setError("");
    try {
      const preview = await api.get<{ computed: PricingResult; readiness: Readiness }>(`/proposals/${encodeURIComponent(id)}/preview`);
      setData((current) => current ? { ...current, computed: preview.computed, readiness: preview.readiness } : current);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The server preview could not be refreshed."); }
  }
  async function transition(to: ProposalStatus) {
    setBusy(true); setError("");
    try { await api.post(`/proposals/${encodeURIComponent(id)}/transition`, { to }); await load(); toast(`Proposal moved to ${to.replaceAll("_", " ")}.`); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The status could not be changed."); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!readiness) return;
    const saved = await saveDraft();
    if (!saved) return;
    setBusy(true); setError("");
    try {
      const result = await api.post<{ version: { id: string; label: string }; status: ProposalStatus; link: { token: string; url: string } | null }>(`/proposals/${encodeURIComponent(id)}/publish`, {
        bump: data?.versions.length ? versionBump : undefined,
        changeNote: changeNote || undefined,
        overrideWarnings,
      });
      setPublishedLinkUrl(result.link?.url ?? "");
      await load();
      toast(`Published ${result.version.label}.`);
    } catch (issue) {
      if (issue instanceof ApiError && issue.status === 422) {
        const detail = issue.details as { blockers?: Readiness["blockers"]; warnings?: Readiness["warnings"] } | undefined;
        if (detail) setData((current) => current ? { ...current, readiness: { canPublish: !detail.blockers?.length, blockers: detail.blockers ?? [], warnings: detail.warnings ?? [] } } : current);
      }
      setError(issue instanceof ApiError ? issue.message : "The proposal could not be published.");
    } finally { setBusy(false); }
  }
  async function rotateLink() {
    setBusy(true); setError("");
    try {
      const result = await api.post<{ token: string; url: string }>(`/proposals/${encodeURIComponent(id)}/link`, {});
      setPublishedLinkUrl(result.url);
      await load();
      toast("A new client link was created. The previous link is revoked.");
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "A new link could not be created."); }
    finally { setBusy(false); }
  }
  async function revokeLink() {
    setBusy(true); setError("");
    try { await api.delete(`/proposals/${encodeURIComponent(id)}/link`); setPublishedLinkUrl(""); await load(); toast("Client link revoked."); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The client link could not be revoked."); }
    finally { setBusy(false); }
  }
  async function openDocument(kind: typeof DOCUMENT_KINDS[number], version?: string) {
    setError("");
    try {
      const query = new URLSearchParams({ kind });
      if (version) query.set("version", version);
      const html = await api.document(`/proposals/${encodeURIComponent(id)}/document?${query}`);
      setDocumentHtml(html); setDocumentTitle(`${kind.replaceAll("_", " ")} · ${version || "latest"}`);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The document could not be opened."); }
  }
  async function compareVersions() {
    if (!compareFrom || !compareTo) return;
    try {
      const result = await api.get<unknown>(`/proposals/${encodeURIComponent(id)}/compare`, { from: compareFrom, to: compareTo });
      setCompareResult(JSON.stringify(result, null, 2));
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The versions could not be compared."); }
  }
  async function downloadCsv() {
    try {
      const csv = await api.get<string>(`/proposals/${encodeURIComponent(id)}/costs-csv`, { version: "latest" });
      const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = href; anchor.download = `${data?.proposal.reference ?? "proposal"}-costs.csv`; anchor.click();
      URL.revokeObjectURL(href);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The CSV export could not be downloaded."); }
  }
  async function createAmendment() {
    setBusy(true); setError("");
    try {
      const amendment = await api.post<{ id: string }>(`/proposals/${encodeURIComponent(id)}/amend`, {});
      router.push(`/proposals/${encodeURIComponent(amendment.id)}`);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "An amendment could not be created."); }
    finally { setBusy(false); }
  }

  if (error && !data) return <div className="page-shell"><div className="alert alert-error" role="alert">{error}</div><button className="button button-quiet section-space" onClick={() => void load()}>Retry</button></div>;
  if (!data) return <div className="loading" role="status">Opening proposal builder…</div>;
  const proposal = data.proposal;

  return <div className="page-shell proposal-page">
    <header className="page-heading"><div><Link className="table-secondary" href="/proposals">← All proposals</Link><p className="eyebrow section-space">{proposal.reference} · {proposal.kind}</p><h1>{proposal.title}</h1><p>{data.client?.displayName || "No client assigned"} · {data.project?.name} · <StatusBadge status={proposal.status} /></p></div><div className="heading-actions"><button className="button button-quiet" onClick={() => void load()}>Reload</button>{data.draftEditable && <button className="button button-primary" disabled={busy} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save draft"}</button>}</div></header>
    {!data.draftEditable && <div className="alert alert-warning section-space"><strong>This version is read-only.</strong> Published terms cannot be edited in place. Start a revision to create another version. <button className="button button-quiet button-small" disabled={!data.allowedTransitions.includes("revision_in_progress")} onClick={() => void transition("revision_in_progress")}>Start revision</button></div>}
    {proposal.status === "accepted" && <div className="alert alert-success section-space">This proposal has been accepted. Create an amendment to change the agreed work. <button className="button button-quiet button-small" onClick={() => void createAmendment()}>Create amendment</button></div>}
    {error && <div className="alert alert-error section-space" role="alert">{error}</div>}
    {fieldError && <div className="alert alert-error section-space" role="alert">{fieldError}</div>}
    <div className="proposal-layout section-space">
      <nav className="stepper" aria-label="Proposal builder steps">{STEPS.map((item, index) => <button key={item} className={`stepper-item ${step === item ? "active" : ""} ${index < activeStepIndex ? "done" : ""}`} onClick={() => setStep(item)}><span className="step-number">{index < activeStepIndex ? "✓" : index + 1}</span><span>{item}</span></button>)}</nav>
      <div className="step-content">
        {step === "Details" && <section className="card"><div className="card-heading"><div><h2>Proposal details</h2><p>These details appear on the published proposal and client portal.</p></div><StatusBadge status={proposal.status} /></div><form className="form-stack" onSubmit={(event) => void saveMeta(event)}>
          <FormField label="Title" htmlFor="proposal-title" required><input id="proposal-title" required disabled={!data.draftEditable} value={title} onChange={(event) => setTitle(event.target.value)} /></FormField>
          <div className="form-grid"><FormField label="Client" htmlFor="proposal-client" required><select id="proposal-client" required disabled={!data.draftEditable} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Choose a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></FormField><FormField label="Currency" htmlFor="proposal-currency"><input id="proposal-currency" disabled value={proposal.currency} /></FormField></div>
          <FormField label="Validity (days)" htmlFor="proposal-validity" hint="Leave blank if the proposal does not expire."><input id="proposal-validity" type="number" min="1" max="365" disabled={!data.draftEditable} value={validityDays} onChange={(event) => setValidityDays(event.target.value)} /></FormField>
          <button className="button button-primary" disabled={busy || !data.draftEditable}>{busy ? "Saving…" : "Save details"}</button>
        </form></section>}
        {step === "Content" && <section className="card"><div className="card-heading"><div><h2>Proposal content</h2><p>Write client-facing sections. Internal notes never appear in the published snapshot.</p></div><button className="button button-quiet button-small" disabled={!data.draftEditable} onClick={() => setSections([...sections, { id: newId(), key: "custom", title: "New section", body: "", clientVisible: true }])}>Add section +</button></div>
          {sections.length ? <div className="stack">{sections.map((section, index) => <article className="srs-section" key={section.id}><div className="srs-section-toolbar"><label className="toggle-label"><input type="checkbox" checked={section.clientVisible} disabled={!data.draftEditable} onChange={(event) => updateSection(index, { clientVisible: event.target.checked })} /> Visible to client</label><div className="button-row"><button type="button" className="button button-quiet button-small" disabled={!data.draftEditable || index === 0} onClick={() => { const next = [...sections]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setSections(next); }} aria-label={`Move section ${section.title} up`}>↑</button><button type="button" className="button button-quiet button-small" disabled={!data.draftEditable || index === sections.length - 1} onClick={() => { const next = [...sections]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; setSections(next); }} aria-label={`Move section ${section.title} down`}>↓</button><button type="button" className="button button-quiet button-small" disabled={!data.draftEditable} onClick={() => setConfirm({ title: "Remove this section?", description: `“${section.title}” will be removed from the proposal draft.`, action: () => setSections(sections.filter((_, i) => i !== index)) })}>Remove</button></div></div><div className="form-grid"><FormField label="Section title" htmlFor={`proposal-section-title-${section.id}`} required><input id={`proposal-section-title-${section.id}`} disabled={!data.draftEditable} value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} /></FormField><FormField label="Key" htmlFor={`proposal-section-key-${section.id}`}><input id={`proposal-section-key-${section.id}`} disabled={!data.draftEditable} value={section.key} onChange={(event) => updateSection(index, { key: event.target.value })} /></FormField></div><FormField label="Section text" htmlFor={`proposal-section-body-${section.id}`}><textarea id={`proposal-section-body-${section.id}`} rows={6} disabled={!data.draftEditable} value={section.body} onChange={(event) => updateSection(index, { body: event.target.value })} /></FormField></article>)}</div> : <EmptyState title="No proposal sections" description="Add a section to begin the client-facing narrative." />}
          <div className="section-space"><label className="toggle-label"><input type="checkbox" disabled={!data.draftEditable} checked={attachSrs} onChange={(event) => setAttachSrs(event.target.checked)} /> Attach the requirements document</label></div><FormField label="Internal notes" htmlFor="internal-notes" hint="Only your team can see these notes."><textarea id="internal-notes" disabled={!data.draftEditable} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></FormField><button className="button button-primary section-space" disabled={busy || !data.draftEditable} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save content"}</button>
        </section>}
        {step === "Pricing" && <PricingEditor pricing={pricing} currency={currency} computed={serverComputed} editable={data.draftEditable} catalog={catalog} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} updatePricing={updatePricing} updateService={updateService} updateOption={updateOption} addCatalogService={addCatalogService} addSchedule={addSchedule} addMaintenance={addMaintenance} addRecurring={addRecurring} addEnhancement={addEnhancement} removePricingItem={removePricingItem} refreshPreview={() => void saveDraft()} busy={busy} />}
        {step === "Review & publish" && <section className="card"><div className="card-heading"><div><h2>Review & publish</h2><p>Blockers must be fixed; each warning needs an explicit acknowledgement.</p></div></div>
          <ReadinessList title="Must fix before publishing" items={readiness.blockers} tone="error" empty="No blockers returned by the server." />
          <div className="section-space"><h3>Warnings</h3><p className="muted small-copy">Review each item and confirm only the warnings you accept.</p>{readiness.warnings.length ? <div className="stack section-space">{readiness.warnings.map((warning, index) => <label className="warning-check" key={`${warning.code}:${warning.path ?? ""}:${index}`}><input type="checkbox" disabled={!data.draftEditable} checked={overrideWarnings.includes(warning.code)} onChange={(event) => setOverrideWarnings((current) => event.target.checked ? current.includes(warning.code) ? current : [...current, warning.code] : current.filter((code) => code !== warning.code))} /><span><strong>{warning.message}</strong><small className="font-mono">{warning.code}</small></span></label>)}</div> : <EmptyState title="No warnings" description="The server has no warnings to acknowledge." />}</div>
          {data.versions.length > 0 && <div className="form-grid section-space"><FormField label="Version increment" htmlFor="proposal-version-bump"><select id="proposal-version-bump" value={versionBump} onChange={(event) => setVersionBump(event.target.value as "minor" | "major")}><option value="minor">Minor version</option><option value="major">Major version</option></select></FormField><FormField label="Change note" htmlFor="proposal-change-note"><input id="proposal-change-note" value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="Summarise this revision" /></FormField></div>}
            {serverComputed?.provisional && <div className="alert alert-warning section-space">Provisional pricing: one or more items are estimated or awaiting confirmation.</div>}
          <div className="button-row section-space"><button className="button button-quiet" onClick={() => void refreshPreview()}>Refresh server checks</button><button className="button button-primary" disabled={!data.draftEditable || publishBlocked || busy} onClick={() => void publish()}>{busy ? "Publishing…" : data.versions.length ? "Publish new version" : "Publish proposal"}</button></div>
          {publishedLinkUrl && <div className="alert alert-success section-space"><strong>Your client link is shown once.</strong><p>Copy it now and share it with your client. This secret is not saved in the browser or shown again after reload.</p><div className="link-copy-row"><a href={publishedLinkUrl} target="_blank" rel="noreferrer" className="client-link">{publishedLinkUrl}</a><button className="button button-quiet button-small" onClick={() => void navigator.clipboard.writeText(publishedLinkUrl).then(() => toast("Client link copied."))}>Copy link</button></div></div>}
          {data.link?.active && <div className="button-row section-space"><span className="badge badge-green">Client link active</span><button className="button button-quiet button-small" onClick={() => setConfirm({ title: "Revoke client link?", description: "The current portal link will stop working immediately.", action: () => void revokeLink() })}>Revoke</button><button className="button button-quiet button-small" onClick={() => setConfirm({ title: "Regenerate client link?", description: "The current link will be revoked and a new one shown once.", action: () => void rotateLink() })}>Regenerate link</button></div>}
        </section>}
      </div>
      <aside className="pricing-summary card"><div className="card-heading"><div><p className="eyebrow">SERVER PREVIEW</p><h2>Pricing summary</h2></div><button className="icon-button" aria-label="Refresh pricing preview" onClick={() => void refreshPreview()}>↻</button></div>{serverComputed?.provisional && <div className="alert alert-warning">Provisional</div>}<div className="summary-total"><small>Payable before development</small><strong>{formatMoney(serverComputed?.payableBeforeDevelopment.totalMinor, currency)}</strong></div><p className="summary-label">Initial service activation</p><strong className="summary-value">{formatMoney(serverComputed?.activation.total.totalMinor, currency)}</strong><hr className="divider" /><p className="section-kicker">RECURRING PER PERIOD</p>{serverComputed ? <div className="summary-lines"><SummaryLine label="Monthly" amount={serverComputed.recurring.byPeriod.monthly.totalMinor} currency={currency} /><SummaryLine label="Quarterly" amount={serverComputed.recurring.byPeriod.quarterly.totalMinor} currency={currency} /><SummaryLine label="Annual" amount={serverComputed.recurring.byPeriod.annual.totalMinor} currency={currency} /><SummaryLine label="Custom" amount={serverComputed.recurring.byPeriod.custom.totalMinor} currency={currency} /></div> : <p className="muted">Server totals appear after the first save.</p>}<hr className="divider" /><SummaryLine label="Annual equivalent" amount={serverComputed?.recurring.annualEquivalent.totalMinor} currency={currency} approximate={serverComputed?.recurring.annualEquivalent.provisional} /><SummaryLine label="Monthly average" amount={serverComputed?.recurring.monthlyEquivalent.totalMinor} currency={currency} approximate={serverComputed?.recurring.monthlyEquivalent.approximate} /><p className="small-copy muted section-space">Usage-based charges are variable and not included in recurring totals.</p>{serverComputed?.usage.lines.map((line) => <p className="summary-small" key={line.id}>{line.label} · variable</p>)}</aside>
    </div>
    <section className="card section-space"><div className="card-heading"><div><h2>Versions & documents</h2><p>Published versions are immutable. Preview the generated documents or download the costs.</p></div><button className="button button-quiet button-small" onClick={() => void downloadCsv()}>Download cost CSV</button></div>
      {data.versions.length ? <><div className="table-wrap"><table><thead><tr><th>Version</th><th>Published</th><th>Change note</th><th>Content fingerprint</th><th /></tr></thead><tbody>{data.versions.map((version) => <tr key={version.id}><td className="font-mono">{version.label}</td><td>{version.publishedAt ? new Date(version.publishedAt).toLocaleDateString() : "—"}</td><td>{version.changeNote || "Initial version"}</td><td className="font-mono">{version.contentHash.slice(0, 12)}…</td><td><button className="button button-quiet button-small" onClick={() => void openDocument("proposal", version.id)}>Preview</button></td></tr>)}</tbody></table></div>
        <div className="compare-row section-space"><FormField label="Compare from" htmlFor="compare-from"><select id="compare-from" value={compareFrom} onChange={(event) => setCompareFrom(event.target.value)}>{data.versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}</select></FormField><FormField label="Compare to" htmlFor="compare-to"><select id="compare-to" value={compareTo} onChange={(event) => setCompareTo(event.target.value)}>{data.versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}</select></FormField><button className="button button-quiet" onClick={() => void compareVersions()}>Compare versions</button></div>
        {compareResult && <pre className="compare-output">{compareResult}</pre>}</> : <EmptyState title="No versions published" description="After the server reports readiness, publish the first version to make the proposal available to the client." />}
      <div className="document-actions section-space">{DOCUMENT_KINDS.map((kind) => <button className="button button-quiet button-small" key={kind} onClick={() => void openDocument(kind)}>{kind.replaceAll("_", " ")}</button>)}</div>
    </section>
    <div className="section-space">{data.allowedTransitions.map((target) => <button className="button button-quiet button-small" key={target} disabled={busy} onClick={() => setConfirm({ title: `Move proposal to ${target.replaceAll("_", " ")}?`, description: "This status change is controlled by the server lifecycle.", action: () => void transition(target) })}>{target.replaceAll("_", " ")}</button>)}</div>
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.title || ""} description={confirm?.description || ""} destructive={confirm?.title.toLowerCase().includes("revoke") || confirm?.title.toLowerCase().includes("remove") || confirm?.title.toLowerCase().includes("delete")} onCancel={() => setConfirm(null)} onConfirm={() => { confirm?.action(); setConfirm(null); }} />
    {documentHtml && <div className="document-overlay"><div className="document-toolbar"><strong>{documentTitle}</strong><div className="button-row"><button className="button button-quiet button-small" onClick={() => downloadDocument(documentHtml, `${proposal.reference}-${documentTitle}`)}>Save a copy</button><button className="button button-quiet button-small" onClick={() => { try { printDocument(documentFrame.current); } catch (issue) { setError(issue instanceof Error ? issue.message : "The document could not be printed."); } }}>Print</button><button className="button button-quiet button-small" onClick={() => setDocumentHtml("")}>Close preview</button></div></div><iframe ref={documentFrame} title={documentTitle} sandbox="allow-scripts allow-modals" srcDoc={documentHtml} /></div>}
  </div>;
}

function toFieldError(issue: unknown, fallback: string) {
  return issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : fallback;
}

function ReadinessList({ title, items, tone, empty }: { title: string; items: Readiness["blockers"]; tone: "error"; empty: string }) {
  return <div className={`readiness-box ${tone}`}><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item.code}><strong>{item.message}</strong><small>{item.path || item.code}</small></li>)}</ul> : <p>{empty}</p>}</div>;
}

function SummaryLine({ label, amount, currency, approximate }: { label: string; amount?: number | null; currency: string; approximate?: boolean }) {
  return <div className="summary-line"><span>{label}{approximate && <small> · approx.</small>}</span><strong>{formatMoney(amount, currency)}</strong></div>;
}

function MinorInput({ id, label, value, currency, onChange, disabled, hint }: { id: string; label: string; value: number | null; currency: string; onChange: (value: number | null) => void; disabled?: boolean; hint?: string }) {
  const [text, setText] = useState(moneyInputValue(value));
  const [error, setError] = useState("");
  return <FormField label={label} htmlFor={id} error={error} hint={hint || `Enter ${currency} amount; leave blank when not set.`}><div className="money-field"><input id={id} inputMode="decimal" disabled={disabled} value={text} placeholder="Awaiting confirmation" onChange={(event) => {
    const next = event.target.value;
    setText(next); setError("");
    try { onChange(parseMoneyInput(next)); } catch (issue) { setError(issue instanceof Error ? issue.message : "Enter a valid amount."); }
  }} /><span className="money-code">{currency}</span></div></FormField>;
}

function PricingEditor({ pricing, currency, computed, editable, catalog, selectedCatalogId, setSelectedCatalogId, updatePricing, updateService, updateOption, addCatalogService, addSchedule, addMaintenance, addRecurring, addEnhancement, removePricingItem, refreshPreview, busy }: {
  pricing: PricingInput; currency: string; computed?: PricingResult; editable: boolean; catalog: CatalogService[]; selectedCatalogId: string; setSelectedCatalogId: (value: string) => void;
  updatePricing: (update: (value: PricingInput) => PricingInput) => void; updateService: (index: number, patch: Partial<ServiceItem>) => void; updateOption: (serviceIndex: number, optionIndex: number, patch: Partial<ServiceOption>) => void;
  addCatalogService: () => void; addSchedule: () => void; addMaintenance: () => void; addRecurring: () => void; addEnhancement: () => void; removePricingItem: (key: "services" | "paymentSchedule" | "maintenancePackages" | "otherRecurring" | "optionalEnhancements", index: number, label: string) => void; refreshPreview: () => void; busy: boolean;
}) {
  const scheduleMatches = computed?.implementation.scheduleMatchesFee;
  return <section className="card pricing-editor">
    <div className="card-heading"><div><h2>Pricing</h2><p>Configure prices, payment terms, and recurring service options. Totals below are from the server.</p></div><button className="button button-quiet button-small" disabled={!editable || busy} onClick={refreshPreview}>{busy ? "Saving…" : "Save & refresh totals"}</button></div>
    {!editable && <div className="alert alert-warning section-space">This published draft is read-only. Start a revision before changing prices.</div>}
    <section className="pricing-group"><h3>Implementation fee</h3><div className="form-grid"><MinorInput id="fee-amount" label="Implementation fee" value={pricing.implementationFee.amountMinor} currency={currency} disabled={!editable} onChange={(amountMinor) => updatePricing((current) => ({ ...current, implementationFee: { ...current.implementationFee, amountMinor } }))} /><FormField label="Fee description" htmlFor="fee-description"><input id="fee-description" disabled={!editable} value={pricing.implementationFee.description || ""} onChange={(event) => updatePricing((current) => ({ ...current, implementationFee: { ...current.implementationFee, description: event.target.value } }))} /></FormField></div><label className="toggle-label"><input type="checkbox" disabled={!editable} checked={pricing.implementationFee.confirmed} onChange={(event) => updatePricing((current) => ({ ...current, implementationFee: { ...current.implementationFee, confirmed: event.target.checked } }))} /> Fee confirmed</label></section>
    <section className="pricing-group"><div className="card-heading"><div><h3>Payment schedule</h3><p>Percent entries use basis points on the API. The schedule match indicator is server-calculated.</p></div><button className="button button-quiet button-small" disabled={!editable} onClick={addSchedule}>Add payment +</button></div>
      {pricing.paymentSchedule.length ? <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Type</th><th>Value</th><th>Trigger</th><th>Condition</th><th /></tr></thead><tbody>{pricing.paymentSchedule.map((item, index) => <tr key={item.id}><td><input aria-label="Payment label" disabled={!editable} value={item.label} onChange={(event) => updatePricing((current) => ({ ...current, paymentSchedule: current.paymentSchedule.map((row, i) => i === index ? { ...row, label: event.target.value } : row) }))} /></td><td><select aria-label="Payment amount type" disabled={!editable} value={item.kind} onChange={(event) => updatePricing((current) => ({ ...current, paymentSchedule: current.paymentSchedule.map((row, i) => i === index ? { ...row, kind: event.target.value as "percent" | "fixed" } : row) }))}><option value="percent">Percent</option><option value="fixed">Fixed</option></select></td><td>{item.kind === "percent" ? <BasisPointsInput value={item.percentBps} disabled={!editable} onChange={(percentBps) => updatePricing((current) => ({ ...current, paymentSchedule: current.paymentSchedule.map((row, i) => i === index ? { ...row, percentBps } : row) }))} /> : <MoneyInline value={item.amountMinor ?? null} currency={currency} disabled={!editable} onChange={(amountMinor) => updatePricing((current) => ({ ...current, paymentSchedule: current.paymentSchedule.map((row, i) => i === index ? { ...row, amountMinor } : row) }))} />}</td><td><select aria-label="Payment trigger" disabled={!editable} value={item.trigger} onChange={(event) => updatePricing((current) => ({ ...current, paymentSchedule: current.paymentSchedule.map((row, i) => i === index ? { ...row, trigger: event.target.value as typeof TRIGGERS[number] } : row) }))}>{TRIGGERS.map((trigger) => <option key={trigger} value={trigger}>{trigger.replaceAll("_", " ")}</option>)}</select></td><td><input aria-label="Payment condition" disabled={!editable} value={item.condition} onChange={(event) => updatePricing((current) => ({ ...current, paymentSchedule: current.paymentSchedule.map((row, i) => i === index ? { ...row, condition: event.target.value } : row) }))} /></td><td><button className="button button-quiet button-small" disabled={!editable} onClick={() => removePricingItem("paymentSchedule", index, "payment")}>Remove</button></td></tr>)}</tbody></table></div> : <EmptyState title="No payment terms yet" description="Add schedule rows that explain when each part of the implementation fee is due." />}
      <p className={`schedule-status ${scheduleMatches === true ? "good" : scheduleMatches === false ? "bad" : ""}`}>{scheduleMatches === true ? "✓ Schedule adds up to the implementation fee" : scheduleMatches === false ? "✕ Schedule does not match the implementation fee" : "Save the draft to check schedule against fee"}</p>
    </section>
    <section className="pricing-group"><div className="card-heading"><div><h3>External services</h3><p>Hosting, domains, licenses, and other service costs.</p></div><button className="button button-quiet button-small" disabled={!editable} onClick={() => updatePricing((current) => ({ ...current, services: [...current.services, blankService(currency)] }))}>Add custom service +</button></div>
      {catalog.length > 0 && <div className="catalog-add"><select aria-label="Add service from catalog" value={selectedCatalogId} onChange={(event) => setSelectedCatalogId(event.target.value)}><option value="">Choose from service catalog</option>{catalog.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="button button-quiet button-small" disabled={!editable || !selectedCatalogId} onClick={addCatalogService}>Add selected</button></div>}
      {pricing.services.length ? <div className="stack">{pricing.services.map((service, index) => <article className="pricing-item" key={service.id}><div className="pricing-item-head"><h4>{service.name || `Service ${index + 1}`}</h4><button className="button button-quiet button-small" disabled={!editable} onClick={() => removePricingItem("services", index, "service")}>Remove service</button></div><div className="form-grid"><FormField label="Service name" htmlFor={`service-name-${service.id}`} required><input id={`service-name-${service.id}`} disabled={!editable} value={service.name} onChange={(event) => updateService(index, { name: event.target.value })} /></FormField><FormField label="Provider" htmlFor={`service-provider-${service.id}`}><input id={`service-provider-${service.id}`} disabled={!editable} value={service.provider} onChange={(event) => updateService(index, { provider: event.target.value })} /></FormField></div><FormField label="Description" htmlFor={`service-desc-${service.id}`}><textarea id={`service-desc-${service.id}`} rows={2} disabled={!editable} value={service.description} onChange={(event) => updateService(index, { description: event.target.value })} /></FormField><div className="toggle-row"><Toggle label="Paid at activation" checked={service.payInActivation} disabled={!editable} onChange={(payInActivation) => updateService(index, { payInActivation })} /><Toggle label="Renews" checked={service.recurring} disabled={!editable} onChange={(recurring) => updateService(index, { recurring })} /><Toggle label="Optional" checked={service.optional} disabled={!editable} onChange={(optional) => updateService(index, { optional })} /><Toggle label="Client can choose" checked={service.clientSelectable} disabled={!editable} onChange={(clientSelectable) => updateService(index, { clientSelectable })} /></div>
        <div className="table-wrap section-space"><table><thead><tr><th>Billing option</th><th>Period</th><th>Price</th><th>Tax</th><th>Confirmed</th><th>Selected</th></tr></thead><tbody>{service.options.map((option, optionIndex) => <tr key={option.id}><td><input aria-label="Option label" disabled={!editable} value={option.label || ""} onChange={(event) => updateOption(index, optionIndex, { label: event.target.value })} placeholder="Option name" /></td><td><select aria-label="Billing period" disabled={!editable} value={option.period} onChange={(event) => updateOption(index, optionIndex, { period: event.target.value as BillingPeriod })}>{PERIODS.map((period) => <option key={period} value={period}>{period.replaceAll("_", " ")}</option>)}</select></td><td><MoneyInline value={option.amountMinor} currency={currency} disabled={!editable} onChange={(amountMinor) => updateOption(index, optionIndex, { amountMinor })} /></td><td><MoneyInline value={option.taxMinor} currency={currency} disabled={!editable} onChange={(taxMinor) => updateOption(index, optionIndex, { taxMinor: taxMinor ?? 0 })} /></td><td><input aria-label="Price confirmed" type="checkbox" disabled={!editable} checked={option.confirmed} onChange={(event) => updateOption(index, optionIndex, { confirmed: event.target.checked })} />{option.amountMinor == null && <span className="table-secondary">Awaiting confirmation</span>}</td><td><input aria-label="Select this billing option" type="radio" name={`selected-option-${service.id}`} disabled={!editable} checked={service.selectedOptionId === option.id} onChange={() => updateService(index, { selectedOptionId: option.id })} /></td></tr>)}</tbody></table></div><button className="button button-quiet button-small section-space" disabled={!editable} onClick={() => updateService(index, { options: [...service.options, blankOption(currency)] })}>Add billing option</button>
      </article>)}</div> : <EmptyState title="No external services" description="Add services to show activation costs, renewals, optional items, or usage estimates." />}
    </section>
    <section className="pricing-group"><div className="card-heading"><div><h3>Maintenance packages</h3><p>Select one package when maintenance is included in this proposal.</p></div><button className="button button-quiet button-small" disabled={!editable} onClick={addMaintenance}>Add package +</button></div>{pricing.maintenancePackages.length ? <div className="stack">{pricing.maintenancePackages.map((item, index) => <article className="pricing-item" key={item.id}><div className="form-grid"><FormField label="Package name" htmlFor={`maintenance-name-${item.id}`} required><input id={`maintenance-name-${item.id}`} disabled={!editable} value={item.name} onChange={(event) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => i === index ? { ...row, name: event.target.value } : row) }))} /></FormField><FormField label="Billing period" htmlFor={`maintenance-period-${item.id}`}><select id={`maintenance-period-${item.id}`} disabled={!editable} value={item.period} onChange={(event) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => i === index ? { ...row, period: event.target.value as "monthly" | "annual" | "custom" } : row) }))}><option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></FormField></div><div className="form-grid"><MinorInput id={`maintenance-amount-${item.id}`} label="Price" value={item.amountMinor} currency={currency} disabled={!editable} onChange={(amountMinor) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => i === index ? { ...row, amountMinor } : row) }))} /><FormField label="Included support" htmlFor={`maintenance-included-${item.id}`}><textarea id={`maintenance-included-${item.id}`} disabled={!editable} value={item.includedSupport} onChange={(event) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => i === index ? { ...row, includedSupport: event.target.value } : row) }))} /></FormField></div><div className="toggle-row"><Toggle label="Confirmed" checked={item.confirmed} disabled={!editable} onChange={(confirmed) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => i === index ? { ...row, confirmed } : row) }))} /><Toggle label="Selected package" checked={item.selected} disabled={!editable} onChange={(selected) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => ({ ...row, selected: i === index ? selected : selected ? false : row.selected })) }))} /><Toggle label="Client can choose" checked={item.clientSelectable} disabled={!editable} onChange={(clientSelectable) => updatePricing((current) => ({ ...current, maintenancePackages: current.maintenancePackages.map((row, i) => i === index ? { ...row, clientSelectable } : row) }))} /><button className="button button-quiet button-small" disabled={!editable} onClick={() => removePricingItem("maintenancePackages", index, "maintenance package")}>Remove</button></div></article>)}</div> : <EmptyState title="No maintenance packages" description="Maintenance is optional; add a package when it applies." />}</section>
    <section className="pricing-group"><div className="card-heading"><div><h3>Other recurring fees</h3><p>Recurring costs that are not tied to an external service or maintenance package.</p></div><button className="button button-quiet button-small" disabled={!editable} onClick={addRecurring}>Add recurring fee +</button></div>{pricing.otherRecurring.length ? <div className="stack">{pricing.otherRecurring.map((item, index) => <div className="pricing-item form-grid" key={item.id}><FormField label="Fee label" htmlFor={`recurring-label-${item.id}`}><input id={`recurring-label-${item.id}`} disabled={!editable} value={item.label} onChange={(event) => updatePricing((current) => ({ ...current, otherRecurring: current.otherRecurring.map((row, i) => i === index ? { ...row, label: event.target.value } : row) }))} /></FormField><FormField label="Period" htmlFor={`recurring-period-${item.id}`}><select id={`recurring-period-${item.id}`} disabled={!editable} value={item.period} onChange={(event) => updatePricing((current) => ({ ...current, otherRecurring: current.otherRecurring.map((row, i) => i === index ? { ...row, period: event.target.value as typeof row.period } : row) }))}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="custom">Custom</option></select></FormField><MinorInput id={`recurring-amount-${item.id}`} label="Amount" value={item.amountMinor} currency={currency} disabled={!editable} onChange={(amountMinor) => updatePricing((current) => ({ ...current, otherRecurring: current.otherRecurring.map((row, i) => i === index ? { ...row, amountMinor } : row) }))} /><Toggle label="Confirmed" checked={item.confirmed} disabled={!editable} onChange={(confirmed) => updatePricing((current) => ({ ...current, otherRecurring: current.otherRecurring.map((row, i) => i === index ? { ...row, confirmed } : row) }))} /><button className="button button-quiet button-small" disabled={!editable} onClick={() => removePricingItem("otherRecurring", index, "recurring fee")}>Remove fee</button></div>)}</div> : <EmptyState title="No other recurring fees" description="Add fees that renew each period outside service lines." />}</section>
    <section className="pricing-group"><div className="card-heading"><div><h3>Optional enhancements</h3><p>These choices are offered separately and stay outside mandatory totals.</p></div><button className="button button-quiet button-small" disabled={!editable} onClick={addEnhancement}>Add enhancement +</button></div>{pricing.optionalEnhancements.length ? <div className="stack">{pricing.optionalEnhancements.map((item, index) => <div className="pricing-item form-grid" key={item.id}><FormField label="Enhancement" htmlFor={`enhancement-name-${item.id}`}><input id={`enhancement-name-${item.id}`} disabled={!editable} value={item.name} onChange={(event) => updatePricing((current) => ({ ...current, optionalEnhancements: current.optionalEnhancements.map((row, i) => i === index ? { ...row, name: event.target.value } : row) }))} /></FormField><FormField label="Description" htmlFor={`enhancement-description-${item.id}`}><input id={`enhancement-description-${item.id}`} disabled={!editable} value={item.description} onChange={(event) => updatePricing((current) => ({ ...current, optionalEnhancements: current.optionalEnhancements.map((row, i) => i === index ? { ...row, description: event.target.value } : row) }))} /></FormField><MinorInput id={`enhancement-amount-${item.id}`} label="Price" value={item.amountMinor} currency={currency} disabled={!editable} onChange={(amountMinor) => updatePricing((current) => ({ ...current, optionalEnhancements: current.optionalEnhancements.map((row, i) => i === index ? { ...row, amountMinor } : row) }))} /><Toggle label="Confirmed" checked={item.confirmed} disabled={!editable} onChange={(confirmed) => updatePricing((current) => ({ ...current, optionalEnhancements: current.optionalEnhancements.map((row, i) => i === index ? { ...row, confirmed } : row) }))} /><button className="button button-quiet button-small" disabled={!editable} onClick={() => removePricingItem("optionalEnhancements", index, "enhancement")}>Remove enhancement</button></div>)}</div> : <EmptyState title="No optional enhancements" description="Add optional choices if the client may want to include them." />}</section>
    <div className="button-row"><button className="button button-primary" disabled={!editable || busy} onClick={refreshPreview}>{busy ? "Saving…" : "Save pricing & refresh totals"}</button></div>
  </section>;
}

function bpsText(value?: number | null) {
  if (value == null) return "";
  if (!Number.isSafeInteger(value)) return String(value);
  const bps = BigInt(value);
  return `${bps / BigInt(100)}.${String(bps % BigInt(100)).padStart(2, "0")}`;
}

function parsePercentBps(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+(?:\.\d{0,2})?$/.test(raw)) {
    throw new Error("Enter a percentage with up to two decimal places.");
  }
  const [whole = "0", fraction = ""] = raw.split(".");
  const bps = BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
  if (bps > BigInt(10000)) throw new Error("Percentage cannot exceed 100.");
  return Number(bps);
}

function MoneyInline({ value, currency, disabled, onChange }: { value: number | null; currency: string; disabled?: boolean; onChange: (value: number | null) => void }) {
  const [text, setText] = useState(moneyInputValue(value));
  const [error, setError] = useState("");
  return <div><input className="money-inline" aria-label={`Amount in ${currency}`} inputMode="decimal" placeholder="Not set" disabled={disabled} value={text} onChange={(event) => {
    setText(event.target.value);
    try { onChange(parseMoneyInput(event.target.value)); setError(""); }
    catch (issue) { setError(issue instanceof Error ? issue.message : "Enter a valid amount."); }
  }} />{error && <span className="field-error inline-error" role="alert">{error}</span>}</div>;
}

function BasisPointsInput({ value, disabled, onChange }: { value?: number | null; disabled?: boolean; onChange: (value: number | null) => void }) {
  const [text, setText] = useState(bpsText(value));
  const [error, setError] = useState(value != null && (!Number.isSafeInteger(value) || value < 0 || value > 10000) ? "Stored percentage is not a valid whole basis-point value; enter it again." : "");
  return <div><input aria-label="Payment percentage" inputMode="decimal" disabled={disabled} value={text} onChange={(event) => {
    setText(event.target.value);
    try {
      const bps = parsePercentBps(event.target.value);
      onChange(bps); setError("");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Enter a valid percentage."); }
  }} />{error && <span className="field-error inline-error" role="alert">{error}</span>}</div>;
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="toggle-label"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
