"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import type { ProposalStatus } from "@/types/api";

type ProposalRow = { id: string; reference: string; title: string; status: ProposalStatus; kind: string; currency: string; latestVersionLabel?: string; validUntil?: string | null; client?: { displayName: string }; project?: { name: string } };
const STATUSES: ProposalStatus[] = ["draft", "ready_for_review", "sent", "viewed", "clarification_requested", "negotiation_requested", "revision_in_progress", "revised_sent", "accepted", "rejected", "expired", "withdrawn"];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(query = search, filter = status) {
    setLoading(true); setError("");
    try {
      const result = await api.get<ProposalRow[] | { data: ProposalRow[] }>("/proposals", { search: query, status: filter || undefined });
      setProposals(Array.isArray(result) ? result : result.data);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "Proposals could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<ProposalRow[] | { data: ProposalRow[] }>("/proposals").then((result) => {
      if (active) setProposals(Array.isArray(result) ? result : result.data);
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "Proposals could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">CLIENT AGREEMENTS</p><h1>Proposals</h1><p>Build a clear scope and price, then publish a version for your client.</p></div><Link className="button button-primary" href="/proposals/new">New proposal <span aria-hidden="true">+</span></Link></header>
    <section className="card">
      <div className="filter-row"><input className="input search-input" aria-label="Search proposals" placeholder="Search reference or title…" value={search} onChange={(event) => { setSearch(event.target.value); void load(event.target.value); }} /><select aria-label="Filter proposal status" value={status} onChange={(event) => { setStatus(event.target.value); void load(search, event.target.value); }}><option value="">All statuses</option>{STATUSES.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
      {error && <div className="alert alert-error" role="alert">{error}<button className="button button-quiet button-small" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="loading" role="status">Loading proposals…</div> : proposals.length ? <div className="table-wrap section-space"><table><thead><tr><th>Proposal</th><th>Client</th><th>Project</th><th>Status</th><th>Version</th><th>Valid until</th><th /></tr></thead><tbody>{proposals.map((proposal) => <tr key={proposal.id}><td><Link className="table-primary" href={`/proposals/${encodeURIComponent(proposal.id)}`}>{proposal.reference}</Link><span className="table-secondary">{proposal.title}</span></td><td>{proposal.client?.displayName || "—"}</td><td>{proposal.project?.name || "—"}</td><td><StatusBadge status={proposal.status} /></td><td className="font-mono">{proposal.latestVersionLabel || "Draft"}</td><td>{proposal.validUntil || "—"}</td><td><Link className="button button-quiet button-small" href={`/proposals/${encodeURIComponent(proposal.id)}`}>Open</Link></td></tr>)}</tbody></table></div> : <EmptyState title={search || status ? "No matching proposals" : "No proposals yet"} description={search || status ? "Change your search or status filter." : "Create a proposal from a project to begin shaping the scope and pricing."} action={!search && !status && <Link className="button button-primary button-small" href="/proposals/new">Create proposal</Link>} />}
    </section>
  </div>;
}
