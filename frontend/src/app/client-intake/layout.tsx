import type { Metadata } from "next";
import "./client-intake.css";

export const metadata: Metadata = {
  title: "Client details | DigitalFred",
  description: "Share your contact details with DigitalFred so we can prepare your client profile and project workspace.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    url: "https://digitalfred-dev.vercel.app/client-intake",
    siteName: "DigitalFred",
    title: "Client details | DigitalFred",
    description: "Share your contact details with DigitalFred so we can prepare your client profile and project workspace.",
    images: [
      {
        url: "https://digitalfred-dev.vercel.app/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "DigitalFred — thoughtful engineering, meaningful impact.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Client details | DigitalFred",
    description: "Share your contact details with DigitalFred so we can prepare your client profile and project workspace.",
    images: ["https://digitalfred-dev.vercel.app/opengraph-image.png"],
  },
};

export default function ClientIntakeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
