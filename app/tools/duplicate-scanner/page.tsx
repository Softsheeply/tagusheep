"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeBrand, normalizeRn, normalizeStyleNumber } from "@/lib/records";

type ScanRecord = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  styleNumber?: string | null;
  rn?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  verificationStatus?: string | null;
};

type Cluster = { key: string; reason: string; rows: ScanRecord[] };

// Union-find over shared keys (brand+style, or RN alone) so a chain of
// records that overlap pairwise -- A matches B on RN, B matches C on
// brand+style -- end up in one cluster instead of two separate pairs.
function buildClusters(rows: ScanRecord[]): Cluster[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const byBrandStyle = new Map<string, string[]>();
  const byRn = new Map<string, string[]>();

  for (const row of rows) {
    find(row.id);
    const brand = normalizeBrand(row.brand);
    const style = normalizeStyleNumber(row.styleNumber);
    const rn = normalizeRn(row.rn);
    if (brand && style) {
      const key = `${brand}::${style}`;
      byBrandStyle.set(key, [...(byBrandStyle.get(key) || []), row.id]);
    }
    if (rn) {
      byRn.set(rn, [...(byRn.get(rn) || []), row.id]);
    }
  }

  const reasonById = new Map<string, Set<string>>();
  const addReason = (id: string, reason: string) => {
    if (!reasonById.has(id)) reasonById.set(id, new Set());
    reasonById.get(id)!.add(reason);
  };

  for (const ids of byBrandStyle.values()) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
    ids.forEach((id) => addReason(id, "brand + style number"));
  }
  for (const ids of byRn.values()) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
    ids.forEach((id) => addReason(id, "RN"));
  }

  const groups = new Map<string, ScanRecord[]>();
  for (const row of rows) {
    const root = find(row.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(row);
  }

  const clusters: Cluster[] = [];
  for (const [root, groupRows] of groups.entries()) {
    if (groupRows.length < 2) continue;
    const reasons = new Set<string>();
    groupRows.forEach((row) => (reasonById.get(row.id) || new Set()).forEach((r) => reasons.add(r)));
    clusters.push({ key: root, reason: [...reasons].join(" / ") || "match", rows: groupRows });
  }
  return clusters.sort((a, b) => b.rows.length - a.rows.length);
}

export default function DuplicateScannerPage() {
  const [rows, setRows] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qRef);
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScanRecord, "id">) })));
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clusters = useMemo(() => buildClusters(rows), [rows]);

  const filteredClusters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clusters;
    return clusters.filter((cluster) =>
      cluster.rows.some((row) => [row.brand ?? "", row.productName ?? "", row.styleNumber ?? "", row.rn ?? ""].join(" ").toLowerCase().includes(q))
    );
  }, [clusters, search]);

  return (
    <AdminGate
      title="Duplicate scanner"
      description="Find live records that share a brand + style number or an RN, so the weaker one can be merged or trashed."
    >
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin audit</p>
            <h1 className="text-3xl font-semibold">Duplicate scanner</h1>
            <p className="mt-2 max-w-2xl text-white/70">
              Groups live records that share a brand + style number or an RN. This only detects and displays clusters --
              open a record to edit, merge photos in manually, or move the weaker one to Trash from its own page.
            </p>
          </div>
          <Link href="/tools" className="text-sm underline">← Back to tools</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total records scanned" value={loading ? "…" : String(rows.length)} />
          <StatCard label="Duplicate clusters" value={loading ? "…" : String(clusters.length)} />
          <div className="flex items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter brand, product, RN, style…"
              className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
            />
          </div>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
            Couldn&apos;t load records. Check your connection and try refreshing.
          </div>
        )}

        {!loading && !loadError && filteredClusters.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            No duplicate clusters found{search ? " matching that filter" : ""}.
          </div>
        )}

        <div className="space-y-4">
          {filteredClusters.map((cluster) => (
            <div key={cluster.key} className="rounded-2xl border border-amber-300/25 bg-amber-400/5 p-4 space-y-3">
              <div className="text-sm text-amber-200">Matched by {cluster.reason} — {cluster.rows.length} records</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cluster.rows.map((row) => (
                  <Link
                    key={row.id}
                    href={`/tag/${row.id}`}
                    target="_blank"
                    className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-emerald-300/40"
                  >
                    {row.imageUrl || row.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.thumbnailUrl || row.imageUrl || ""} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-white/10 bg-white object-contain" />
                    ) : (
                      <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-white/15" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{row.brand || "Unknown"} — {row.productName || "No name"}</div>
                      <div className="text-xs text-white/50">Style: {row.styleNumber || "—"} · RN: {row.rn || "—"}</div>
                      <div className="text-xs text-white/40">{row.verificationStatus || "pending"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
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
