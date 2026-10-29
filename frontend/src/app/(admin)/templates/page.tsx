"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ConfirmDialog, EmptyState, FormField } from "@/components/ui";

type TemplateKind = "srs" | "proposal" | "contract" | "change_request" | "handover_checklist";
type TemplateSection = { key: string; title: string; body: string };
type Template = { id: string; kind: TemplateKind; name: string; isDefault: boolean; sections: TemplateSection[] };
const KINDS: TemplateKind[] = ["srs", "proposal", "contract", "change_request", "handover_checklist"];

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([]);
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [confirm, setConfirm] = useState<Template | null>(null);
  const [form, setForm] = useState({ kind: "proposal" as TemplateKind, name: "", isDefault: false, sections: [{ key: "overview", title: "", body: "" }] });

  async function load(filter = kind) {
    setLoading(true); setError("");
    try { setItems(await api.get<Template[]>("/templates", { kind: filter || undefined })); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "Templates could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<Template[]>("/templates").then((result) => { if (active) setItems(result); })
      .catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "Templates could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      if (editingId) await api.patch(`/templates/${encodeURIComponent(editingId)}`, form);
      else await api.post("/templates", form);
      setEditingId(""); setForm({ kind: "proposal", name: "", isDefault: false, sections: [{ key: "overview", title: "", body: "" }] }); await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "The template could not be saved."); }
  }
  function edit(item: Template) {
    setEditingId(item.id);
    setForm({ kind: item.kind, name: item.name, isDefault: item.isDefault, sections: item.sections.length ? item.sections.map((section) => ({ ...section })) : [{ key: "custom", title: "", body: "" }] });
  }
  async function remove() {
    if (!confirm) return;
    try { await api.delete(`/templates/${encodeURIComponent(confirm.id)}`); await load(); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "The template could not be deleted."); }
    finally { setConfirm(null); }
  }

  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">STARTING POINTS</p><h1>Templates</h1><p>Reusable document structure, not pre-filled business claims or pricing.</p></div><select aria-label="Filter template type" value={kind} onChange={(event) => { setKind(event.target.value); void load(event.target.value); }}><option value="">All kinds</option>{KINDS.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></header>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="grid grid-2 section-space">
      <section className="card"><div className="card-heading"><div><h2>{editingId ? "Edit template" : "New template"}</h2><p>Sections are inserted in the order shown.</p></div>{editingId && <button className="button button-quiet button-small" onClick={() => setEditingId("")}>Cancel edit</button>}</div>
        <form className="form-stack" onSubmit={(event) => void save(event)}><div className="form-grid"><FormField label="Kind" htmlFor="template-kind" required><select id="template-kind" disabled={Boolean(editingId)} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as TemplateKind })}>{KINDS.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></FormField><FormField label="Template name" htmlFor="template-name" required><input id="template-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField></div><label className="toggle-label"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} /> Use as default for this kind</label>
          <div className="stack">{form.sections.map((section, index) => <article className="pricing-item stack" key={`${index}-${section.key}`}><div className="form-grid"><FormField label={`Section ${index + 1} title`} htmlFor={`template-title-${index}`} required><input id={`template-title-${index}`} required value={section.title} onChange={(event) => setForm({ ...form, sections: form.sections.map((row, i) => i === index ? { ...row, title: event.target.value } : row) })} /></FormField><FormField label="Section key" htmlFor={`template-key-${index}`}><input id={`template-key-${index}`} value={section.key} onChange={(event) => setForm({ ...form, sections: form.sections.map((row, i) => i === index ? { ...row, key: event.target.value } : row) })} /></FormField></div><FormField label="Optional starter text" htmlFor={`template-body-${index}`}><textarea id={`template-body-${index}`} value={section.body} onChange={(event) => setForm({ ...form, sections: form.sections.map((row, i) => i === index ? { ...row, body: event.target.value } : row) })} /></FormField><div className="button-row"><button type="button" className="button button-quiet button-small" disabled={index === 0} onClick={() => { const sections = [...form.sections]; [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]]; setForm({ ...form, sections }); }}>Move up</button><button type="button" className="button button-quiet button-small" disabled={index === form.sections.length - 1} onClick={() => { const sections = [...form.sections]; [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]]; setForm({ ...form, sections }); }}>Move down</button><button type="button" className="button button-quiet button-small" onClick={() => setForm({ ...form, sections: form.sections.filter((_, i) => i !== index) })}>Remove section</button></div></article>)}</div>
          <button type="button" className="button button-quiet" onClick={() => setForm({ ...form, sections: [...form.sections, { key: "custom", title: "", body: "" }] })}>Add section +</button><button className="button button-primary">{editingId ? "Save template" : "Create template"}</button>
        </form>
      </section>
      <section className="card"><div className="card-heading"><div><h2>Saved templates</h2><p>{loading ? "Loading…" : `${items.length} templates`}</p></div></div>{loading ? <div className="loading" role="status">Loading templates…</div> : items.length ? <div className="stack">{items.map((item) => <article className="template-row" key={item.id}><div><strong>{item.name}</strong><small>{item.kind.replaceAll("_", " ")} · {item.sections.length} sections {item.isDefault ? "· default" : ""}</small></div><div className="button-row"><button className="button button-quiet button-small" onClick={() => edit(item)}>Edit</button><button className="button button-danger button-small" onClick={() => setConfirm(item)}>Delete</button></div></article>)}</div> : <EmptyState title="No templates yet" description="Create a structure to make future requirements or proposal documents easier to begin." />}</section>
    </div>
    <ConfirmDialog open={Boolean(confirm)} title="Delete this template?" description="New documents will no longer be able to use this template. Existing documents are unchanged." destructive confirmLabel="Delete template" onCancel={() => setConfirm(null)} onConfirm={() => void remove()} />
  </div>;
}
