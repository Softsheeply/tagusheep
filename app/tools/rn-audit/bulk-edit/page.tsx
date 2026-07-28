"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { collection, getDocs, orderBy, query, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type BulkRecord = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
};

export default function BulkEditPage() {
  const [rows, setRows] = useState<BulkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [newRn, setNewRn] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qRef);
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BulkRecord, "id">) })));
      } catch {
        setMessage("Couldn't load records. Check your connection and try refreshing.");
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

  const selectedIds = Object.entries(selected).filter(([, value]) => value).map(([id]) => id);

  async function applyRn() {
    const digits = newRn.replace(/\D+/g, "");
    if (!digits) {
      setMessage("Enter an RN number first.");
      return;
    }
    if (selectedIds.length === 0) {
      setMessage("Select at least one record.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => {
        batch.update(doc(db, "tags", id), { rn: digits });
      });
      await batch.commit();

      setRows((prev) => prev.map((row) => (selectedIds.includes(row.id) ? { ...row, rn: digits } : row)));
      setSelected({});
      setNewRn("");
      setMessage(`Updated ${selectedIds.length} record(s).`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Bulk update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGate
      title="RN bulk edit"
      description="Select multiple records and apply one RN value in a single Firestore batch write."
    >
      <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin bulk tools</p>
          <h1 className="text-3xl font-semibold">RN bulk edit</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Select multiple records and apply one RN value in a single Firestore batch write.
          </p>
        </div>
        <Link href="/tools/rn-audit" className="text-sm underline">← Back to RN audit</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] rounded-2xl border border-white/10 bg-white/5 p-4">
        <input
          type="search"
          aria-label="Search records"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand, product, RN, style number..."
          className="rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
        />
        <input
          aria-label="New RN"
          value={newRn}
          onChange={(e) => setNewRn(e.target.value)}
          placeholder="New RN"
          className="rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
        />
        <button onClick={applyRn} disabled={busy || loading} className="rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50">
          {busy ? "Applying…" : "Apply RN"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-sm">
          <thead className="bg-black/20 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">Pick</th>
              <th className="px-4 py-3 text-left">Brand</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">RN</th>
              <th className="px-4 py-3 text-left">Style</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={!!selected[row.id]} onChange={(e) => setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))} className="accent-emerald-400" />
                </td>
                <td className="px-4 py-3">{row.brand || "—"}</td>
                <td className="px-4 py-3">{row.productName || "—"}</td>
                <td className="px-4 py-3">{row.rn || "—"}</td>
                <td className="px-4 py-3">{row.styleNumber || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
      </main>
    </AdminGate>
  );
}
