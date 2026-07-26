import type { Metadata } from "next";
import "./globals.css";
import TopNav from "./components/TopNav";
import { getSiteUrl } from "@/lib/site";

const title = "Tagsheep";
const description = "Tagsheep is a community-built clothing tag database for thrifters, resellers, and vintage hunters. Look up any brand, RN number, or style number.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title,
  description,
  applicationName: "Tagsheep",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tagsheep",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title,
    description,
    siteName: "Tagsheep",
    type: "website",
    images: [{ url: "/badges/tagiconglass.png", width: 1254, height: 1254 }],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/badges/tagiconglass.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gradient-to-b from-[#0f172a] via-[#0b1222] to-[#090f1c] text-white selection:bg-emerald-400/40">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(60%_60%_at_50%_30%,#000_20%,transparent_80%)]"
        >
          <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.25),_transparent_60%)] blur-3xl" />
          <div className="absolute top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.25),_transparent_60%)] blur-3xl" />
          <div className="absolute -bottom-24 right-1/5 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.25),_transparent_60%)] blur-3xl" />
        </div>

        <TopNav />
        {children}
      </body>
    </html>
  );
}
