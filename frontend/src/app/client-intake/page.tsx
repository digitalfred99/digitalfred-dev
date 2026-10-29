"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ApiError, api } from "@/lib/api";
import { FormField } from "@/components/ui";

type ClientIntakeForm = {
  type: "individual" | "organization";
  contactName: string;
  organizationName: string;
  email: string;
  phone: string;
  preferredCurrency: "GHS" | "USD";
};

const EMPTY_FORM: ClientIntakeForm = {
  type: "individual",
  contactName: "",
  organizationName: "",
  email: "",
  phone: "",
  preferredCurrency: "GHS",
};

export default function ClientIntakePage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldError("");
    setBusy(true);
    try {
      await api.publicPost("/public/client-intake", {
        ...form,
        organizationName: form.type === "organization" ? form.organizationName : null,
        country: "Ghana",
      });
      setSubmitted(true);
    } catch (issue) {
      if (issue instanceof ApiError) {
        setFieldError(issue.field ? `${issue.field}: ${issue.message}` : "");
        setError(issue.field ? "" : issue.message);
      } else {
        setError("Your details could not be submitted. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="intake-title">
        <Link className="brand-lockup auth-brand" href="/" aria-label="DigitalFred">
          <picture className="brand-picture">
            <source srcSet="/digitalfred-wordmark-light.svg" media="(prefers-color-scheme: dark)" />
            <Image className="brand-wordmark" src="/digitalfred-wordmark.svg" alt="DigitalFred" width={178} height={32} priority />
          </picture>
        </Link>
        {submitted ? (
          <>
            <p className="eyebrow">DETAILS RECEIVED</p>
            <h1 id="intake-title">Thank you.</h1>
            <p className="muted">Your details have been submitted successfully. DigitalFred Dev Team can now use them to prepare your project information.</p>
          </>
        ) : (
          <>
            <p className="eyebrow">CLIENT DETAILS</p>
            <h1 id="intake-title">Let’s get started.</h1>
            <p className="muted">Share your contact details so we can prepare your project information.</p>
            <form className="form-stack" onSubmit={(event) => void submit(event)}>
              <FormField label="Client type" htmlFor="intake-type" required>
                <select
                  id="intake-type"
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as ClientIntakeForm["type"] })}
                >
                  <option value="individual">Individual</option>
                  <option value="organization">Organisation</option>
                </select>
              </FormField>
              {form.type === "organization" && (
                <FormField label="Organisation name" htmlFor="intake-organization" required>
                  <input
                    id="intake-organization"
                    required
                    autoComplete="organization"
                    value={form.organizationName}
                    onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
                  />
                </FormField>
              )}
              <FormField label="Full name" htmlFor="intake-name" required>
                <input
                  id="intake-name"
                  required
                  autoComplete="name"
                  value={form.contactName}
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                />
              </FormField>
              <FormField label="Email address" htmlFor="intake-email" required>
                <input
                  id="intake-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </FormField>
              <FormField label="Phone number" htmlFor="intake-phone" hint="Digits only, up to 15 digits.">
                <input
                  id="intake-phone"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={15}
                  pattern="[0-9]{0,15}"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 15) })}
                />
              </FormField>
              <FormField label="Preferred currency" htmlFor="intake-currency" required>
                <select
                  id="intake-currency"
                  value={form.preferredCurrency}
                  onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value as ClientIntakeForm["preferredCurrency"] })}
                >
                  <option value="GHS">GHS - Ghanaian cedi</option>
                  <option value="USD">USD - US dollar</option>
                </select>
              </FormField>
              <FormField label="Country" htmlFor="intake-country">
                <input id="intake-country" value="Ghana" readOnly />
              </FormField>
              {(fieldError || error) && <div className="alert alert-error" role="alert">{fieldError || error}</div>}
              <button className="button button-primary button-wide" disabled={busy}>
                {busy ? "Submitting…" : "Submit details"} <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="auth-footnote">Your details will be added to DigitalFred’s client records.</p>
          </>
        )}
      </section>
    </main>
  );
}
