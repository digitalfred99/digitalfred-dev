"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { FormField } from "@/components/ui";

type Project = { id: string; name: string; identifier: string; clientId: string | null; client?: { displayName: string } };

export default function NewProposalPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<Project[] | { data: Project[] }>("/projects").then((result) => {
      if (active) setProjects(Array.isArray(result) ? result : result.data);
    }).catch((issue: unknown) => {
      if (active) setError(issue instanceof ApiError ? issue.message : "Projects could not be loaded.");
    });
    return () => { active = false; };
  }, []);
  const selectedProject = projects.find((project) => project.id === projectId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const proposal = await api.post<{ id: string }>("/proposals", { projectId, title: title.trim() || undefined, currency });
      router.push(`/proposals/${encodeURIComponent(proposal.id)}`);
    } catch (issue) { setError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "The proposal could not be created."); }
    finally { setBusy(false); }
  }

  return <div className="page-shell"><div className="page-heading"><div><p className="eyebrow">NEW ENGAGEMENT</p><h1>Start a proposal</h1><p>The project seeds the proposal with existing scope context. You can refine it before publishing.</p></div></div>
    <section className="card form-card"><form className="form-stack" onSubmit={(event) => void submit(event)}>
      <FormField label="Project" htmlFor="proposal-project" required><select id="proposal-project" required value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Choose a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.identifier}{project.client?.displayName ? ` · ${project.client.displayName}` : ""}</option>)}</select></FormField>
      <FormField label="Proposal title" htmlFor="proposal-title" hint="If left blank, the server creates a title from the project name."><input id="proposal-title" value={title} onChange={(event) => setTitle(event.target.value)} /></FormField>
      <FormField label="Currency" htmlFor="proposal-currency" required><input id="proposal-currency" maxLength={3} minLength={3} required value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></FormField>
      {selectedProject && <div className="alert alert-success">A proposal will be linked to <strong>{selectedProject.client?.displayName || "the project’s client"}</strong>. The server will initialise pricing as unset.</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="button-row"><button type="button" className="button button-quiet" onClick={() => router.back()}>Cancel</button><button className="button button-primary" disabled={busy || !projects.length}>{busy ? "Creating…" : "Create draft"}</button></div>
    </form></section>
  </div>;
}
