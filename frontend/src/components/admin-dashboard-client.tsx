"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { EmptyState } from "@/components/ui";
import type { ProposalStatus } from "@/types/api";

type DashboardData = {
  totals: { clients: number; projects: number };
  proposals: {
    draft: number;
    awaitingClientReview: number;
    accepted: number;
    requiringNegotiation: number;
    revisionInProgress: number;
    byStatus: Record<string, number>;
  };
  awaitingMyResponse: Record<string, unknown>[];
  expiring: { id: string; reference: string; title: string; validUntil: string; status: ProposalStatus }[];
  upcomingDeadlines: { id: string; title: string; name?: string; dueDate: string; status: string; projectId?: string }[];
  recentClientActivity: { id: string; action: string; entityType: string; entityId: string; createdAt: string; metadata?: unknown }[];
  recentRevisions: { id: string; proposalId: string; label: string; changeNote: string; publishedAt: string }[];
  payments: { outstanding: Record<string, unknown>[]; overdueCount: number };
  renewals: { proposalId: string; reference: string; kind: string; label: string; renewalDate: string }[];
};

const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));

export function AdminDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setData).catch((issue: unknown) => {
      setError(issue instanceof ApiError ? issue.message : "The dashboard could not be loaded.");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading" role="status">Gathering your studio overview…</div>;
  if (error || !data) return <div className="page-shell"><div className="alert alert-error" role="alert">{error || "No dashboard data was returned."}</div><button className="button button-quiet section-space" onClick={() => location.reload()}>Try again</button></div>;

  const metrics = [
    { label: "Clients", value: data.totals.clients, note: "Across your workspace", href: "/clients" },
    { label: "Projects", value: data.totals.projects, note: "Active and archived", href: "/projects" },
    { label: "Draft proposals", value: data.proposals.draft, note: "In progress or ready to review", href: "/proposals?status=draft" },
    { label: "Awaiting client", value: data.proposals.awaitingClientReview, note: "Sent or viewed", href: "/proposals?status=sent" },
    { label: "Accepted", value: data.proposals.accepted, note: "Agreed engagements", href: "/proposals?status=accepted" },
    { label: "Needs negotiation", value: data.proposals.requiringNegotiation, note: "Requests to respond to", href: "/negotiations" },
  ];

  return (
    <div className="page-shell">
      <header className="page-heading"><div><p className="eyebrow">WEDNESDAY · STUDIO OVERVIEW</p><h1>A clear view of your work.</h1><p>Keep an eye on proposals, conversations, and the next important dates.</p></div><Link className="button button-primary" href="/proposals/new">New proposal <span aria-hidden="true">→</span></Link></header>
      <section className="grid grid-3" aria-label="Workspace totals">
        {metrics.map((metric) => <Link className="card metric" key={metric.label} href={metric.href}><span className="metric-label">{metric.label}</span><div className="metric-value">{metric.value}</div><p className="metric-note">{metric.note}</p></Link>)}
      </section>
      <div className="grid grid-2 section-space">
        <ListCard title="Awaiting my response" description="Open client requests that need your attention">
          {data.awaitingMyResponse.length ? <div className="stack">{data.awaitingMyResponse.map((item, index) => {
            const id = String(item.id ?? "");
            const subject = String(item.subject ?? item.kind ?? "Client request");
            const proposalRef = String(item.proposalReference ?? item.proposalId ?? "");
            return <Link key={id || index} className="list-row" href={id ? `/negotiations/${encodeURIComponent(id)}` : "/negotiations"}><span><strong>{subject}</strong><small>{proposalRef}</small></span><span className="arrow">→</span></Link>;
          })}</div> : <EmptyState title="All caught up" description="New client requests will appear here." /> }
        </ListCard>
        <ListCard title="Expiring in 7 days" description="Live proposals approaching their validity date">
          {data.expiring.length ? <div className="stack">{data.expiring.map((item) => <Link key={item.id} className="list-row" href={`/proposals/${encodeURIComponent(item.id)}`}><span><strong>{item.title || item.reference}</strong><small>{item.reference} · valid until {dateLabel(item.validUntil)}</small></span><span className="arrow">→</span></Link>)}</div> : <EmptyState title="Nothing expiring soon" description="Proposals with a validity date in the next seven days will show here." />}
        </ListCard>
      </div>
      <div className="grid grid-2 section-space">
        <ListCard title="Upcoming milestones" description="Project dates due within the next two weeks">
          {data.upcomingDeadlines.length ? <div className="stack">{data.upcomingDeadlines.map((item) => <Link key={item.id} className="list-row" href={item.projectId ? `/projects/${encodeURIComponent(item.projectId)}` : "/projects"}><span><strong>{item.title || item.name || "Milestone"}</strong><small>{item.status} · {dateLabel(item.dueDate)}</small></span><span className="arrow">→</span></Link>)}</div> : <EmptyState title="A little breathing room" description="No upcoming milestones have due dates in the next two weeks." />}
        </ListCard>
        <ListCard title="Recent client activity" description="The latest activity recorded in your workspace">
          {data.recentClientActivity.length ? <div className="stack">{data.recentClientActivity.map((item) => <div className="list-row" key={item.id}><span><strong>{String(item.action).replaceAll("_", " ")}</strong><small>{item.entityType} · {dateLabel(item.createdAt)}</small></span><span className="activity-dot" aria-hidden="true" /></div>)}</div> : <EmptyState title="No activity yet" description="Client actions and updates will appear here." />}
        </ListCard>
      </div>
      <div className="grid grid-2 section-space">
        <ListCard title="Recent revisions" description="Recently published proposal versions">
          {data.recentRevisions.length ? <div className="stack">{data.recentRevisions.map((item) => <Link key={item.id} className="list-row" href={`/proposals/${encodeURIComponent(item.proposalId)}`}><span><strong>{item.label}</strong><small>{item.changeNote || "Version published"} · {dateLabel(item.publishedAt)}</small></span><span className="arrow">→</span></Link>)}</div> : <EmptyState title="No published versions yet" description="Your proposal version history will appear here." />}
        </ListCard>
        <ListCard title="Payments" description="Bookkeeping status only; payments are not processed here">
          <div className="payment-summary"><span><strong>{data.payments.outstanding.length}</strong><small>Outstanding</small></span><span><strong>{data.payments.overdueCount}</strong><small>Overdue</small></span></div>
          {data.payments.outstanding.length ? <div className="stack">{data.payments.outstanding.slice(0, 4).map((item, index) => <Link key={String(item.id ?? index)} className="list-row" href="/payments"><span><strong>{String(item.label ?? item.description ?? item.reference ?? "Payment due")}</strong><small>{item.dueDate ? dateLabel(String(item.dueDate)) : "No due date"}</small></span><span className="font-mono">{formatMoney(typeof item.amountMinor === "number" ? item.amountMinor : null, String(item.currency ?? "GHS"))}</span></Link>)}</div> : <EmptyState title="No outstanding payments" description="Payment records due for bookkeeping will appear here." />}
        </ListCard>
      </div>
      <div className="grid grid-2 section-space">
        <ListCard title="Upcoming renewals" description="Renewal dates recorded in accepted proposals">
          {data.renewals.length ? <div className="stack">{data.renewals.map((item, index) => <Link key={`${item.proposalId}-${index}`} className="list-row" href={`/proposals/${encodeURIComponent(item.proposalId)}`}><span><strong>{item.label}</strong><small>{item.reference} · {item.kind}</small></span><span className="font-mono">{dateLabel(item.renewalDate)}</span></Link>)}</div> : <EmptyState title="No renewals in the next 90 days" description="Configured service and maintenance renewal dates from accepted proposals will show here." />}
        </ListCard>
        <ListCard title="Proposal pulse" description="Current lifecycle counts from the server">
          <div className="stack">{Object.entries(data.proposals.byStatus).filter(([, count]) => count > 0).length ? Object.entries(data.proposals.byStatus).filter(([, count]) => count > 0).map(([status, count]) => <div className="list-row" key={status}><span className="table-primary">{status.replaceAll("_", " ")}</span><span className="font-mono">{count}</span></div>) : <EmptyState title="No proposals yet" description="Create your first proposal to begin tracking activity." action={<Link className="button button-primary button-small" href="/proposals/new">Create proposal</Link>} />}</div>
        </ListCard>
      </div>
    </div>
  );
}

function ListCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="card"><div className="card-heading"><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}
