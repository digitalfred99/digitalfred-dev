"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { downloadDocument, printDocument } from "@/lib/document-actions";
import { EmptyState, FormField, useToast } from "@/components/ui";
import type { Section } from "@/types/api";

type SrsDocument = { id: string; projectId: string; title: string; sections: Section[]; revision: number; status: "draft" | "in_review" | "approved"; latestVersionLabel?: string };
type SrsVersion = { id: string; label: string; note: string; publishedAt: string; contentHash: string };
type SrsPayload = { document: SrsDocument; requirements: { code: string; kind: string; title: string; description: string }[] };

export default function SrsEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<SrsDocument | null>(null);
  const [versions, setVersions] = useState<SrsVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [bump, setBump] = useState<"minor" | "major">("minor");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const toast = useToast();

  async function load() {
    setLoading(true); setError("");
    try {
      const [result, list] = await Promise.all([
        api.get<SrsPayload>(`/projects/${encodeURIComponent(id)}/srs`),
        api.get<SrsVersion[]>(`/projects/${encodeURIComponent(id)}/srs/versions`),
      ]);
      setDocument(result.document);
      setVersions(list);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The requirements document could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<SrsPayload>(`/projects/${encodeURIComponent(id)}/srs`),
      api.get<SrsVersion[]>(`/projects/${encodeURIComponent(id)}/srs/versions`),
    ]).then(([result, list]) => {
      if (active) { setDocument(result.document); setVersions(list); }
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "The requirements document could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  function updateSection(index: number, patch: Partial<Section>) {
    if (!document) return;
    setDocument({ ...document, sections: document.sections.map((section, i) => i === index ? { ...section, ...patch } : section) });
  }
  function moveSection(index: number, offset: number) {
    if (!document) return;
    const target = index + offset;
    if (target < 0 || target >= document.sections.length) return;
    const sections = [...document.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setDocument({ ...document, sections });
  }
  function addSection() {
    if (!document) return;
    setDocument({ ...document, sections: [...document.sections, { id: crypto.randomUUID(), key: "custom", title: "New section", body: "", clientVisible: true }] });
  }
  function removeSection(index: number) {
    if (!document || !window.confirm(`Remove “${document.sections[index].title}” from this document?`)) return;
    setDocument({ ...document, sections: document.sections.filter((_, i) => i !== index) });
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!document) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await api.put<SrsDocument>(`/projects/${encodeURIComponent(id)}/srs`, { title: document.title, sections: document.sections, revision: document.revision });
      setDocument(saved); setMessage("Saved. The next version will include these changes."); toast("Requirements document saved.");
    } catch (issue) {
      if (issue instanceof ApiError && issue.status === 409) setError("This document changed elsewhere. Reload the latest version before saving your edits.");
      else setError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "The document could not be saved.");
    } finally { setSaving(false); }
  }
  async function changeStatus(status: SrsDocument["status"]) {
    try {
      const saved = await api.put<SrsDocument>(`/projects/${encodeURIComponent(id)}/srs/status`, { status });
      setDocument((current) => current ? { ...current, status: saved.status } : current);
      toast("Document status updated.");
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The status could not be updated."); }
  }
  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await api.post(`/projects/${encodeURIComponent(id)}/srs/versions`, { bump, note: versionNote });
      setVersionNote("");
      await load();
      toast("A document version has been created.");
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "A new version could not be created."); }
  }
  async function openPreview(version?: string) {
    setError("");
    try {
      const html = await api.document(`/projects/${encodeURIComponent(id)}/srs/document${version ? `?version=${encodeURIComponent(version)}` : ""}`);
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The document preview could not be loaded."); }
  }

  if (loading) return <div className="loading" role="status">Opening requirements document…</div>;
  if (!document) return <div className="page-shell"><div className="alert alert-error" role="alert">{error || "No requirements document was returned."}</div><button className="button button-quiet section-space" onClick={() => void load()}>Reload</button></div>;

  return <div className="page-shell">
    <div className="page-heading"><div><Link className="table-secondary" href={`/projects/${encodeURIComponent(id)}`}>← Project workspace</Link><p className="eyebrow section-space">SCOPE & SPECIFICATION</p><h1>Requirements document</h1><p>Shape the specification carefully; your saved draft stays distinct from published versions.</p></div><div className="heading-actions"><span className="badge badge-neutral">Revision {document.revision}</span><button className="button button-quiet" onClick={() => void openPreview()}>Preview</button><button className="button button-primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save document"}</button></div></div>
    {error && <div className="alert alert-error section-space" role="alert">{error}<button className="button button-quiet button-small" onClick={() => void load()}>Reload latest</button></div>}
    {message && <div className="alert alert-success section-space" role="status">{message}</div>}
    <div className="grid grid-2 section-space">
      <section className="card"><div className="card-heading"><div><h2>Document details</h2><p>Updates to an approved document return it to draft.</p></div><span className="badge badge-neutral">{document.status.replaceAll("_", " ")}</span></div>
        <div className="stack"><FormField label="Title" htmlFor="srs-title" required><input id="srs-title" value={document.title} onChange={(event) => setDocument({ ...document, title: event.target.value })} /></FormField><FormField label="Status" htmlFor="srs-status"><select id="srs-status" value={document.status} onChange={(event) => void changeStatus(event.target.value as SrsDocument["status"])}><option value="draft">Draft</option><option value="in_review">In review</option><option value="approved">Approved</option></select></FormField></div>
      </section>
      <section className="card"><div className="card-heading"><div><h2>Versions</h2><p>Freeze the current saved draft with a note.</p></div><span className="font-mono">{document.latestVersionLabel || "No version yet"}</span></div>
        <form className="form-stack" onSubmit={(event) => void createVersion(event)}><div className="form-grid"><FormField label="Version increment" htmlFor="srs-bump"><select id="srs-bump" value={bump} onChange={(event) => setBump(event.target.value as "minor" | "major")}><option value="minor">Minor</option><option value="major">Major</option></select></FormField><FormField label="Version note" htmlFor="srs-note"><input id="srs-note" value={versionNote} onChange={(event) => setVersionNote(event.target.value)} placeholder="What changed?" /></FormField></div><button className="button button-quiet">Create version</button></form>
        {versions.length ? <div className="stack section-space">{versions.map((version) => <div className="list-row" key={version.id}><span><strong className="font-mono">{version.label}</strong><small>{version.note || "Version saved"} · {new Date(version.publishedAt).toLocaleDateString()}</small></span><button className="button button-quiet button-small" onClick={() => void openPreview(version.id)}>Preview</button></div>)}</div> : <EmptyState title="No versions yet" description="Save a version when the specification is ready to share." />}
      </section>
    </div>
    <section className="card section-space"><div className="card-heading"><div><h2>Ordered sections</h2><p>Use markdown-lite: paragraphs, “- ” bullets, “1.” lists, and **bold**. Section text is client-visible when enabled.</p></div><button className="button button-quiet button-small" onClick={addSection}>Add section +</button></div>
      <form className="form-stack" onSubmit={(event) => void save(event)}>
        {document.sections.length ? document.sections.map((section, index) => <article className="srs-section" key={section.id}><div className="srs-section-toolbar"><span className="font-mono section-kicker">{String(index + 1).padStart(2, "0")}</span><div className="button-row"><label className="toggle-label"><input type="checkbox" checked={section.clientVisible} onChange={(event) => updateSection(index, { clientVisible: event.target.checked })} /> Visible to client</label><button className="button button-quiet button-small" type="button" aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button><button className="button button-quiet button-small" type="button" aria-label={`Move ${section.title} down`} disabled={index === document.sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button><button className="button button-quiet button-small" type="button" onClick={() => removeSection(index)}>Remove</button></div></div>
          <div className="form-grid"><FormField label="Section title" htmlFor={`section-title-${section.id}`} required><input id={`section-title-${section.id}`} value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} /></FormField><FormField label="Section key" htmlFor={`section-key-${section.id}`}><input id={`section-key-${section.id}`} value={section.key} onChange={(event) => updateSection(index, { key: event.target.value })} /></FormField></div>
          <FormField label="Section content" htmlFor={`section-body-${section.id}`}><textarea id={`section-body-${section.id}`} rows={6} value={section.body} onChange={(event) => updateSection(index, { body: event.target.value })} /></FormField>
        </article>) : <EmptyState title="No sections yet" description="Add a section to begin the specification." />}
        <div className="button-row"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
      </form>
    </section>
    <section className="card section-space"><div className="card-heading"><div><h2>Requirements table</h2><p>These project requirements are included in each created document version.</p></div></div>{/* The requirements are managed in the project workspace. */}<Link className="button button-quiet button-small" href={`/projects/${encodeURIComponent(id)}?tab=requirements`}>Manage project requirements</Link></section>
    {previewOpen && <div className="document-overlay"><div className="document-toolbar"><strong>Document preview</strong><div className="button-row"><button className="button button-quiet button-small" onClick={() => downloadDocument(previewHtml, document?.title || "requirements-document")}>Save a copy</button><button className="button button-quiet button-small" onClick={() => { try { printDocument(previewFrame.current); } catch (issue) { setError(issue instanceof Error ? issue.message : "The document could not be printed."); } }}>Print</button><button className="button button-quiet button-small" onClick={() => setPreviewOpen(false)}>Close preview</button></div></div><iframe ref={previewFrame} title="Requirements document preview" sandbox="allow-scripts allow-modals" srcDoc={previewHtml} /></div>}
  </div>;
}
