"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const NAV = [
  { label: "Overview", href: "/dashboard", icon: "◫" },
  { label: "Clients", href: "/clients", icon: "◉" },
  { label: "Projects", href: "/projects", icon: "▦" },
  { label: "Proposals", href: "/proposals", icon: "▤" },
  { label: "Negotiations", href: "/negotiations", icon: "↗" },
  { label: "Payments", href: "/payments", icon: "◇" },
  { label: "Services", href: "/service-catalog", icon: "✳" },
  { label: "Templates", href: "/templates", icon: "▧" },
  { label: "Settings", href: "/settings", icon: "⚙" },
  { label: "Audit log", href: "/audit-log", icon: "≋" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <div className="admin-frame">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/dashboard" aria-label="DigitalFred Studio Console">
          <picture className="brand-picture">
            <source srcSet="/digitalfred-wordmark-light.svg" media="(prefers-color-scheme: dark)" />
            <Image className="brand-wordmark" src="/digitalfred-wordmark.svg" alt="DigitalFred" width={178} height={32} priority />
          </picture>
          <small className="brand-product-label">STUDIO CONSOLE</small>
        </Link>
        <nav aria-label="Main navigation">
          <p className="nav-label">WORKSPACE</p>
          {NAV.slice(0, 5).map((item) => <Link key={item.href} href={item.href} className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}
          <p className="nav-label nav-gap">OPERATIONS</p>
          {NAV.slice(5).map((item) => <Link key={item.href} href={item.href} className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}
        </nav>
        <div className="sidebar-bottom"><span className="avatar">{(user?.name || user?.email || "F").slice(0, 1).toUpperCase()}</span><div className="account-copy"><strong>{user?.name || "Your workspace"}</strong><small>{user?.email}</small></div><button className="icon-button" aria-label="Sign out" onClick={() => void logout()}>↗</button></div>
      </aside>
      <main className="admin-content"><div className="mobile-top"><Link className="brand-lockup mobile-brand" href="/dashboard" aria-label="DigitalFred Studio Console"><picture className="brand-picture"><source srcSet="/digitalfred-wordmark-light.svg" media="(prefers-color-scheme: dark)" /><Image className="brand-wordmark" src="/digitalfred-wordmark.svg" alt="DigitalFred" width={156} height={28} priority /></picture></Link><button className="button button-quiet button-small" onClick={() => void logout()}>Sign out</button></div>{children}</main>
    </div>
  );
}
