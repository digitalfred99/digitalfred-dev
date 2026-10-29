"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { EmptyState, FormField } from "@/components/ui";
import { useToast } from "@/components/ui";

type ClientRow = { id: string; displayName: string; contactName: string; organizationName?: string | null; email: string; type: "individual" | "organization"; preferredCurrency: string; country: string };

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: "organization", contactName: "", organizationName: "", email: "", phone: "", country: "Ghana", preferredCurrency: "GHS" });
  const toast = useToast();

  async function copyIntakeLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/client-intake`);
      toast("Client intake link copied. Share it directly with your client.");
    } catch {
      toast("Could not copy the link. Open /client-intake and copy its address.");
    }
  }

  async function load(value = search) {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<ClientRow[] | { data: ClientRow[] }>("/clients", { search: value });
      setClients(Array.isArray(result) ? result : result.data);
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Clients could not be loaded.");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<ClientRow[] | { data: ClientRow[] }>("/clients", { search: "" }).then((result) => {
      if (active) setClients(Array.isArray(result) ? result : result.data);
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "Clients could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFieldError("");
    try {
      await api.post("/clients", { ...form, organizationName: form.type === "organization" ? form.organizationName : null });
      setOpen(false);
      setForm({ type: "organization", contactName: "", organizationName: "", email: "", phone: "", country: "Ghana", preferredCurrency: "GHS" });
      await load();
      toast("Client added to your workspace.");
    } catch (issue) {
      setFieldError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "The client could not be saved.");
    } finally { setBusy(false); }
  }

  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">RELATIONSHIPS</p><h1>Clients</h1><p>A thoughtful record of the people and organisations you work with.</p></div><div className="heading-actions"><input className="input search-input" aria-label="Search clients" placeholder="Search clients…" value={search} onChange={(event) => { setSearch(event.target.value); void load(event.target.value); }} /><button className="button button-quiet" onClick={() => void copyIntakeLink()}>Copy intake link</button><button className="button button-primary" onClick={() => setOpen(!open)}>{open ? "Close form" : "Add client"} <span aria-hidden="true">+</span></button></div></header>
    {open && <section className="card section-space"><div className="card-heading"><div><h2>New client</h2><p>Keep client details accurate for proposals and agreements.</p></div></div><form className="form-stack" onSubmit={(event) => void create(event)}>
      <div className="form-grid"><FormField label="Client type" htmlFor="client-type" required><select id="client-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="organization">Organisation</option><option value="individual">Individual</option></select></FormField><FormField label="Contact name" htmlFor="client-contact" required><input id="client-contact" required value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></FormField></div>
      {form.type === "organization" && <FormField label="Organisation name" htmlFor="client-org" required><input id="client-org" required value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} /></FormField>}
      <div className="form-grid"><FormField label="Email" htmlFor="client-email" required><input id="client-email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField><FormField label="Phone" htmlFor="client-phone"><input id="client-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField></div>
      <div className="form-grid"><FormField label="Country" htmlFor="client-country" required><input id="client-country" required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></FormField><FormField label="Preferred currency" htmlFor="client-currency" required><input id="client-currency" maxLength={3} required value={form.preferredCurrency} onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value.toUpperCase() })} /></FormField></div>
      {fieldError && <p className="field-error" role="alert">{fieldError}</p>}<div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save client"}</button></div>
    </form></section>}
    <section className="card section-space"><div className="card-heading"><div><h2>Client directory</h2><p>{loading ? "Loading client records…" : `${clients.length} ${clients.length === 1 ? "client" : "clients"} shown`}</p></div></div>
      {error && <div className="alert alert-error" role="alert">{error} <button className="button button-quiet button-small" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="loading" role="status">Loading clients…</div> : clients.length ? <div className="table-wrap"><table><thead><tr><th>Client</th><th>Contact</th><th>Currency</th><th>Country</th><th /></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><td><Link className="table-primary" href={`/clients/${encodeURIComponent(client.id)}`}>{client.displayName || client.organizationName || client.contactName}</Link><span className="table-secondary">{client.type === "organization" ? "Organisation" : "Individual"}</span></td><td>{client.contactName}<span className="table-secondary">{client.email}</span></td><td className="font-mono">{client.preferredCurrency}</td><td>{client.country}</td><td><Link className="button button-quiet button-small" href={`/clients/${encodeURIComponent(client.id)}`}>View</Link></td></tr>)}</tbody></table></div> : <EmptyState title={search ? "No matching clients" : "Your client list starts here"} description={search ? "Try another name or email address." : "Add the people and organisations you work with to keep project and proposal details in one place."} action={!search && <button className="button button-primary button-small" onClick={() => setOpen(true)}>Add first client</button>} />}
    </section>
  </div>;
}
