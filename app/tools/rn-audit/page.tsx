"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AuditRecord = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  verificationStatus?: string | null;
};

export default function RNAuditPage() {
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qRef);
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditRecord, "id">) })));
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const text = [row.brand ?? "", row.productName ?? "", row.rn ?? "", row.styleNumber ?? ""].join(" ").toLowerCase();
      return q ? text.includes(q) : true;
    });
  }, [rows, search]);

  const withRn = filtered.filter((row) => row.rn?.trim()).length;
  const missingRn = filtered.filter((row) => !row.rn?.trim()).length;

  return (
    <AdminGate
      title="RN audit"
      description="Review RN coverage across the database, spot missing records, and jump into bulk cleanup."
    >
      <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin audit</p>
          <h1 className="text-3xl font-semibold">RN audit</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Review RN coverage across the database, spot missing records, and jump into bulk cleanup.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/tools/rn-audit/bulk-edit" className="underline">Bulk edit</Link>
          <Link href="/tools" className="underline">← Back to tools</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Loaded records" value={loading ? "…" : String(filtered.length)} />
        <StatCard label="With RN" value={loading ? "…" : String(withRn)} />
        <StatCard label="Missing RN" value={loading ? "…" : String(missingRn)} />
      </div>

      {loadError && (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          Couldn&apos;t load records. Check your connection and try refreshing.
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand, product name, RN, style number..."
          className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead className="bg-black/20 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Brand</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">RN</th>
              <th className="px-4 py-3 text-left">Style</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="px-4 py-3">{row.brand || "—"}</td>
                <td className="px-4 py-3">{row.productName || "—"}</td>
                <td className="px-4 py-3">{row.rn || <span className="text-amber-300">Missing</span>}</td>
                <td className="px-4 py-3">{row.styleNumber || "—"}</td>
                <td className="px-4 py-3">{row.verificationStatus || "pending"}</td>
                <td className="px-4 py-3"><Link href={`/tag/${row.id}`} className="underline">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </main>
    </AdminGate>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
