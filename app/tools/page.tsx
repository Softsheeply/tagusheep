"use client";

import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";

export default function ToolsHome() {
  return (
    <AdminGate title="Tagsheep tools" description="Admin tools for your own-photo archive.">
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
          <h1 className="text-2xl font-semibold">Tagsheep tools</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Your own photos only. Use Capture to build the archive and registry from real tags on your clothes.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/capture"
            className="rounded-2xl border border-emerald-300/50 bg-emerald-400/15 p-4 shadow-[0_12px_40px_rgba(52,211,153,0.14)] transition hover:border-emerald-200/80 hover:bg-emerald-300/20 md:col-span-2"
          >
            <div className="font-semibold text-emerald-100">Capture garments</div>
            <p className="mt-2 text-sm text-emerald-50/85">
              Primary workflow — photograph your clothes, read RN/CA/style from tags, upload verified records.
            </p>
          </Link>

          <Link href="/export" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300/40">
            <div className="font-semibold">Export backup</div>
            <p className="mt-2 text-sm text-white/70">Download JSON/CSV of the archive.</p>
          </Link>

          <Link href="/tools/rn-audit" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300/40">
            <div className="font-semibold">RN audit</div>
            <p className="mt-2 text-sm text-white/70">Find records missing RN or with conflicts.</p>
          </Link>

          <Link href="/tools/category-audit" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300/40">
            <div className="font-semibold">Category audit</div>
            <p className="mt-2 text-sm text-white/70">Assign categories to incomplete records.</p>
          </Link>

          <Link href="/trash" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300/40">
            <div className="font-semibold">Trash</div>
            <p className="mt-2 text-sm text-white/70">Restore or permanently delete trashed records.</p>
          </Link>

          <Link href="/submissions-review" className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-emerald-300/40">
            <div className="font-semibold">Corrections</div>
            <p className="mt-2 text-sm text-white/70">Community reports (when you open submissions later).</p>
          </Link>
        </div>

        <p className="text-sm text-white/45">
          Removed: URL import, bulk import, and scraped product images — own photos only.
        </p>
      </main>
    </AdminGate>
  );
}
