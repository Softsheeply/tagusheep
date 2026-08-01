"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CATEGORY_OPTIONS, suggestCategory } from "@/lib/records";

type AuditRecord = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  garmentType?: string | null;
  category?: string | null;
  imageUrl?: string | null;
};

export default function CategoryAuditPage() {
  const [rows, setRows] = useState<AuditRecord[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qRef);
        // Firestore can't cleanly query "field missing or empty" -- prepareRecord
        // omits the key entirely rather than writing an empty string, so this
        // filters client-side the same way /tools/rn-audit does.
        const blank = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditRecord, "id">) }))
          .filter((row) => !row.category || !row.category.trim());
        setRows(blank);
        setPicks(
          Object.fromEntries(
            blank.map((row) => [row.id, suggestCategory(row.garmentType, row.productName) || ""])
          )
        );
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.brand ?? "", row.productName ?? "", row.garmentType ?? ""].join(" ").toLowerCase().includes(q));
  }, [rows, search]);

  async function saveCategory(row: AuditRecord) {
    const value = picks[row.id]?.trim();
    if (!value) {
      setMessage("Pick a category first.");
      return;
    }
    setBusyId(row.id);
    setMessage(null);
    try {
      await updateDoc(doc(db, "tags", row.id), { category: value });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setMessage(`Set "${row.brand || row.productName || row.id}" to ${value}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminGate
      title="Category audit"
      description="Find every record missing a category and assign one from the fixed list, one click at a time."
    >
      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin audit</p>
            <h1 className="text-3xl font-semibold">Category audit</h1>
            <p className="mt-2 max-w-2xl text-white/70">
              Records with no category, so you can work through the backlog. Suggestions are pre-filled where the garment
              type or product name gives a strong hint -- double-check before saving.
            </p>
          </div>
          <Link href="/tools" className="text-sm underline">← Back to tools</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Missing category" value={loading ? "…" : String(rows.length)} />
          <StatCard label="Showing" value={loading ? "…" : String(filtered.length)} />
          <div className="flex items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter brand, product, garment type…"
              className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
            />
          </div>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
            Couldn&apos;t load records. Check your connection and try refreshing.
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Nothing missing a category{search ? " matching that filter" : ""} — you&apos;re caught up.
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((row) => (
            <div key={row.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[64px_1fr_220px_auto] sm:items-center">
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.imageUrl} alt="" className="h-16 w-16 rounded-xl border border-white/10 object-cover bg-white" />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-dashed border-white/15" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-white">{row.brand || "Unknown brand"} — {row.productName || "No product name"}</div>
                <div className="truncate text-sm text-white/50">{row.garmentType ? `Garment type: ${row.garmentType}` : "No garment type on file"}</div>
              </div>
              <select
                value={picks[row.id] ?? ""}
                onChange={(e) => setPicks((prev) => ({ ...prev, [row.id]: e.target.value }))}
                className="rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white outline-none transition focus:border-emerald-300/60"
              >
                <option value="">— pick category —</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => saveCategory(row)}
                  disabled={busyId === row.id || !picks[row.id]}
                  className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
                >
                  {busyId === row.id ? "Saving…" : "Save"}
                </button>
                <Link href={`/tag/${row.id}`} target="_blank" className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70 hover:text-white">
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>

        {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
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
