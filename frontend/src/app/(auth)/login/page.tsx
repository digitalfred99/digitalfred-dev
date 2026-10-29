"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { FormField } from "@/components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link className="brand-lockup auth-brand" href="/" aria-label="DigitalFred">
          <picture className="brand-picture">
            <source srcSet="/digitalfred-wordmark-light.svg" media="(prefers-color-scheme: dark)" />
            <Image className="brand-wordmark" src="/digitalfred-wordmark.svg" alt="DigitalFred" width={178} height={32} priority />
          </picture>
        </Link>
        <p className="eyebrow">YOUR STUDIO, IN ORDER</p>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to manage your clients, proposals, and projects.</p>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          <FormField label="Email address" htmlFor="email" required><input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></FormField>
          <FormField label="Password" htmlFor="password" required><input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></FormField>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="button button-primary button-wide" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-footnote">For your security, you’ll need to sign in again after a page reload.</p>
      </div>
    </main>
  );
}
