"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ConfirmDialog, EmptyState, FormField, useToast } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";

type Client = { id: string; displayName: string; contactName: string; organizationName: string | null; email: string; phone: string | null; type: "individual" | "organization"; country: string; preferredCurrency: string; billingAddress: string | null; taxId: string | null; internalNotes?: string | null };
type ProfileData = { client: Client; projects: { id: string; name: string; identifier: string; status: string }[]; proposals: { id: string; reference: string; title: string; status: string; latestVersionLabel?: string; projectId: string; currency: string }[]; negotiations: { id: string; kind: string; subject: string; status: string; createdAt: string }[] };

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<Client | null>(null);

  async function load() {
    setError("");
    try {
      const result = await api.get<ProfileData>(`/clients/${encodeURIComponent(id)}`);
      setProfile(result);
      setForm(result.client);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The client profile could not be loaded."); }
  }
  useEffect(() => {
    let active = true;
    api.get<ProfileData>(`/clients/${encodeURIComponent(id)}`).then((result) => {
      if (active) { setProfile(result); setForm(result.client); }
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "The client profile could not be loaded.");
    });
    return () => { active = false; };
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setFieldError("");
    try {
      await api.patch(`/clients/${encodeURIComponent(id)}`, { type: form.type, contactName: form.contactName, organizationName: form.organizationName, email: form.email, phone: form.phone, country: form.country, preferredCurrency: form.preferredCurrency, billingAddress: form.billingAddress, taxId: form.taxId, internalNotes: form.internalNotes });
      await load(); toast("Client details saved.");
    } catch (issue) { setFieldError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "The client details could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await api.delete(`/clients/${encodeURIComponent(id)}`); router.replace("/clients"); }
    catch (issue) { setFieldError(issue instanceof ApiError ? issue.message : "The client could not be deleted."); }
    finally { setBusy(false); setConfirmDelete(false); }
  }

  if (error && !profile) return <div className="page-shell"><div className="alert alert-error" role="alert">{error}</div><button className="button button-quiet section-space" onClick={() => void load()}>Retry</button></div>;
  if (!profile || !form) return <div className="loading" role="status">Loading client profile…</div>;
  return <div className="page-shell">
    <div className="page-heading"><div><Link className="table-secondary" href="/clients">← All clients</Link><p className="eyebrow section-space">CLIENT PROFILE</p><h1>{profile.client.displayName || profile.client.organizationName || profile.client.contactName}</h1><p>{profile.client.email} · {profile.client.country}</p></div><button className="button button-danger" onClick={() => setConfirmDelete(true)}>Delete client</button></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="grid grid-2">
      <section className="card"><div className="card-heading"><div><h2>Client details</h2><p>Updates are reflected on future proposals.</p></div></div><form className="form-stack" onSubmit={(event) => void save(event)}>
        <div className="form-grid"><FormField label="Client type" htmlFor="profile-type" required><select id="profile-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Client["type"] })}><option value="individual">Individual</option><option value="organization">Organisation</option></select></FormField><FormField label="Contact name" htmlFor="profile-contact" required><input id="profile-contact" required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></FormField></div>
        <FormField label="Organisation name" htmlFor="profile-org"><input id="profile-org" value={form.organizationName ?? ""} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} /></FormField>
        <div className="form-grid"><FormField label="Email" htmlFor="profile-email" required><input id="profile-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField><FormField label="Phone" htmlFor="profile-phone"><input id="profile-phone" value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField></div>
        <div className="form-grid"><FormField label="Country" htmlFor="profile-country" required><input id="profile-country" required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></FormField><FormField label="Preferred currency" htmlFor="profile-currency" required><input id="profile-currency" maxLength={3} required value={form.preferredCurrency} onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value.toUpperCase() })} /></FormField></div>
        <FormField label="Billing address" htmlFor="profile-address"><textarea id="profile-address" value={form.billingAddress ?? ""} onChange={(event) => setForm({ ...form, billingAddress: event.target.value })} /></FormField><FormField label="Tax ID" htmlFor="profile-tax"><input id="profile-tax" value={form.taxId ?? ""} onChange={(event) => setForm({ ...form, taxId: event.target.value })} /></FormField>
        <FormField label="Internal notes" htmlFor="profile-notes"><textarea id="profile-notes" value={form.internalNotes ?? ""} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /></FormField>
        {fieldError && <p className="field-error" role="alert">{fieldError}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form></section>
      <div className="stack">
        <ProfileList title="Projects" items={profile.projects} empty="Projects for this client will appear here." render={(item) => <Link className="list-row" href={`/projects/${encodeURIComponent(item.id)}`} key={item.id}><span><strong>{item.name}</strong><small>{item.identifier} · {item.status}</small></span><span className="arrow">→</span></Link>} />
        <ProfileList title="Proposals" items={profile.proposals} empty="Proposals for this client will appear here." render={(item) => <Link className="list-row" href={`/proposals/${encodeURIComponent(item.id)}`} key={item.id}><span><strong>{item.reference} · {item.title}</strong><small>{item.latestVersionLabel || "Draft"} · {item.currency}</small></span><StatusBadge status={item.status} /></Link>} />
        <ProfileList title="Negotiation history" items={profile.negotiations} empty="Negotiation requests will appear here." render={(item) => <Link className="list-row" href={`/negotiations/${encodeURIComponent(item.id)}`} key={item.id}><span><strong>{item.subject || item.kind}</strong><small>{item.kind} · {new Date(item.createdAt).toLocaleDateString()}</small></span><span className="badge badge-neutral">{item.status}</span></Link>} />
      </div>
    </div>
    <ConfirmDialog open={confirmDelete} title="Delete this client?" description="This action removes the client from your workspace. Clients with proposal history cannot be deleted." confirmLabel={busy ? "Deleting…" : "Delete client"} destructive onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
  </div>;
}

function ProfileList<T extends { id: string }>({ title, items, empty, render }: { title: string; items: T[]; empty: string; render: (item: T) => React.ReactNode }) {
  return <section className="card"><div className="card-heading"><h2>{title}</h2></div>{items.length ? <div className="stack">{items.map(render)}</div> : <EmptyState title={`No ${title.toLowerCase()} yet`} description={empty} />}</section>;
}
