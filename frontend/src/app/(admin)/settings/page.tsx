"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { api, ApiError } from "@/lib/api";
import { FormField, useToast } from "@/components/ui";

type Settings = {
  business: { name: string; legalName: string; email: string; phone: string; website: string; address: string; logoDataUrl: string; registrationNumber: string; taxNumber: string };
  defaults: { currency: string; validityDays: number; paymentTerms: string; warrantyTerms: string; ipTerms: string; confidentialityTerms: string; changeRequestPolicy: string; terminationTerms: string; supportTerms: string; contractClauses: { id: string; title: string; body: string }[] };
  numbering: { proposalPrefix: string; padding: number; includeYear: boolean };
  portal: { accentColor: string; tagline: string; footerNote: string };
  notifications: { notifyEmail: string; emailOnClientActivity: boolean };
};
const empty: Settings = {
  business: { name: "", legalName: "", email: "", phone: "", website: "", address: "", logoDataUrl: "", registrationNumber: "", taxNumber: "" },
  defaults: { currency: "GHS", validityDays: 30, paymentTerms: "", warrantyTerms: "", ipTerms: "", confidentialityTerms: "", changeRequestPolicy: "", terminationTerms: "", supportTerms: "", contractClauses: [] },
  numbering: { proposalPrefix: "PRP", padding: 4, includeYear: true },
  portal: { accentColor: "#1f6b57", tagline: "", footerNote: "" },
  notifications: { notifyEmail: "", emailOnClientActivity: false },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  useEffect(() => {
    let active = true;
    api.get<Settings>("/settings").then((value) => { if (active) setSettings(value); })
      .catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "Settings could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { setSettings(await api.put<Settings>("/settings", settings)); toast("Settings saved."); }
    catch (issue) { setError(issue instanceof ApiError ? issue.field ? `${issue.field}: ${issue.message}` : issue.message : "Settings could not be saved."); }
    finally { setBusy(false); }
  }
  function uploadLogo(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Choose a PNG, JPEG, or WebP logo."); return; }
    if (file.size > 200_000) { setError("Logo files must be no larger than 200 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setSettings((current) => ({ ...current, business: { ...current.business, logoDataUrl: reader.result as string } }));
      else setError("The selected logo could not be read.");
    };
    reader.onerror = () => setError("The selected logo could not be read.");
    reader.readAsDataURL(file);
  }
  function updateBusiness<K extends keyof Settings["business"]>(key: K, value: Settings["business"][K]) {
    setSettings((current) => ({ ...current, business: { ...current.business, [key]: value } }));
  }
  function updateDefaults<K extends keyof Settings["defaults"]>(key: K, value: Settings["defaults"][K]) {
    setSettings((current) => ({ ...current, defaults: { ...current.defaults, [key]: value } }));
  }

  if (loading) return <div className="loading" role="status">Loading studio settings…</div>;
  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">YOUR STUDIO</p><h1>Settings</h1><p>Business identity, proposal defaults, numbering, and portal branding.</p></div><button form="settings-form" className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></header>
    {error && <div className="alert alert-error section-space" role="alert">{error}</div>}
    <form id="settings-form" className="stack" onSubmit={(event) => void save(event)}>
      <section className="card"><div className="card-heading"><div><h2>Business details</h2><p>Information printed in proposal documents.</p></div></div><div className="form-grid"><FormField label="Business name" htmlFor="business-name"><input id="business-name" value={settings.business.name} onChange={(event) => updateBusiness("name", event.target.value)} /></FormField><FormField label="Legal name" htmlFor="business-legal"><input id="business-legal" value={settings.business.legalName} onChange={(event) => updateBusiness("legalName", event.target.value)} /></FormField><FormField label="Email" htmlFor="business-email"><input id="business-email" type="email" value={settings.business.email} onChange={(event) => updateBusiness("email", event.target.value)} /></FormField><FormField label="Phone" htmlFor="business-phone"><input id="business-phone" value={settings.business.phone} onChange={(event) => updateBusiness("phone", event.target.value)} /></FormField><FormField label="Website" htmlFor="business-website"><input id="business-website" type="url" value={settings.business.website} onChange={(event) => updateBusiness("website", event.target.value)} /></FormField><FormField label="Registration number" htmlFor="business-reg"><input id="business-reg" value={settings.business.registrationNumber} onChange={(event) => updateBusiness("registrationNumber", event.target.value)} /></FormField><FormField label="Tax number" htmlFor="business-tax"><input id="business-tax" value={settings.business.taxNumber} onChange={(event) => updateBusiness("taxNumber", event.target.value)} /></FormField><FormField label="Address" htmlFor="business-address"><textarea id="business-address" value={settings.business.address} onChange={(event) => updateBusiness("address", event.target.value)} /></FormField></div><div className="form-grid section-space"><FormField label="Logo (PNG, JPEG, or WebP; up to 200 KB)" htmlFor="business-logo"><input id="business-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0])} /></FormField><div>{settings.business.logoDataUrl ? <><Image className="logo-preview" src={settings.business.logoDataUrl} alt="Business logo preview" width={220} height={90} unoptimized /><button className="button button-quiet button-small section-space" type="button" onClick={() => updateBusiness("logoDataUrl", "")}>Remove logo</button></> : <p className="muted small-copy">No logo uploaded.</p>}</div></div></section>
      <section className="card"><div className="card-heading"><div><h2>Proposal defaults</h2><p>Defaults apply when creating a proposal; they do not change existing terms.</p></div></div><div className="form-grid"><FormField label="Default currency" htmlFor="default-currency"><input id="default-currency" maxLength={3} value={settings.defaults.currency} onChange={(event) => updateDefaults("currency", event.target.value.toUpperCase())} /></FormField><FormField label="Validity (days)" htmlFor="default-validity"><input id="default-validity" type="number" min="1" max="365" value={settings.defaults.validityDays} onChange={(event) => updateDefaults("validityDays", Number(event.target.value))} /></FormField></div><div className="form-grid section-space">{(["paymentTerms", "warrantyTerms", "ipTerms", "confidentialityTerms", "changeRequestPolicy", "terminationTerms", "supportTerms"] as const).map((field) => <FormField key={field} label={field.replaceAll(/([A-Z])/g, " $1")} htmlFor={`default-${field}`}><textarea id={`default-${field}`} value={settings.defaults[field]} onChange={(event) => updateDefaults(field, event.target.value)} /></FormField>)}</div></section>
      <section className="card"><div className="card-heading"><div><h2>Proposal numbering</h2><p>New proposal references use this format.</p></div></div><div className="form-grid"><FormField label="Prefix" htmlFor="number-prefix"><input id="number-prefix" value={settings.numbering.proposalPrefix} onChange={(event) => setSettings({ ...settings, numbering: { ...settings.numbering, proposalPrefix: event.target.value.toUpperCase() } })} /></FormField><FormField label="Number padding" htmlFor="number-padding"><input id="number-padding" type="number" min="1" max="8" value={settings.numbering.padding} onChange={(event) => setSettings({ ...settings, numbering: { ...settings.numbering, padding: Number(event.target.value) } })} /></FormField></div><label className="toggle-label section-space"><input type="checkbox" checked={settings.numbering.includeYear} onChange={(event) => setSettings({ ...settings, numbering: { ...settings.numbering, includeYear: event.target.checked } })} /> Include year in proposal reference</label></section>
      <section className="card"><div className="card-heading"><div><h2>Client portal branding</h2><p>These details appear on published client portal pages.</p></div></div><div className="form-grid"><FormField label="Accent colour" htmlFor="portal-accent"><input id="portal-accent" type="color" value={settings.portal.accentColor} onChange={(event) => setSettings({ ...settings, portal: { ...settings.portal, accentColor: event.target.value } })} /></FormField><FormField label="Tagline" htmlFor="portal-tagline"><input id="portal-tagline" value={settings.portal.tagline} onChange={(event) => setSettings({ ...settings, portal: { ...settings.portal, tagline: event.target.value } })} /></FormField></div><FormField label="Footer note" htmlFor="portal-footer"><textarea id="portal-footer" value={settings.portal.footerNote} onChange={(event) => setSettings({ ...settings, portal: { ...settings.portal, footerNote: event.target.value } })} /></FormField></section>
      <section className="card"><div className="card-heading"><div><h2>Notifications</h2><p>Notification preferences for client activity.</p></div></div><FormField label="Notification email" htmlFor="notify-email"><input id="notify-email" type="email" value={settings.notifications.notifyEmail} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, notifyEmail: event.target.value } })} /></FormField><label className="toggle-label section-space"><input type="checkbox" checked={settings.notifications.emailOnClientActivity} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, emailOnClientActivity: event.target.checked } })} /> Email me about client activity</label></section>
      <div className="button-row"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div>
    </form>
  </div>;
}
