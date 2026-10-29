"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { ConfirmDialog, EmptyState } from "@/components/ui";

type Payment = { id: string; proposalId: string; versionId: string; itemKey: string; label: string; amountMinor: number | null; currency: string; dueDate: string | null; status: "pending" | "paid" | "waived"; paidAt: string | null; paymentReference: string | null; notes: string | null; overdue: boolean };
const STATUS = ["pending", "paid", "waived"] as const;

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ payment: Payment; status: Payment["status"] } | null>(null);

  async function load(filter = status) {
    setLoading(true); setError("");
    try { setPayments(await api.get<Payment[]>("/payments", { status: filter || undefined })); }
    catch (issue) { setError(issue instanceof ApiError ? issue.message : "Payment records could not be loaded."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    api.get<Payment[]>("/payments").then((result) => { if (active) setPayments(result); })
      .catch((issue: unknown) => { if (active) setError(issue instanceof ApiError ? issue.message : "Payment records could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>, payment: Payment) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      await api.patch(`/payments/${encodeURIComponent(payment.id)}`, {
        status: formData.get("status"),
        paymentReference: formData.get("paymentReference"),
        notes: formData.get("notes"),
        dueDate: formData.get("dueDate") || null,
      });
      await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The payment record could not be updated."); }
  }
  async function confirmStatus() {
    if (!confirm) return;
    try {
      await api.patch(`/payments/${encodeURIComponent(confirm.payment.id)}`, { status: confirm.status });
      await load();
    } catch (issue) { setError(issue instanceof ApiError ? issue.message : "The payment status could not be updated."); }
    finally { setConfirm(null); }
  }

  return <div className="page-shell">
    <header className="page-heading"><div><p className="eyebrow">BOOKKEEPING</p><h1>Payments</h1><p>Record instalments from accepted versions. No payments are processed in this workspace.</p></div><select aria-label="Filter payment status" value={status} onChange={(event) => { setStatus(event.target.value); void load(event.target.value); }}><option value="">All statuses</option>{STATUS.map((item) => <option value={item} key={item}>{item}</option>)}</select></header>
    <div className="alert alert-warning">Payment records are bookkeeping only. Agreed amounts and labels are fixed from the accepted proposal version.</div>
    {error && <div className="alert alert-error section-space" role="alert">{error}<button className="button button-quiet button-small" onClick={() => void load()}>Retry</button></div>}
    <section className="card section-space"><div className="card-heading"><div><h2>Payment records</h2><p>{loading ? "Loading…" : `${payments.length} records`}</p></div></div>{loading ? <div className="loading" role="status">Loading payment records…</div> : payments.length ? <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Amount</th><th>Due</th><th>Bookkeeping status</th><th>Reference & notes</th><th>Save</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><Link className="table-primary" href={`/proposals/${encodeURIComponent(payment.proposalId)}`}>{payment.label}</Link><span className="table-secondary">{payment.itemKey} · version {payment.versionId.slice(0, 8)}</span>{payment.overdue && <span className="badge badge-red">Overdue</span>}</td><td className="font-mono">{formatMoney(payment.amountMinor, payment.currency)}</td><td>{payment.dueDate || "Not set"}</td><td><form id={`payment-${payment.id}`} className="payment-inline-form" onSubmit={(event) => void save(event, payment)}><select name="status" aria-label={`Status for ${payment.label}`} defaultValue={payment.status} onChange={(event) => { const next = event.target.value as Payment["status"]; if (next !== payment.status && next !== "pending") { event.preventDefault(); setConfirm({ payment, status: next }); } }}><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option></select></form></td><td><input form={`payment-${payment.id}`} name="paymentReference" aria-label={`Payment reference for ${payment.label}`} defaultValue={payment.paymentReference || ""} placeholder="Reference" /><textarea form={`payment-${payment.id}`} name="notes" aria-label={`Notes for ${payment.label}`} defaultValue={payment.notes || ""} placeholder="Notes" rows={2} /><input form={`payment-${payment.id}`} name="dueDate" type="date" aria-label={`Due date for ${payment.label}`} defaultValue={payment.dueDate || ""} /></td><td><button className="button button-quiet button-small" form={`payment-${payment.id}`}>Save</button></td></tr>)}</tbody></table></div> : <EmptyState title="No payment records" description="Records are created from accepted proposal versions and appear here for bookkeeping." />}</section>
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.status === "paid" ? "Mark this payment received?" : "Waive this payment?"} description={confirm?.status === "paid" ? "This records the instalment as paid. It does not process a transaction." : "This records the instalment as waived and will not process a transaction."} confirmLabel={confirm?.status === "paid" ? "Mark as paid" : "Waive payment"} destructive={confirm?.status === "waived"} onCancel={() => setConfirm(null)} onConfirm={() => void confirmStatus()} />
  </div>;
}
