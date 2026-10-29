"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/ui";

type AuditEntry = { id: string; action: string; entityType: string; entityId: string; actorType: string; actorUserId?: string | null; metadata?: unknown; createdAt: string };
const ACTORS = ["client", "developer", "system"];

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actorType, setActorType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filters = { action, entityType, actorType }) {
    setLoading(true); setError("");
    try { const result = await api.get<AuditEntry[] | { data: AuditEntry[] }>("/audit-logs", filters); setItems(Array.isArray(result) ? result : result.data); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The audit log could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<AuditEntry[] | { data: AuditEntry[] }>("/audit-logs").then((result) => { if (active) setItems(Array.isArray(result) ? result : result.data); })
      .catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "The audit log could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="page-shell"><header className="page-heading"><div><p className="eyebrow">ACCOUNTABILITY</p><h1>Audit log</h1><p>A filterable record of changes and actions across the workspace.</p></div></header>
    <section className="card"><div className="filter-row"><input className="input search-input" aria-label="Filter by action" placeholder="Action contains…" value={action} onChange={(event) => setAction(event.target.value)} /><input className="input search-input" aria-label="Filter by entity type" placeholder="Entity type…" value={entityType} onChange={(event) => setEntityType(event.target.value)} /><select aria-label="Filter by actor type" value={actorType} onChange={(event) => setActorType(event.target.value)}><option value="">All actors</option>{ACTORS.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="button button-primary button-small" onClick={() => void load()}>Apply filters</button></div>
      {error && <div className="alert alert-error" role="alert">{error}<button className="button button-quiet button-small" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="loading" role="status">Loading audit history…</div> : items.length ? <div className="table-wrap"><table><thead><tr><th>Action</th><th>Entity</th><th>Actor</th><th>Details</th><th>When</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="table-primary">{item.action}</td><td>{item.entityType}<span className="table-secondary font-mono">{item.entityId}</span></td><td>{item.actorType}<span className="table-secondary">{item.actorUserId || "—"}</span></td><td><pre className="audit-meta">{item.metadata == null ? "—" : JSON.stringify(item.metadata, null, 2)}</pre></td><td>{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No audit entries" description="Actions will appear here as your workspace is used." />}
    </section>
  </div>;
}
