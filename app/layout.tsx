import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaguSheep",
  description: "TaguSheep is a clothing internet database for fashion labels, style numbers, RN records, and reference imagery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gradient-to-b from-[#0f172a] via-[#0b1222] to-[#090f1c] text-white selection:bg-emerald-400/40">
        {/* Soft animated glow backdrop */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(60%_60%_at_50%_30%,#000_20%,transparent_80%)]"
        >
          <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(45,212,191,0.25),_transparent_60%)] blur-3xl" />
          <div className="absolute top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.25),_transparent_60%)] blur-3xl" />
          <div className="absolute -bottom-24 right-1/5 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.25),_transparent_60%)] blur-3xl" />
        </div>

        {/* Top nav */}
        <nav className="sticky top-0 z-40 backdrop-blur-md bg-white/5 border-b border-white/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐑</span>
              <span className="font-semibold tracking-wide">TaguSheep</span>
            </a>
            <div className="flex items-center gap-3 text-sm">
              <a href="/tags" className="hover:text-emerald-300 transition">Database</a>
              <a href="/upload" className="hover:text-emerald-300 transition">Upload</a>
              <a href="/import" className="hover:text-emerald-300 transition">Import URL</a>
              <a href="/tools" className="hover:text-emerald-300 transition">Tools</a>
              <a
                href="https://firebase.google.com/"
                target="_blank"
                className="hidden sm:inline-block rounded-full border border-white/15 px-3 py-1 hover:border-emerald-300/50 transition"
              >
                Powered by Firebase
              </a>
            </div>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}
