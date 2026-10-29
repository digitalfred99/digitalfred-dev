import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digital Fred: Proposals API",
  description: "Backend for proposals, requirements, quotations and client negotiation.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
