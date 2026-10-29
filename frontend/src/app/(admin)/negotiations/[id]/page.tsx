"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { FormField, useToast } from "@/components/ui";

type Negotiation = { id: string; proposalId: string; versionLabel: string; kind: string; status: string; subject: string; message: string; reason: string | null; proposedBudgetMinor: number | null; proposedPaymentTerms: string | null; selections: unknown; submittedByName: string; submittedByEmail: string; resolutionNote: string | null; createdAt: string };
type ThreadMessage = { id: string; author: "client" | "developer"; visibility: "client" | "internal"; body: string; createdAt: string };
type DetailData = { request: Negotiation; messages: ThreadMessage[]; proposal: { id: string; reference: string; title: string; status: string; latestVersionLabel?: string } };
const DECISIONS = ["answered", "agreed", "declined", "countered", "closed"] as const;

export default function NegotiationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [visibility, setVisibility] = useState<"client" | "internal">("client");
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]>("answered");
  const [clientNote, setClientNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function load() {
    setError("");
    try { setData(await api.get<DetailData>(`/negotiations/${encodeURIComponent(id)}`)); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "This negotiation could not be loaded."); }
  }
  useEffect(() => {
    let active = true;
    api.get<DetailData>(`/negotiations/${encodeURIComponent(id)}`).then((result) => {
      if (active) setData(result);
    }).catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "This negotiation could not be loaded."); });
    return () => { active = false; };
  }, [id]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api.post(`/negotiations/${encodeURIComponent(id)}/messages`, { body: reply, visibility });
      setReply(""); await load(); toast(visibility === "internal" ? "Internal note added." : "Client reply sent.");
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The message could not be sent."); }
    finally { setBusy(false); }
  }
  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientNote.trim()) { setError("Add a client-visible explanation before saving a decision."); return; }
    setBusy(true); setError("");
    try {
      await api.post(`/negotiations/${encodeURIComponent(id)}/resolve`, { resolution: decision, note: clientNote });
      setClientNote(""); await load(); toast("Decision saved and client-visible note added.");
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The decision could not be saved."); }
    finally { setBusy(false); }
  }

  if (error && !data) return <div className="page-shell"><div className="alert alert-error" role="alert">{error}</div><button className="button button-quiet section-space" onClick={() => void load()}>Retry</button></div>;
  if (!data) return <div className="loading" role="status">Opening conversation…</div>;
  const request = data.request;
  return <div className="page-shell">
    <div className="page-heading"><div><Link className="table-secondary" href="/negotiations">← Negotiations inbox</Link><p className="eyebrow section-space">{request.kind.replaceAll("_", " ")} · version {request.versionLabel}</p><h1>{request.subject}</h1><p>{request.submittedByName} · {request.submittedByEmail} · {new Date(request.createdAt).toLocaleString()}</p></div><Link className="button button-quiet" href={`/proposals/${encodeURIComponent(data.proposal.id)}`}>{data.proposal.reference} proposal</Link></div>
    {error && <div className="alert alert-error section-space" role="alert">{error}</div>}
    <div className="grid grid-2">
      <section className="card"><div className="card-heading"><div><h2>Client request</h2><p>Submitted against proposal {request.versionLabel}.</p></div><span className="badge badge-amber">{request.status}</span></div>
        <p className="content-prose">{request.message}</p>{request.reason && <><hr className="divider" /><p className="section-kicker">REASON</p><p className="content-prose section-space">{request.reason}</p></>}
        {request.proposedBudgetMinor != null && <div className="alert alert-warning section-space"><strong>Proposed budget</strong><p><span className="font-mono">{formatMoney(request.proposedBudgetMinor, "GHS")}</span></p></div>}
        {request.proposedPaymentTerms && <div className="section-space"><p className="section-kicker">PROPOSED PAYMENT TERMS</p><p className="content-prose section-space">{request.proposedPaymentTerms}</p></div>}
        {Boolean(request.selections) && <div className="section-space"><p className="section-kicker">OPTION SELECTIONS</p><pre className="compare-output">{JSON.stringify(request.selections, null, 2)}</pre></div>}
        {request.resolutionNote && <div className="alert alert-success section-space"><strong>Your client-visible decision note</strong><p>{request.resolutionNote}</p></div>}
      </section>
      <section className="card"><div className="card-heading"><div><h2>Conversation</h2><p>Private notes are visible only to your team.</p></div></div><div className="thread">
        <article className="thread-message client-message"><span className="thread-label">CLIENT · REQUEST</span><p>{request.message}</p><small>{new Date(request.createdAt).toLocaleString()}</small></article>
        {data.messages.map((message) => <article key={message.id} className={`thread-message ${message.visibility === "internal" ? "internal-message" : message.author === "client" ? "client-message" : "developer-message"}`}><span className="thread-label">{message.visibility === "internal" ? "PRIVATE INTERNAL NOTE" : message.author === "client" ? "CLIENT" : "YOUR REPLY"}</span><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small></article>)}
      </div>
        <form className="form-stack section-space" onSubmit={(event) => void sendMessage(event)}><FormField label="Reply type" htmlFor="reply-visibility"><select id="reply-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as "client" | "internal")}><option value="client">Reply to client</option><option value="internal">Internal note (private)</option></select></FormField><FormField label={visibility === "internal" ? "Private note" : "Message to client"} htmlFor="reply-body" required><textarea id="reply-body" required value={reply} onChange={(event) => setReply(event.target.value)} /></FormField><button className="button button-primary" disabled={busy}>{busy ? "Sending…" : visibility === "internal" ? "Add internal note" : "Send reply"}</button></form>
      </section>
    </div>
    <section className="card section-space"><div className="card-heading"><div><h2>Record a decision</h2><p>Decisions are recorded with a note visible to the client.</p></div></div>
      <div className="alert alert-warning">Agreeing to or countering a request moves the proposal to <strong>revision in progress</strong>. Nothing changes in the proposal terms until you publish a new version and the client accepts it.</div>
      <form className="form-stack section-space" onSubmit={(event) => void resolve(event)}><div className="form-grid"><FormField label="Decision" htmlFor="neg-decision" required><select id="neg-decision" value={decision} onChange={(event) => setDecision(event.target.value as (typeof DECISIONS)[number])}>{DECISIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></FormField><div className="decision-help"><strong>{decision === "agreed" || decision === "countered" ? "Revision will begin" : decision === "answered" ? "Request will be marked answered" : decision === "declined" ? "Request will be declined" : "Request will be closed"}</strong><small>{decision === "agreed" || decision === "countered" ? "You will still need to update the draft, publish a version, and receive acceptance before terms change." : "This records the response without editing the proposal terms."}</small></div></div><FormField label="Client-visible explanation" htmlFor="neg-client-note" required><textarea id="neg-client-note" required value={clientNote} onChange={(event) => setClientNote(event.target.value)} /></FormField><button className="button button-primary" disabled={busy || request.status === "closed"}>{busy ? "Saving…" : "Save decision"}</button></form>
    </section>
  </div>;
}
