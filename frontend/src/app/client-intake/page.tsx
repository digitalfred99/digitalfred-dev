"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { ApiError, api } from "@/lib/api";

const styles = {
  page: "ci-page",
  ambient: "ci-ambient",
  ambientOrb: "ci-ambient-orb",
  ambientLine: "ci-ambient-line",
  experience: "ci-experience",
  story: "ci-story",
  storyTexture: "ci-story-texture",
  storyTop: "ci-story-top",
  brandName: "ci-brand-name",
  privateLabel: "ci-private-label",
  storyBody: "ci-story-body",
  markStage: "ci-mark-stage",
  markOrbit: "ci-mark-orbit",
  markOrbitInner: "ci-mark-orbit-inner",
  symbol: "ci-symbol",
  sparkle: "ci-sparkle",
  storyEyebrow: "ci-story-eyebrow",
  storyCopy: "ci-story-copy",
  steps: "ci-steps",
  step: "ci-step",
  stepNumber: "ci-step-number",
  stepCheck: "ci-step-check",
  stepArrow: "ci-step-arrow",
  storyFooter: "ci-story-footer",
  footerDot: "ci-footer-dot",
  footerMono: "ci-footer-mono",
  formSide: "ci-form-side",
  formTopline: "ci-form-topline",
  stepPill: "ci-step-pill",
  stepPillDot: "ci-step-pill-dot",
  successCard: "ci-success-card",
  successIcon: "ci-success-icon",
  formEyebrow: "ci-form-eyebrow",
  formIntro: "ci-form-intro",
  nextCard: "ci-next-card",
  nextIcon: "ci-next-icon",
  thankYouFoot: "ci-thank-you-foot",
  formCard: "ci-form-card",
  formHeading: "ci-form-heading",
  desktopBreak: "ci-desktop-break",
  form: "ci-form",
  typeFieldset: "ci-type-fieldset",
  typeChoices: "ci-type-choices",
  typeChoice: "ci-type-choice",
  selected: "ci-selected",
  typeIcon: "ci-type-icon",
  radioMark: "ci-radio-mark",
  field: "ci-field",
  contactGrid: "ci-contact-grid",
  preferences: "ci-preferences",
  countryField: "ci-country-field",
  countryLabel: "ci-country-label",
  countryValue: "ci-country-value",
  error: "ci-error",
  submitButton: "ci-submit-button",
  submitArrow: "ci-submit-arrow",
  privacyNote: "ci-privacy-note",
  formFooter: "ci-form-footer",
} as const;

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
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.ambientOrb} />
        <span className={styles.ambientLine} />
      </div>
      <section className={styles.experience}>
        <aside className={styles.story}>
          <div className={styles.storyTexture} aria-hidden="true" />
          <div className={styles.storyTop}>
            <span className={styles.brandName}>DigitalFred</span>
            <span className={styles.privateLabel}><span /> CLIENT INTAKE</span>
          </div>

          <div className={styles.storyBody}>
            <div className={styles.markStage} aria-hidden="true">
              <span className={styles.markOrbit} />
              <span className={styles.markOrbitInner} />
              <Image src="/digitalfred-symbol.svg" alt="" width={100} height={100} className={styles.symbol} priority />
              <span className={styles.sparkle}>✳</span>
            </div>
            <p className={styles.storyEyebrow}>A BETTER START, TOGETHER</p>
            <h2>Good work starts with <em>good details.</em></h2>
            <p className={styles.storyCopy}>A few details now help us understand who we’re working with and make your project experience feel considered from day one.</p>

            <div className={styles.steps} aria-label="What happens next">
              <div className={styles.step}>
                <span className={styles.stepNumber}>01</span>
                <span><strong>Share your details</strong><small>Just the essentials, securely submitted.</small></span>
                <span className={styles.stepCheck} aria-hidden="true">✓</span>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNumber}>02</span>
                <span><strong>We prepare your workspace</strong><small>Your information stays accurate.</small></span>
                <span className={styles.stepArrow} aria-hidden="true">↗</span>
              </div>
            </div>
          </div>

          <div className={styles.storyFooter}>
            <span className={styles.footerDot} />
            <span>Thoughtful software. Clear communication.</span>
            <span className={styles.footerMono}>DIGITALFRED · GH</span>
          </div>
        </aside>

        <div className={styles.formSide}>
          <div className={styles.formTopline}>
            <span className={styles.stepPill}><span className={styles.stepPillDot} /> {submitted ? "COMPLETE" : "STEP 1 OF 1"}</span>
          </div>

          {submitted ? (
            <section className={styles.successCard} aria-labelledby="intake-title" role="status">
              <div className={styles.successIcon} aria-hidden="true"><span>✓</span></div>
              <p className={styles.formEyebrow}>DETAILS RECEIVED</p>
              <h1 id="intake-title">Thank you{form.contactName ? `, ${form.contactName.split(" ")[0]}` : ""}.</h1>
              <p className={styles.formIntro}>Your details are safely with us. We’ll use them to prepare your project information and make sure everything is set up correctly.</p>
              <div className={styles.nextCard}>
                <span className={styles.nextIcon} aria-hidden="true">↗</span>
                <span><strong>What happens next?</strong><small>DigitalFred will be in touch about your project.</small></span>
              </div>
              <p className={styles.thankYouFoot}>Thanks for taking a moment to get us started.</p>
            </section>
          ) : (
            <section className={styles.formCard} aria-labelledby="intake-title">
              <div className={styles.formHeading}>
                <p className={styles.formEyebrow}>LET’S MAKE IT OFFICIAL</p>
                <h1 id="intake-title">Tell us a little<br className={styles.desktopBreak} /> about yourself.</h1>
                <p className={styles.formIntro}>We’ll use these details to create your client profile and keep your project communication in the right place.</p>
              </div>

              <form className={styles.form} onSubmit={(event) => void submit(event)}>
                <fieldset className={styles.typeFieldset}>
                  <legend>Who are we working with?</legend>
                  <div className={styles.typeChoices}>
                    <label className={`${styles.typeChoice} ${form.type === "individual" ? styles.selected : ""}`}>
                      <input
                        type="radio"
                        name="client-type"
                        value="individual"
                        checked={form.type === "individual"}
                        onChange={() => setForm({ ...form, type: "individual" })}
                      />
                      <span className={styles.typeIcon} aria-hidden="true">◉</span>
                      <span><strong>Just me</strong><small>Individual</small></span>
                      <span className={styles.radioMark} aria-hidden="true" />
                    </label>
                    <label className={`${styles.typeChoice} ${form.type === "organization" ? styles.selected : ""}`}>
                      <input
                        type="radio"
                        name="client-type"
                        value="organization"
                        checked={form.type === "organization"}
                        onChange={() => setForm({ ...form, type: "organization" })}
                      />
                      <span className={styles.typeIcon} aria-hidden="true">▦</span>
                      <span><strong>My organisation</strong><small>Business or team</small></span>
                      <span className={styles.radioMark} aria-hidden="true" />
                    </label>
                  </div>
                </fieldset>

                {form.type === "organization" && (
                  <div className={styles.field}>
                    <label htmlFor="intake-organization">Organisation name <span aria-hidden="true">*</span></label>
                    <input
                      id="intake-organization"
                      required
                      autoComplete="organization"
                      placeholder="e.g. Acme Studio"
                      value={form.organizationName}
                      onChange={(event) => setForm({ ...form, organizationName: event.target.value })}
                    />
                  </div>
                )}

                <div className={styles.field}>
                  <label htmlFor="intake-name">Your full name <span aria-hidden="true">*</span></label>
                  <input
                    id="intake-name"
                    required
                    autoComplete="name"
                    placeholder="How should we address you?"
                    value={form.contactName}
                    onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  />
                </div>

                <div className={styles.contactGrid}>
                  <div className={styles.field}>
                    <label htmlFor="intake-email">Email address <span aria-hidden="true">*</span></label>
                    <input
                      id="intake-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="intake-phone">Phone number</label>
                    <input
                      id="intake-phone"
                      type="text"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={15}
                      pattern="[0-9]{0,15}"
                      placeholder="Optional"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, "").slice(0, 15) })}
                    />
                    <small>Digits only, up to 15 digits.</small>
                  </div>
                </div>

                <div className={styles.preferences}>
                  <div className={styles.field}>
                    <label htmlFor="intake-currency">Preferred currency <span aria-hidden="true">*</span></label>
                    <select
                      id="intake-currency"
                      value={form.preferredCurrency}
                      onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value as ClientIntakeForm["preferredCurrency"] })}
                    >
                      <option value="GHS">GHS - Ghanaian cedi</option>
                      <option value="USD">USD - US dollar</option>
                    </select>
                  </div>
                  <div className={styles.countryField}>
                    <span className={styles.countryLabel}>Based in</span>
                    <div className={styles.countryValue}><span aria-hidden="true">GH</span><strong>Ghana</strong><small>Country</small></div>
                  </div>
                </div>

                {(fieldError || error) && <div className={`alert alert-error ${styles.error}`} role="alert">{fieldError || error}</div>}

                <button className={styles.submitButton} disabled={busy}>
                  <span>{busy ? "Sending your details…" : "Send my details"}</span>
                  <span className={styles.submitArrow} aria-hidden="true">{busy ? "…" : "→"}</span>
                </button>
                <p className={styles.privacyNote}><span aria-hidden="true">⌑</span> Your information is only used to set up and manage your client profile.</p>
              </form>
            </section>
          )}

          <footer className={styles.formFooter}>
            <span>© DigitalFred</span>
            <span><i /> MADE FOR A GREAT FIRST STEP</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
