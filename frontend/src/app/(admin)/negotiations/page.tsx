"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/ui";

type RequestRow = { id: string; proposalId: string; proposalReference: string | null; proposalTitle: string | null; kind: string; status: string; subject: string; message: string; submittedByName: string; submittedByEmail: string; createdAt: string };
const STATUSES = ["open", "answered", "agreed", "declined", "countered", "closed"];

export default function NegotiationsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filter = status) {
    setLoading(true); setError("");
    try {
      const result = await api.get<RequestRow[] | { data: RequestRow[] }>("/negotiations", { status: filter || undefined });
      setRequests(Array.isArray(result) ? result : result.data);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The negotiations inbox could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<RequestRow[] | { data: RequestRow[] }>("/negotiations", { status: "open" }).then((result) => {
      if (active) setRequests(Array.isArray(result) ? result : result.data);
    }).catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "The negotiations inbox could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">CLIENT CONVERSATIONS</p><h1>Negotiations</h1><p>Respond to client questions and change requests without losing the agreed version history.</p></div><select aria-label="Filter requests by status" value={status} onChange={(event) => { setStatus(event.target.value); void load(event.target.value); }}><option value="">All requests</option>{STATUSES.map((value) => <option value={value} key={value}>{value}</option>)}</select></header>
    <section className="card"><div className="card-heading"><div><h2>{status ? `${status[0].toUpperCase()}${status.slice(1)} requests` : "All requests"}</h2><p>{loading ? "Loading…" : `${requests.length} requests`}</p></div></div>
      {error && <div className="alert alert-error" role="alert">{error}<button className="button button-quiet button-small" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="loading" role="status">Loading negotiation requests…</div> : requests.length ? <div className="table-wrap"><table><thead><tr><th>Request</th><th>Client</th><th>Proposal</th><th>Type</th><th>Status</th><th>Received</th><th /></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td><Link className="table-primary" href={`/negotiations/${encodeURIComponent(item.id)}`}>{item.subject}</Link><span className="table-secondary">{item.message}</span></td><td>{item.submittedByName}<span className="table-secondary">{item.submittedByEmail}</span></td><td>{item.proposalReference || item.proposalTitle || "Proposal"}<span className="table-secondary">{item.proposalTitle}</span></td><td>{item.kind.replaceAll("_", " ")}</td><td><span className={`badge ${item.status === "open" ? "badge-amber" : "badge-neutral"}`}>{item.status}</span></td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td><Link className="button button-quiet button-small" href={`/negotiations/${encodeURIComponent(item.id)}`}>Open</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No requests in this view" description={status === "open" ? "New client requests will appear here. You can also switch to another status." : "Try a different status filter."} />}
    </section>
  </div>;
}
