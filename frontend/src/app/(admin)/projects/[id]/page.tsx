"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { EmptyState, FormField, useToast } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import type { ProposalStatus } from "@/types/api";
import { parseMoneyInput } from "@/lib/money";

type Requirement = { id: string; code: string; kind: "functional" | "non_functional" | "security"; title: string; description: string; priority: "must" | "should" | "could" | "wont"; dependencies: string[]; acceptanceCriteria: string[]; status: string; sortOrder: number };
type Milestone = { id: string; title: string; description: string; dueDate: string | null; status: "planned" | "in_progress" | "completed" | "delayed"; sortOrder: number };
type ChangeRequest = { id: string; title: string; description: string; requestedBy?: string; estimateMinor: number | null; currency: string; status: string; timelineImpact?: string };
type ProjectData = { project: { id: string; name: string; identifier: string; description: string; status: string; clientId: string | null; client?: { displayName: string }; businessProblem: string; proposedSolution: string; scope: string; lists: Record<string, string[]>; terms: Record<string, string>; startDate?: string | null; targetDate?: string | null }; requirements: Requirement[]; milestones: Milestone[]; proposals: { id: string; reference: string; title: string; status: ProposalStatus; latestVersionLabel?: string; validUntil?: string | null }[]; changeRequests: ChangeRequest[] };

const TABS = ["Overview", "Requirements", "Milestones", "Requirements doc", "Proposals", "Change requests"] as const;
type Tab = (typeof TABS)[number];

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProjectData | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requirement, setRequirement] = useState({ kind: "functional", title: "", description: "", priority: "must" });
  const [milestone, setMilestone] = useState({ title: "", description: "", dueDate: "", status: "planned" });
  const [changeRequest, setChangeRequest] = useState({ title: "", description: "", requestedBy: "", estimate: "", currency: "GHS", timelineImpact: "" });
  const toast = useToast();

  async function load() {
    setError("");
    try { setData(await api.get<ProjectData>(`/projects/${encodeURIComponent(id)}`)); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The project could not be loaded."); }
  }
  useEffect(() => {
    let active = true;
    api.get<ProjectData>(`/projects/${encodeURIComponent(id)}`).then((result) => {
      if (active) setData(result);
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "The project could not be loaded.");
    });
    return () => { active = false; };
  }, [id]);

  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true); setFormError("");
    try { await action(); await load(); toast(success); }
    catch (issue) { setFormError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "This change could not be saved."); }
    finally { setBusy(false); }
  }
  async function addRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(() => api.post(`/projects/${encodeURIComponent(id)}/requirements`, requirement), "Requirement added.");
    setRequirement({ kind: "functional", title: "", description: "", priority: "must" });
  }
  async function moveRequirement(index: number, offset: number) {
    if (!data) return;
    const reordered = [...data.requirements];
    const target = index + offset;
    if (target < 0 || target >= reordered.length) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setData({ ...data, requirements: reordered });
    await mutate(() => api.post(`/projects/${encodeURIComponent(id)}/requirements/reorder`, { ids: reordered.map((item) => item.id) }), "Requirement order saved.");
  }
  async function addMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(() => api.post(`/projects/${encodeURIComponent(id)}/milestones`, { ...milestone, dueDate: milestone.dueDate || null }), "Milestone added.");
    setMilestone({ title: "", description: "", dueDate: "", status: "planned" });
  }
  async function addChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let estimateMinor: number | null = null;
    if (changeRequest.estimate.trim()) {
      try { estimateMinor = parseMoneyInput(changeRequest.estimate); }
      catch { setFormError("Enter a valid amount with up to two decimal places."); return; }
    }
    await mutate(() => api.post(`/projects/${encodeURIComponent(id)}/change-requests`, { title: changeRequest.title, description: changeRequest.description, requestedBy: changeRequest.requestedBy || undefined, estimateMinor, currency: changeRequest.currency, timelineImpact: changeRequest.timelineImpact }), "Change request created.");
    setChangeRequest({ title: "", description: "", requestedBy: "", estimate: "", currency: data?.project.client ? "GHS" : "GHS", timelineImpact: "" });
  }

  if (error && !data) return <div className="page-shell"><div className="alert alert-error">{error}</div><button className="button button-quiet section-space" onClick={() => void load()}>Retry</button></div>;
  if (!data) return <div className="loading" role="status">Loading project workspace…</div>;
  const { project } = data;

  return <div className="page-shell">
    <div className="page-heading"><div><Link className="table-secondary" href="/projects">← All projects</Link><p className="eyebrow section-space">PROJECT · <span className="font-mono">{project.identifier}</span></p><h1>{project.name}</h1><p>{project.client?.displayName || "No client assigned"} · {project.status.replaceAll("_", " ")}</p></div><Link className="button button-primary" href={`/proposals/new?projectId=${encodeURIComponent(project.id)}`}>Create proposal <span aria-hidden="true">→</span></Link></div>
    <nav className="tabs" aria-label="Project sections">{TABS.map((item) => item === "Requirements doc" ? <Link key={item} className={`tab ${tab === item ? "active" : ""}`} href={`/projects/${encodeURIComponent(id)}/srs`}>{item}</Link> : <button key={item} className={`tab ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {error && <div className="alert alert-error section-space" role="alert">{error}</div>}
    {formError && <div className="alert alert-error section-space" role="alert">{formError}</div>}
    {tab === "Overview" && <div className="grid grid-2 section-space"><section className="card"><h2>Project brief</h2><p className="content-prose section-space">{project.description || "No project description yet."}</p><hr className="divider" /><p className="section-kicker">BUSINESS PROBLEM</p><p className="content-prose section-space">{project.businessProblem || "Not recorded yet."}</p><hr className="divider" /><p className="section-kicker">PROPOSED SOLUTION</p><p className="content-prose section-space">{project.proposedSolution || "Not recorded yet."}</p></section><section className="card"><h2>Scope</h2><p className="content-prose section-space">{project.scope || "Scope has not been written yet."}</p><hr className="divider" /><p className="section-kicker">DATES</p><p className="section-space">Start: {project.startDate || "Not set"}</p><p>Target: {project.targetDate || "Not set"}</p><div className="button-row section-space"><Link className="button button-quiet" href={`/projects/${encodeURIComponent(id)}/srs`}>Open requirements document</Link><a className="button button-quiet" href={`/api/v1/projects/${encodeURIComponent(id)}/handover-checklist`} target="_blank" rel="noreferrer">Handover checklist</a></div></section></div>}
    {tab === "Requirements" && <section className="card section-space"><div className="card-heading"><div><h2>Requirements</h2><p>Functional, non-functional, and security requirements in delivery order.</p></div><span className="badge badge-neutral">{data.requirements.length} items</span></div>
      {data.requirements.length ? <div className="table-wrap"><table><thead><tr><th>Code</th><th>Requirement</th><th>Priority</th><th>Dependencies</th><th>Order</th></tr></thead><tbody>{data.requirements.map((item, index) => <tr key={item.id}><td className="font-mono">{item.code}</td><td><strong>{item.title}</strong><span className="table-secondary">{item.description}</span></td><td><span className="badge badge-neutral">{item.priority}</span></td><td>{item.dependencies.length ? item.dependencies.join(", ") : "—"}</td><td><div className="button-row"><button className="button button-quiet button-small" aria-label={`Move ${item.code} up`} disabled={index === 0 || busy} onClick={() => void moveRequirement(index, -1)}>↑</button><button className="button button-quiet button-small" aria-label={`Move ${item.code} down`} disabled={index === data.requirements.length - 1 || busy} onClick={() => void moveRequirement(index, 1)}>↓</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No requirements captured" description="Add functional, non-functional, or security requirements as the scope becomes clearer." />}
      <hr className="divider" /><h3>Add a requirement</h3><form className="form-stack section-space" onSubmit={(event) => void addRequirement(event)}><div className="form-grid"><FormField label="Kind" htmlFor="req-kind" required><select id="req-kind" value={requirement.kind} onChange={(event) => setRequirement({ ...requirement, kind: event.target.value })}><option value="functional">Functional</option><option value="non_functional">Non-functional</option><option value="security">Security</option></select></FormField><FormField label="Priority" htmlFor="req-priority" required><select id="req-priority" value={requirement.priority} onChange={(event) => setRequirement({ ...requirement, priority: event.target.value })}><option value="must">Must</option><option value="should">Should</option><option value="could">Could</option><option value="wont">Won’t</option></select></FormField></div><FormField label="Title" htmlFor="req-title" required><input id="req-title" required value={requirement.title} onChange={(event) => setRequirement({ ...requirement, title: event.target.value })} /></FormField><FormField label="Description" htmlFor="req-description"><textarea id="req-description" value={requirement.description} onChange={(event) => setRequirement({ ...requirement, description: event.target.value })} /></FormField><button className="button button-primary" disabled={busy}>Add requirement</button></form>
    </section>}
    {tab === "Milestones" && <section className="card section-space"><div className="card-heading"><div><h2>Milestones</h2><p>Delivery checkpoints and target dates.</p></div></div>{data.milestones.length ? <div className="table-wrap"><table><thead><tr><th>Milestone</th><th>Due</th><th>Status</th></tr></thead><tbody>{data.milestones.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><span className="table-secondary">{item.description}</span></td><td>{item.dueDate || "Not dated"}</td><td><select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => void mutate(() => api.patch(`/projects/${encodeURIComponent(id)}/milestones/${encodeURIComponent(item.id)}`, { status: event.target.value }), "Milestone updated.")}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="delayed">Delayed</option></select></td></tr>)}</tbody></table></div> : <EmptyState title="No milestones yet" description="Create checkpoints to make the delivery plan visible." />}<hr className="divider" /><h3>Add a milestone</h3><form className="form-stack section-space" onSubmit={(event) => void addMilestone(event)}><div className="form-grid"><FormField label="Title" htmlFor="milestone-title" required><input id="milestone-title" required value={milestone.title} onChange={(event) => setMilestone({ ...milestone, title: event.target.value })} /></FormField><FormField label="Due date" htmlFor="milestone-date"><input id="milestone-date" type="date" value={milestone.dueDate} onChange={(event) => setMilestone({ ...milestone, dueDate: event.target.value })} /></FormField></div><FormField label="Description" htmlFor="milestone-description"><textarea id="milestone-description" value={milestone.description} onChange={(event) => setMilestone({ ...milestone, description: event.target.value })} /></FormField><button className="button button-primary" disabled={busy}>Add milestone</button></form></section>}
    {tab === "Proposals" && <section className="card section-space"><div className="card-heading"><div><h2>Proposals</h2><p>Proposal records connected to this project.</p></div></div>{data.proposals.length ? <div className="stack">{data.proposals.map((item) => <Link className="list-row" key={item.id} href={`/proposals/${encodeURIComponent(item.id)}`}><span><strong>{item.reference} · {item.title}</strong><small>{item.latestVersionLabel || "Draft"}</small></span><StatusBadge status={item.status} /></Link>)}</div> : <EmptyState title="No proposals for this project" description="Build a proposal from the agreed project scope." action={<Link className="button button-primary button-small" href={`/proposals/new?projectId=${encodeURIComponent(id)}`}>Create proposal</Link>} />}</section>}
    {tab === "Change requests" && <section className="card section-space"><div className="card-heading"><div><h2>Change requests</h2><p>Work proposed beyond the currently agreed scope.</p></div></div>{data.changeRequests.length ? <div className="stack">{data.changeRequests.map((item) => <article className="list-row" key={item.id}><span><strong>{item.title}</strong><small>{item.description} · {item.requestedBy || "Internal"} · {item.status}</small></span><span className="badge badge-neutral">{item.estimateMinor == null ? "Awaiting estimate" : item.currency}</span></article>)}</div> : <EmptyState title="No change requests" description="Record out-of-scope work here before proposing an amendment." />}<hr className="divider" /><h3>Record a change request</h3><form className="form-stack section-space" onSubmit={(event) => void addChange(event)}><FormField label="Title" htmlFor="change-title" required><input id="change-title" required value={changeRequest.title} onChange={(event) => setChangeRequest({ ...changeRequest, title: event.target.value })} /></FormField><FormField label="Description" htmlFor="change-description" required><textarea id="change-description" required value={changeRequest.description} onChange={(event) => setChangeRequest({ ...changeRequest, description: event.target.value })} /></FormField><div className="form-grid"><FormField label="Requested by" htmlFor="change-requester"><input id="change-requester" value={changeRequest.requestedBy} onChange={(event) => setChangeRequest({ ...changeRequest, requestedBy: event.target.value })} /></FormField><FormField label="Estimate (GHS minor units via amount)" htmlFor="change-estimate"><input id="change-estimate" inputMode="decimal" placeholder="1,234.56" value={changeRequest.estimate} onChange={(event) => setChangeRequest({ ...changeRequest, estimate: event.target.value })} /></FormField></div><FormField label="Timeline impact" htmlFor="change-timeline"><textarea id="change-timeline" value={changeRequest.timelineImpact} onChange={(event) => setChangeRequest({ ...changeRequest, timelineImpact: event.target.value })} /></FormField><button className="button button-primary" disabled={busy}>Create request</button></form></section>}
  </div>;
}
