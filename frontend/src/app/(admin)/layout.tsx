"use client";

import { AdminShell } from "@/components/admin-shell";
import { ToastProvider } from "@/components/ui";
import { RequireAuth } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth><ToastProvider><AdminShell>{children}</AdminShell></ToastProvider></RequireAuth>;
}
