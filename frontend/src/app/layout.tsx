import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const headingFont = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://digitalfred-dev.vercel.app"),
  title: {
    default: "Fieldnotes Studio - DigitalFred | Software Developer",
    template: "%s | DigitalFred",
  },
  description: "Building digital experiences that work. Fieldnotes Studio is a considered workspace by DigitalFred.",
  applicationName: "Fieldnotes Studio",
  creator: "DigitalFred",
  publisher: "DigitalFred",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Fieldnotes Studio",
    title: "DigitalFred | Software Developer",
    description: "Building Digital Experiences That Work.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Fieldnotes Studio by DigitalFred" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DigitalFred | Software Developer",
    description: "Building Digital Experiences That Work.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#101b2a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headingFont.variable} ${monoFont.variable} h-full antialiased`}>
      <body className="min-h-full"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
