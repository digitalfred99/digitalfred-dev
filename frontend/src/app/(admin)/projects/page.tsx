"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { EmptyState, FormField, useToast } from "@/components/ui";

type Project = { id: string; name: string; identifier: string; description?: string; status: string; clientId: string | null; client?: { displayName: string }; updatedAt: string };
type ClientOption = { id: string; displayName: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", identifier: "", clientId: "", description: "", businessProblem: "", proposedSolution: "", scope: "" });
  const toast = useToast();
  const router = useRouter();

  async function load(value = "") {
    setLoading(true); setError("");
    try {
      const [projectResult, clientResult] = await Promise.all([
        api.get<Project[] | { data: Project[] }>("/projects", { search: value }),
        api.get<ClientOption[] | { data: ClientOption[] }>("/clients"),
      ]);
      setProjects(Array.isArray(projectResult) ? projectResult : projectResult.data);
      setClients((Array.isArray(clientResult) ? clientResult : clientResult.data).map((client) => ({ id: client.id, displayName: client.displayName })));
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "Projects could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Project[] | { data: Project[] }>("/projects"),
      api.get<ClientOption[] | { data: ClientOption[] }>("/clients"),
    ]).then(([projectResult, clientResult]) => {
      if (!active) return;
      setProjects(Array.isArray(projectResult) ? projectResult : projectResult.data);
      setClients((Array.isArray(clientResult) ? clientResult : clientResult.data).map((client) => ({ id: client.id, displayName: client.displayName })));
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "Projects could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFieldError("");
    try {
      const saved = await api.post<Project>("/projects", { ...form, clientId: form.clientId || null });
      setFormOpen(false); setForm({ name: "", identifier: "", clientId: "", description: "", businessProblem: "", proposedSolution: "", scope: "" });
      await load(); toast("Project created.");
      router.push(`/projects/${encodeURIComponent(saved.id)}`);
    } catch (issue) { setFieldError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "The project could not be saved."); }
    finally { setBusy(false); }
  }

  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">DELIVERY</p><h1>Projects</h1><p>Bring scope, requirements, milestones, and client decisions together.</p></div><div className="heading-actions"><input className="input search-input" aria-label="Search projects" placeholder="Search projects…" value={search} onChange={(event) => { setSearch(event.target.value); void load(event.target.value); }} /><button className="button button-primary" onClick={() => setFormOpen(!formOpen)}>{formOpen ? "Close form" : "New project"} <span aria-hidden="true">+</span></button></div></header>
    {formOpen && <section className="card section-space"><div className="card-heading"><div><h2>Start with the essentials</h2><p>You can add objectives, exclusions, and delivery detail as the project takes shape.</p></div></div><form className="form-stack" onSubmit={(event) => void create(event)}>
      <div className="form-grid"><FormField label="Project name" htmlFor="project-name" required><input id="project-name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField><FormField label="Identifier" htmlFor="project-id" hint="A short URL-friendly reference. Leave blank to derive it from the name."><input id="project-id" value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} /></FormField></div>
      <FormField label="Client" htmlFor="project-client"><select id="project-client" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Unassigned</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></FormField>
      <FormField label="Project description" htmlFor="project-description"><textarea id="project-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
      <div className="form-grid"><FormField label="Business problem" htmlFor="project-problem"><textarea id="project-problem" value={form.businessProblem} onChange={(event) => setForm({ ...form, businessProblem: event.target.value })} /></FormField><FormField label="Proposed solution" htmlFor="project-solution"><textarea id="project-solution" value={form.proposedSolution} onChange={(event) => setForm({ ...form, proposedSolution: event.target.value })} /></FormField></div>
      <FormField label="Initial scope" htmlFor="project-scope"><textarea id="project-scope" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} /></FormField>
      {fieldError && <p className="field-error" role="alert">{fieldError}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
    </form></section>}
    <section className="card section-space"><div className="card-heading"><div><h2>Project directory</h2><p>{loading ? "Loading…" : `${projects.length} projects shown`}</p></div></div>
      {error && <div className="alert alert-error" role="alert">{error}<button className="button button-quiet button-small" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="loading" role="status">Loading projects…</div> : projects.length ? <div className="table-wrap"><table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><Link className="table-primary" href={`/projects/${encodeURIComponent(project.id)}`}>{project.name}</Link><span className="table-secondary font-mono">{project.identifier}</span></td><td>{project.client?.displayName || "—"}</td><td><span className="badge badge-neutral">{project.status.replaceAll("_", " ")}</span></td><td>{new Date(project.updatedAt).toLocaleDateString()}</td><td><Link className="button button-quiet button-small" href={`/projects/${encodeURIComponent(project.id)}`}>Open</Link></td></tr>)}</tbody></table></div> : <EmptyState title="No projects yet" description={search ? "Try a different search." : "Create a project to hold its scope, requirements, proposals, and delivery milestones."} action={!search && <button className="button button-primary button-small" onClick={() => setFormOpen(true)}>Create a project</button>} />}
    </section>
  </div>;
}
