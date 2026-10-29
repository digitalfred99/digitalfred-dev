"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { parseMoneyInput, formatMoney } from "@/lib/money";
import { ConfirmDialog, EmptyState, FormField } from "@/components/ui";

type CatalogService = { id: string; name: string; provider: string; description: string; category: string; options: { id: string; label?: string; period: string; amountMinor: number | null; taxMinor: number; currency: string; confirmed: boolean }[]; isActive: boolean };
const PERIODS = ["one_time", "monthly", "quarterly", "annual", "usage", "custom"];

export default function ServiceCatalogPage() {
  const [items, setItems] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<CatalogService | null>(null);
  const [form, setForm] = useState({ name: "", provider: "", category: "", description: "", period: "monthly", amount: "", currency: "GHS", confirmed: false });

  async function load() {
    setLoading(true); setError("");
    try { setItems(await api.get<CatalogService[]>("/service-catalog")); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The service catalog could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<CatalogService[]>("/service-catalog").then((result) => { if (active) setItems(result); })
      .catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "The service catalog could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const amountMinor = parseMoneyInput(form.amount);
      await api.post("/service-catalog", {
        name: form.name, provider: form.provider, category: form.category, description: form.description,
        options: [{ id: crypto.randomUUID(), period: form.period, amountMinor, taxMinor: 0, currency: form.currency, confirmed: form.confirmed }],
      });
      setOpen(false); setForm({ name: "", provider: "", category: "", description: "", period: "monthly", amount: "", currency: "GHS", confirmed: false }); await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : issue instanceof Error ? issue.message : "The service could not be created."); }
    finally { setBusy(false); }
  }
  async function toggleActive(item: CatalogService) {
    try { await api.patch(`/service-catalog/${encodeURIComponent(item.id)}`, { isActive: !item.isActive }); await load(); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The service could not be updated."); }
  }
  async function remove() {
    if (!confirm) return;
    try { await api.delete(`/service-catalog/${encodeURIComponent(confirm.id)}`); await load(); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The service could not be removed."); }
    finally { setConfirm(null); }
  }

  return <div className="page-shell"><header className="page-heading"><div><p className="eyebrow">REUSABLE PRICING</p><h1>Service catalog</h1><p>Keep service options consistent when adding them to a proposal.</p></div><button className="button button-primary" onClick={() => setOpen(!open)}>{open ? "Close form" : "Add service"} <span aria-hidden="true">+</span></button></header>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {open && <section className="card section-space"><div className="card-heading"><div><h2>New catalog item</h2><p>Prices may remain unset until confirmed with the provider.</p></div></div><form className="form-stack" onSubmit={(event) => void create(event)}><div className="form-grid"><FormField label="Service name" htmlFor="catalog-name" required><input id="catalog-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField><FormField label="Provider" htmlFor="catalog-provider"><input id="catalog-provider" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></FormField></div><div className="form-grid"><FormField label="Category" htmlFor="catalog-category"><input id="catalog-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></FormField><FormField label="Billing period" htmlFor="catalog-period" required><select id="catalog-period" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })}>{PERIODS.map((period) => <option value={period} key={period}>{period.replaceAll("_", " ")}</option>)}</select></FormField></div><div className="form-grid"><FormField label="Price" htmlFor="catalog-amount" hint="Leave blank if awaiting confirmation."><input id="catalog-amount" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="1,234.56" /></FormField><FormField label="Currency" htmlFor="catalog-currency" required><input id="catalog-currency" maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></FormField></div><label className="toggle-label"><input type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} /> Price confirmed</label><FormField label="Description" htmlFor="catalog-description"><textarea id="catalog-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save catalog item"}</button></form></section>}
    <section className="card section-space"><div className="card-heading"><div><h2>Catalog items</h2><p>{loading ? "Loading…" : `${items.length} items`}</p></div></div>{loading ? <div className="loading" role="status">Loading service catalog…</div> : items.length ? <div className="table-wrap"><table><thead><tr><th>Service</th><th>Billing options</th><th>Status</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className="table-secondary">{item.provider} · {item.category}</span><span className="table-secondary">{item.description}</span></td><td>{item.options.map((option) => <div key={option.id}><span className="font-mono">{formatMoney(option.amountMinor, option.currency)}</span><small className="table-secondary">{option.period} · {option.confirmed ? "confirmed" : "estimated"}</small></div>)}</td><td><span className={`badge ${item.isActive ? "badge-green" : "badge-neutral"}`}>{item.isActive ? "Active" : "Inactive"}</span></td><td><div className="button-row"><button className="button button-quiet button-small" onClick={() => void toggleActive(item)}>{item.isActive ? "Deactivate" : "Activate"}</button><button className="button button-danger button-small" onClick={() => setConfirm(item)}>Remove</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No catalog items" description="Add a service once, then reuse it in proposal pricing." action={<button className="button button-primary button-small" onClick={() => setOpen(true)}>Add first service</button>} />}</section>
    <ConfirmDialog open={Boolean(confirm)} title="Remove this service?" description="Existing proposals keep their own copy. This catalog item will no longer be available for new proposals." destructive confirmLabel="Remove service" onCancel={() => setConfirm(null)} onConfirm={() => void remove()} />
  </div>;
}
