import type { Metadata } from "next";
import "./client-intake.css";

export const metadata: Metadata = {
  title: "Client details",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ClientIntakeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
