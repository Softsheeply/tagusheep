"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { collection, deleteDoc, doc, getDocs, orderBy, query, limit as qlimit } from "firebase/firestore";
import { db } from "@/lib/firebase";

type MissDoc = {
  id: string;
  query?: string | null;
  count?: number | null;
  lastSearchedAt?: unknown;
};

export default function WantedPage() {
  const [rows, setRows] = useState<MissDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "search_misses"), orderBy("count", "desc"), qlimit(200));
        const snap = await getDocs(qRef);
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MissDoc, "id">) })));
      } catch {
        setMessage("Couldn't load search misses. Check your connection and try refreshing.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function dismiss(id: string) {
    setBusyId(id);
    try {
      await deleteDoc(doc(db, "search_misses", id));
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch {
      setMessage("Couldn't remove that entry.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminGate
      title="Most wanted"
      description="Searches that came up empty -- what people are looking for that Tagsheep doesn't have yet."
    >
      <main className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
            <h1 className="text-3xl font-semibold">Most wanted</h1>
            <p className="mt-2 max-w-2xl text-white/70">
              Signed-in searches on /tags that returned nothing, ranked by how often they repeat. A good source list for what to import or ask contributors for next.
            </p>
          </div>
          <Link href="/tools" className="text-sm underline">← Back to tools</Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            No zero-result searches logged yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-sm">
              <thead className="bg-black/20 text-white/70">
                <tr>
                  <th className="px-4 py-3 text-left">Query</th>
                  <th className="px-4 py-3 text-left">Times searched</th>
                  <th className="px-4 py-3 text-left">Submit</th>
                  <th className="px-4 py-3 text-left">Dismiss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-4 py-3">{row.query || row.id}</td>
                    <td className="px-4 py-3">{row.count ?? 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/upload?${new URLSearchParams({ brand: row.query || "" }).toString()}`}
                        className="underline"
                      >
                        Upload this
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => dismiss(row.id)}
                        disabled={busyId === row.id}
                        className="rounded-xl border border-white/20 px-3 py-1 text-white/80 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
      </main>
    </AdminGate>
  );
}
