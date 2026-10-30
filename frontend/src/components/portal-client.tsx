"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { api, ApiError } from "@/lib/api";
import { downloadDocument, printDocument } from "@/lib/document-actions";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import type { PricingResult, ProposalSnapshot, ProposalStatus } from "@/types/api";

type PortalMessage = { id: string; author: "client" | "developer"; body: string; createdAt: string };
type PortalRequest = { id: string; kind: string; status: string; subject: string; message: string; versionLabel: string; createdAt: string; resolutionNote: string | null; messages: PortalMessage[] };
type PortalData = {
  status: ProposalStatus;
  canRespond: boolean;
  version: { id: string; label: string; contentHash: string; publishedAt: string; validUntil: string | null };
  proposal: ProposalSnapshot;
  requests: PortalRequest[];
  acceptance: null | { versionLabel: string; acceptedByName: string; acceptedAt: string; contentHash: string };
  acceptanceStatementTemplate: string;
};
type SelectionPreview = { current: PricingResult; requested: PricingResult; awaitingDeveloperApproval: boolean; notice: string };
type Action = "accept" | "question" | "change" | "decline";
const CHANGE_KINDS = ["scope_change", "price_change", "payment_term_change", "general"] as const;
const DOCUMENT_KINDS = ["proposal", "cost_breakdown", "scope", "payment_schedule", "acceptance_record"] as const;

function accentForeground(color: string) {
  const channels = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!channels) return "#fff";
  const [red, green, blue] = channels.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = [red, green, blue].map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179 ? "#17211d" : "#fff";
}

export function PortalClient({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLDivElement>(null);
  const [documentHtml, setDocumentHtml] = useState("");
  const documentFrame = useRef<HTMLIFrameElement>(null);
  const [selectionPreview, setSelectionPreview] = useState<SelectionPreview | null>(null);
  const [selectedServices, setSelectedServices] = useState<Record<string, string>>({});
  const [selectedMaintenance, setSelectedMaintenance] = useState("");
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [acceptForm, setAcceptForm] = useState({ name: "", email: "", title: "", organization: "", confirm: false });
  const [requestForm, setRequestForm] = useState({ kind: "clarification", subject: "", message: "", reason: "", proposedBudget: "", proposedPaymentTerms: "", name: "", email: "" });
  const [declineReason, setDeclineReason] = useState("");
  const [budgetError, setBudgetError] = useState("");

  async function load() {
    setError("");
    try { setData(await api.publicGet<PortalData>(`/public/proposals/${encodeURIComponent(token)}`)); }
    catch (issue) { setError(issue instanceof ApiError && issue.status === 404 ? "This proposal link is invalid or no longer available." : issue instanceof ApiError ? issue.message : "The proposal could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.publicGet<PortalData>(`/public/proposals/${encodeURIComponent(token)}`).then((result) => {
      if (!active) return;
      setData(result);
      setSelectedServices(Object.fromEntries(result.proposal.pricing.services.filter((service) => service.clientSelectable && service.selectedOptionId).map((service) => [service.id, service.selectedOptionId as string])));
      const selectedPackage = result.proposal.pricing.maintenancePackages.find((item) => item.clientSelectable && item.selected);
      setSelectedMaintenance(selectedPackage?.id ?? "");
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError && issue.status === 404 ? "This proposal link is invalid or no longer available." : issue instanceof ApiError ? issue.message : "The proposal could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [notice]);

  const proposal = data?.proposal;
  const selectedPayload = useMemo(() => ({
    services: Object.entries(selectedServices).map(([itemId, optionId]) => ({ itemId, optionId })),
    ...(selectedMaintenance ? { maintenancePackageId: selectedMaintenance } : {}),
  }), [selectedServices, selectedMaintenance]);

  async function previewSelections() {
    setError("");
    try { setSelectionPreview(await api.publicPost<SelectionPreview>(`/public/proposals/${encodeURIComponent(token)}/selection-preview`, selectedPayload)); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "Selection preview is unavailable."); }
  }
  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    let proposedBudgetMinor: number | null = null;
    if (requestForm.proposedBudget.trim()) {
      try { proposedBudgetMinor = parseMoneyInput(requestForm.proposedBudget); setBudgetError(""); }
      catch (issue) { setBudgetError(issue instanceof Error ? issue.message : "Enter a valid budget."); setBusy(false); return; }
    }
    const body = {
      kind: requestForm.kind,
      subject: requestForm.subject,
      message: requestForm.message,
      reason: requestForm.reason || undefined,
      proposedBudgetMinor,
      proposedPaymentTerms: requestForm.proposedPaymentTerms || undefined,
      name: requestForm.name,
      email: requestForm.email,
      ...(requestForm.kind === "service_selection" ? selectedPayload : {}),
    };
    try {
      const result = await api.publicPost<{ notice: string }>(`/public/proposals/${encodeURIComponent(token)}/negotiations`, body);
      setNotice(result.notice); setAction(null); setRequestForm({ ...requestForm, subject: "", message: "", reason: "" }); setSelectionPreview(null); await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "Your request could not be sent."); }
    finally { setBusy(false); }
  }
  async function sendFollowUp(requestId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = followUps[requestId]?.trim();
    if (!body) return;
    setError(""); setNotice("");
    try {
      await api.publicPost(`/public/proposals/${encodeURIComponent(token)}/negotiations/${encodeURIComponent(requestId)}/messages`, { body });
      setFollowUps((current) => ({ ...current, [requestId]: "" }));
      setNotice("Your message has been sent.");
      await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "Your message could not be sent."); }
  }
  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.publicPost(`/public/proposals/${encodeURIComponent(token)}/accept`, {
        name: acceptForm.name, email: acceptForm.email, title: acceptForm.title || undefined, organization: acceptForm.organization || undefined,
        confirm: true, versionId: data.version.id, contentHash: data.version.contentHash,
      });
      setNotice("Thank you. Your acceptance has been recorded for this version.");
      await load();
    } catch (issue) {
      setError(issue instanceof ApiError && issue.status === 409
        ? "This proposal was updated. Reload the page and review the current version before accepting."
        : issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "Your acceptance could not be recorded.");
    } finally { setBusy(false); }
  }
  async function decline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api.publicPost(`/public/proposals/${encodeURIComponent(token)}/reject`, { reason: declineReason || undefined });
      setAction(null); setNotice("Your response has been recorded."); await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "Your response could not be recorded."); }
    finally { setBusy(false); }
  }
  async function openDocument(kind: typeof DOCUMENT_KINDS[number]) {
    setError("");
    try { setDocumentHtml(await api.publicGet<string>(`/public/proposals/${encodeURIComponent(token)}/document?kind=${encodeURIComponent(kind)}`)); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The document could not be opened."); }
  }

  if (loading) return <main className="portal-page"><div className="portal-loading" role="status">Preparing your proposal…</div></main>;
  if (!data || !proposal) return <main className="portal-page"><section className="portal-error"><span className="portal-mark">f.</span><p className="eyebrow">CLIENT PORTAL</p><h1>This link is unavailable.</h1><p>{error || "The proposal could not be loaded."}</p><p className="muted">If you believe this link should be active, contact the person who shared it with you.</p></section></main>;
  const inactive = ["expired", "rejected", "revision_in_progress", "withdrawn"].includes(data.status);
  const acceptanceText = data.acceptanceStatementTemplate.replace(/\[your full name\]/gi, acceptForm.name || "[your full name]");
  const style = {
    "--portal-accent": proposal.portal.accentColor,
    "--portal-accent-foreground": accentForeground(proposal.portal.accentColor),
  } as CSSProperties;

  return <main className="portal-page" style={style}>
    <header className="portal-header"><div className="portal-brand"><Image src="/digitalfred-symbol.svg" alt="" width={48} height={48} priority /><div><strong>{proposal.business.name || proposal.business.legalName || "Proposal"}</strong>{proposal.portal.tagline && <small>{proposal.portal.tagline}</small>}</div></div><div className="portal-header-right"><span className="font-mono">{proposal.reference}</span><span className="portal-version">Version {data.version.label}</span></div></header>
    <div className="portal-intro"><p className="eyebrow">{proposal.kind === "amendment" ? "AMENDMENT" : "PROPOSAL"} · {proposal.project.name}</p><h1>{proposal.title}</h1><p>{proposal.client.displayName} · Published {new Date(data.version.publishedAt).toLocaleDateString()}{data.version.validUntil ? ` · Valid until ${new Date(data.version.validUntil).toLocaleDateString()}` : ""}</p><span className="portal-status">{data.status.replaceAll("_", " ")}</span></div>
    {error && <div className="portal-alert portal-alert-error" role="alert">{error}<button className="portal-action portal-secondary" onClick={() => void load()}>Reload proposal</button></div>}
    {notice && <div ref={noticeRef} className="portal-alert portal-alert-success" role="status">{notice}</div>}
    {inactive && <div className="portal-alert portal-alert-neutral"><strong>{inactiveTitle(data.status)}</strong><p>{inactiveDescription(data.status)}</p></div>}
    {data.acceptance && <section className="portal-acceptance"><span className="portal-check">✓</span><div><p className="eyebrow">ACCEPTANCE RECORDED</p><h2>Thank you, {data.acceptance.acceptedByName}.</h2><p>Version {data.acceptance.versionLabel} · {new Date(data.acceptance.acceptedAt).toLocaleString()}</p><code>{data.acceptance.contentHash}</code><button className="portal-action portal-secondary" onClick={() => void openDocument("acceptance_record")}>Download acceptance record</button></div></section>}
    <nav className="portal-toc" aria-label="On this page">{[["overview", "Overview"], ["costs", "Costs"], ["documents", "Documents"], ["conversation", "Conversation"]].map(([href, label]) => <a href={`#${href}`} key={href}>{label}</a>)}</nav>
    <div className="portal-content">
      <article className="portal-main">
        <section id="overview" className="portal-section"><p className="eyebrow">THE PROPOSAL</p><h2>Scope & approach</h2>{proposal.sections.length ? proposal.sections.map((section) => <section key={section.id} className="portal-copy-section"><h3>{section.title}</h3><p>{section.body || "No additional detail has been provided for this section."}</p></section>) : <p className="muted">No proposal sections were included in this version.</p>}
          {proposal.srs && <details className="portal-srs"><summary>Requirements document · {proposal.srs.label}</summary><div className="portal-srs-content"><h3>{proposal.srs.title}</h3>{proposal.srs.sections.map((section) => <section key={section.id}><h4>{section.title}</h4><p>{section.body}</p></section>)}{proposal.srs.requirements.length > 0 && <p className="portal-note">{proposal.srs.requirements.length} structured requirements are included in this document version.</p>}</div></details>}
        </section>
        <section id="costs" className="portal-section"><p className="eyebrow">INVESTMENT</p><h2>Costs & payment schedule</h2><div className="portal-cost-group"><h3>Implementation fee & payment schedule</h3><p className="portal-cost-total implementation-total">{formatMoney(proposal.computed.implementation.amountMinor, proposal.currency)}{proposal.computed.implementation.confirmed ? <small>Confirmed</small> : <small>Estimate / awaiting confirmation</small>}</p>{proposal.computed.implementation.schedule.length ? <div className="portal-cost-lines">{proposal.computed.implementation.schedule.map((payment) => <div className="portal-cost-line" key={payment.id}><span><strong>{payment.label}</strong><small>{payment.trigger.replaceAll("_", " ")}{payment.condition ? ` · ${payment.condition}` : ""}{payment.dueDate ? ` · due ${payment.dueDate}` : ""}</small></span><strong>{formatMoney(payment.amountMinor, proposal.currency)}</strong></div>)}</div> : <p className="portal-muted">Payment schedule has not been configured.</p>}</div>
          <div className="portal-cost-group"><h3>Initial service activation</h3><div className="portal-cost-lines">{proposal.computed.activation.lines.length ? proposal.computed.activation.lines.map((line) => <CostLine key={line.id} line={line} currency={proposal.currency} />) : <p className="portal-muted">No initial service activation is listed.</p>}<div className="portal-cost-total small-total"><span>Initial activation total</span><strong>{formatMoney(proposal.computed.activation.total.totalMinor, proposal.currency)}</strong></div></div><p className="portal-note">The initial payment covers only the initial service period. Future renewals are listed separately below.</p></div>
          <div className="portal-cost-group"><h3>Future renewals & maintenance</h3><div className="portal-cost-lines">{proposal.computed.recurring.lines.length ? proposal.computed.recurring.lines.map((line) => <CostLine key={line.id} line={line} currency={proposal.currency} />) : <p className="portal-muted">No recurring costs are listed.</p>}</div><div className="portal-cost-lines portal-cost-equivalents"><CostSummary label="Monthly" amount={proposal.computed.recurring.byPeriod.monthly.totalMinor} currency={proposal.currency} /><CostSummary label="Quarterly" amount={proposal.computed.recurring.byPeriod.quarterly.totalMinor} currency={proposal.currency} /><CostSummary label="Annual" amount={proposal.computed.recurring.byPeriod.annual.totalMinor} currency={proposal.currency} /><CostSummary label="Annual equivalent · approx." amount={proposal.computed.recurring.annualEquivalent.totalMinor} currency={proposal.currency} /><CostSummary label="Monthly average · approx." amount={proposal.computed.recurring.monthlyEquivalent.totalMinor} currency={proposal.currency} /></div></div>
          <div className="portal-cost-group"><h3>Usage-based estimates</h3><p className="portal-note">Variable usage charges are estimates and are not guaranteed totals.</p><div className="portal-cost-lines">{proposal.computed.usage.lines.length ? proposal.computed.usage.lines.map((line) => <CostLine key={line.id} line={line} currency={proposal.currency} />) : <p className="portal-muted">No usage-based charges are listed.</p>}</div></div>
          <div className="portal-cost-group"><h3>Optional</h3><div className="portal-cost-lines">{proposal.computed.optional.services.length ? proposal.computed.optional.services.map((line) => <CostLine key={line.id} line={line} currency={proposal.currency} />) : null}{proposal.computed.optional.enhancements.length ? proposal.computed.optional.enhancements.map((item) => <div className="portal-cost-line" key={item.id}><span><strong>{item.name}</strong><small>{item.status === "confirmed" ? "Confirmed" : item.status === "estimated" ? "Estimate" : "Awaiting confirmation"}</small></span><strong>{formatMoney(item.amountMinor, proposal.currency)}</strong></div>) : null}{!proposal.computed.optional.services.length && !proposal.computed.optional.enhancements.length && <p className="portal-muted">No optional items are listed.</p>}</div></div>
          <div className="portal-payable"><span>Payable before development</span><strong>{formatMoney(proposal.computed.payableBeforeDevelopment.totalMinor, proposal.currency)}</strong>{proposal.computed.payableBeforeDevelopment.provisional && <small>Provisional · includes estimates or unpriced lines</small>}</div>
        </section>
        {proposal.clientCanRequestOptionChanges && data.canRespond && <section className="portal-section"><p className="eyebrow">CONFIGURE OPTIONS</p><h2>Choose service options</h2><p className="portal-muted">Previewing your choices does not change the proposal. Submit a request for developer review.</p>
          {proposal.pricing.services.filter((service) => service.clientSelectable).map((service) => <label className="portal-field" key={service.id}><span>{service.name}</span><select value={selectedServices[service.id] || ""} onChange={(event) => setSelectedServices((current) => ({ ...current, [service.id]: event.target.value }))}><option value="">Choose an option</option>{service.options.map((option) => <option value={option.id} key={option.id}>{option.label || option.period.replaceAll("_", " ")} · {option.amountMinor == null ? "Awaiting confirmation" : formatMoney(option.amountMinor, proposal.currency)}</option>)}</select></label>)}
          {proposal.pricing.maintenancePackages.some((item) => item.clientSelectable) && <label className="portal-field"><span>Maintenance package</span><select value={selectedMaintenance} onChange={(event) => setSelectedMaintenance(event.target.value)}><option value="">No package selected</option>{proposal.pricing.maintenancePackages.filter((item) => item.clientSelectable).map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.amountMinor, item.currency)}</option>)}</select></label>}
          <button className="portal-action portal-secondary" onClick={() => void previewSelections()}>Preview selected options</button>
          {selectionPreview && <div className="portal-preview"><h3>Comparison</h3><div><span>Current payable before development</span><strong>{formatMoney(selectionPreview.current.payableBeforeDevelopment.totalMinor, proposal.currency)}</strong></div><div><span>Requested payable before development</span><strong>{formatMoney(selectionPreview.requested.payableBeforeDevelopment.totalMinor, proposal.currency)}</strong></div><p>{selectionPreview.notice}</p>{selectionPreview.awaitingDeveloperApproval && <small>Awaiting developer approval; not applied until a revised proposal is issued.</small>}<button className="portal-action portal-primary" onClick={() => { setRequestForm({ ...requestForm, kind: "service_selection", subject: "Service option selection", message: "", name: acceptForm.name, email: acceptForm.email }); setAction("question"); }}>Submit selection request</button></div>}
        </section>}
        <section id="documents" className="portal-section"><p className="eyebrow">DOCUMENTS</p><h2>Read or download</h2><div className="portal-document-list">{DOCUMENT_KINDS.filter((kind) => kind !== "acceptance_record" || Boolean(data.acceptance)).map((kind) => <button key={kind} className="portal-document-button" onClick={() => void openDocument(kind)}>{kind.replaceAll("_", " ")} <span aria-hidden="true">↗</span></button>)}</div></section>
        <section id="conversation" className="portal-section"><p className="eyebrow">CONVERSATION</p><h2>Requests & replies</h2>{data.requests.length ? <div className="portal-requests">{data.requests.map((request) => <article className="portal-request" key={request.id}><div className="portal-request-header"><strong>{request.subject}</strong><span>{request.status}</span></div><p className="portal-request-kind">{request.kind.replaceAll("_", " ")} · version {request.versionLabel} · {new Date(request.createdAt).toLocaleDateString()}</p><p>{request.message}</p>{request.resolutionNote && <div className="portal-response-note"><strong>Response</strong><p>{request.resolutionNote}</p></div>}{request.messages.map((message) => <div className={`portal-thread-message ${message.author}`} key={message.id}><strong>{message.author === "client" ? "You" : proposal.business.name || "Developer"}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small></div>)}{data.canRespond && request.status !== "closed" && <form className="portal-follow-up" onSubmit={(event) => void sendFollowUp(request.id, event)}><label htmlFor={`follow-up-${request.id}`}>Add a follow-up</label><textarea id={`follow-up-${request.id}`} value={followUps[request.id] || ""} onChange={(event) => setFollowUps((current) => ({ ...current, [request.id]: event.target.value }))} required /><button className="portal-action portal-secondary">Send message</button></form>}</article>)}</div> : <p className="portal-muted">There are no requests yet.</p>}</section>
      </article>
      <aside className="portal-side"><div className="portal-side-card"><p className="eyebrow">A QUICK SUMMARY</p><h3>Payable before development</h3><strong className="portal-side-total">{formatMoney(proposal.computed.payableBeforeDevelopment.totalMinor, proposal.currency)}</strong>{proposal.computed.provisional && <span className="portal-provisional">Provisional estimate</span>}<hr /><p>{proposal.project.description}</p></div>
        {data.canRespond && !data.acceptance && <div className="portal-action-card"><h3>Ready to respond?</h3><button className="portal-action portal-primary" onClick={() => setAction("accept")}>Accept proposal</button><button className="portal-action portal-secondary" onClick={() => { setRequestForm({ ...requestForm, kind: "clarification" }); setAction("question"); }}>Ask a question</button><button className="portal-action portal-secondary" onClick={() => { setRequestForm({ ...requestForm, kind: "scope_change" }); setAction("change"); }}>Request a change</button><button className="portal-link-button" onClick={() => setAction("decline")}>Decline proposal</button><p className="portal-muted">The proposal’s terms change only after a new version is issued and accepted.</p></div>}
      </aside>
    </div>
    <footer className="portal-footer">{proposal.portal.footerNote && <p>{proposal.portal.footerNote}</p>}<p>{proposal.business.name || proposal.business.legalName}{proposal.business.email ? ` · ${proposal.business.email}` : ""}</p></footer>
    {action && <div className="portal-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setAction(null); }}><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="portal-action-title"><div className="portal-modal-heading"><div><p className="eyebrow">{action === "accept" ? "RECORD AGREEMENT" : action === "decline" ? "DECLINE" : "CLIENT REQUEST"}</p><h2 id="portal-action-title">{actionTitle(action)}</h2></div><button className="portal-close" aria-label="Close dialog" onClick={() => setAction(null)}>×</button></div>
      {action === "accept" && <form className="portal-form" onSubmit={(event) => void accept(event)}><div className="portal-form-grid"><PortalField label="Full name" value={acceptForm.name} onChange={(name) => setAcceptForm({ ...acceptForm, name })} required /><PortalField label="Email address" type="email" value={acceptForm.email} onChange={(email) => setAcceptForm({ ...acceptForm, email })} required /><PortalField label="Title (optional)" value={acceptForm.title} onChange={(title) => setAcceptForm({ ...acceptForm, title })} /><PortalField label="Organisation (optional)" value={acceptForm.organization} onChange={(organization) => setAcceptForm({ ...acceptForm, organization })} /></div><div className="portal-statement"><p>{acceptanceText}</p></div><label className="portal-check-label"><input type="checkbox" required checked={acceptForm.confirm} onChange={(event) => setAcceptForm({ ...acceptForm, confirm: event.target.checked })} /><span>I confirm that the statement above is accurate and I have authority to accept this version.</span></label>{error && <p className="portal-inline-error" role="alert">{error}</p>}<button className="portal-action portal-primary" disabled={busy}>{busy ? "Recording acceptance…" : "Confirm acceptance"}</button></form>}
      {(action === "question" || action === "change") && <form className="portal-form" onSubmit={(event) => void submitRequest(event)}><div className="portal-form-grid">{action === "change" && <label className="portal-field"><span>Request type</span><select value={requestForm.kind} onChange={(event) => setRequestForm({ ...requestForm, kind: event.target.value })}>{CHANGE_KINDS.map((kind) => <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>)}</select></label>}<PortalField label="Your name" value={requestForm.name} onChange={(name) => setRequestForm({ ...requestForm, name })} required /><PortalField label="Email address" type="email" value={requestForm.email} onChange={(email) => setRequestForm({ ...requestForm, email })} required /></div><PortalField label="Subject" value={requestForm.subject} onChange={(subject) => setRequestForm({ ...requestForm, subject })} required /><label className="portal-field"><span>Message</span><textarea required value={requestForm.message} onChange={(event) => setRequestForm({ ...requestForm, message: event.target.value })} /></label>{action === "change" && <><label className="portal-field"><span>Reason</span><textarea value={requestForm.reason} onChange={(event) => setRequestForm({ ...requestForm, reason: event.target.value })} /></label>{requestForm.kind === "price_change" && <label className="portal-field"><span>Proposed budget ({proposal.currency})</span><input inputMode="decimal" value={requestForm.proposedBudget} onChange={(event) => { setRequestForm({ ...requestForm, proposedBudget: event.target.value }); setBudgetError(""); }} placeholder="1,234.56" />{budgetError && <small className="portal-inline-error">{budgetError}</small>}</label>}{requestForm.kind === "payment_term_change" && <label className="portal-field"><span>Proposed payment terms</span><textarea value={requestForm.proposedPaymentTerms} onChange={(event) => setRequestForm({ ...requestForm, proposedPaymentTerms: event.target.value })} /></label>}</>}{error && <p className="portal-inline-error" role="alert">{error}</p>}<p className="portal-muted">Sending a request does not change the published proposal. Any new terms require a revised version and your acceptance.</p><button className="portal-action portal-primary" disabled={busy}>{busy ? "Sending…" : action === "change" ? "Send change request" : "Send question"}</button></form>}
      {action === "decline" && <form className="portal-form" onSubmit={(event) => void decline(event)}><p className="portal-muted">You can optionally share a reason. This response will be recorded against version {data.version.label}.</p><label className="portal-field"><span>Reason (optional)</span><textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} /></label>{error && <p className="portal-inline-error" role="alert">{error}</p>}<button className="portal-action portal-danger" disabled={busy}>{busy ? "Recording…" : "Confirm decline"}</button></form>}
    </section></div>}
    {documentHtml && <div className="portal-document-overlay"><div className="portal-doc-bar"><strong>Proposal document</strong><div className="button-row"><button className="portal-action portal-secondary" onClick={() => downloadDocument(documentHtml, `${proposal.title}-document`)}>Save a copy</button><button className="portal-action portal-secondary" onClick={() => { try { printDocument(documentFrame.current); } catch (issue) { setError(issue instanceof Error ? issue.message : "The document could not be printed."); } }}>Print</button><button className="portal-action portal-secondary" onClick={() => setDocumentHtml("")}>Close</button></div></div><iframe ref={documentFrame} title="Proposal document preview" sandbox="allow-scripts allow-modals" srcDoc={documentHtml} /></div>}
  </main>;
}

function CostLine({ line, currency }: { line: ProposalSnapshot["computed"]["activation"]["lines"][number]; currency: string }) {
  const statusText = line.status === "confirmed" ? "Confirmed" : line.status === "estimated" ? "Estimate" : "Awaiting confirmation";
  return <div className="portal-cost-line"><span><strong>{line.label}</strong><small>{line.provider ? `${line.provider} · ` : ""}{line.period.replaceAll("_", " ")} · {statusText}{line.paymentDeadline ? ` · due ${line.paymentDeadline}` : ""}{line.renewalDate ? ` · renews ${line.renewalDate}` : ""}</small></span><strong>{formatMoney(line.totalMinor, currency)}</strong></div>;
}

function CostSummary({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return <div className="portal-cost-line"><span>{label}</span><strong>{formatMoney(amount, currency)}</strong></div>;
}

function PortalField({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  const id = `portal-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return <label className="portal-field" htmlFor={id}><span>{label}</span><input id={id} type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function actionTitle(action: Action) {
  return action === "accept" ? "Accept this proposal" : action === "decline" ? "Decline this proposal" : action === "change" ? "Request a change" : "Ask a question";
}
function inactiveTitle(status: ProposalStatus) {
  return status === "expired" ? "This proposal has expired." : status === "rejected" ? "This proposal was declined." : status === "revision_in_progress" ? "A revision is being prepared." : "This proposal is no longer active.";
}
function inactiveDescription(status: ProposalStatus) {
  return status === "expired" ? "The validity period has passed. Contact the developer if you would like to discuss a current version." : status === "rejected" ? "Thank you for reviewing it. Contact the developer if you would like to continue the conversation." : status === "revision_in_progress" ? "The current version is not open for acceptance while a new version is being prepared." : "Contact the developer for further information.";
}
