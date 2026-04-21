"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, limit, startAfter, getDocs, getDoc, doc, setDoc, deleteDoc } from "firebase/firestore";

type TagDoc = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  category?: string | null;
  year?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  verificationStatus?: string | null;
  notes?: string | null;
  imageUrl: string;
  storagePath?: string | null;
  createdBy?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function TagsPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [docs, setDocs] = useState<TagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSnap, setLastSnap] = useState<any>(null);
  const [q, setQ] = useState(initialQ);
  const [onlyWithRN, setOnlyWithRN] = useState(false);
  const [onlyWithStyle, setOnlyWithStyle] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [admin, setAdmin] = useState(false);
  const me = auth.currentUser?.uid ?? null;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "admins", uid)).then((s) => setAdmin(s.exists()));
  }, []);

  useEffect(() => {
    const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(60));
    const off = onSnapshot(qRef, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
      setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.size < 60);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const io = new IntersectionObserver(async (entries) => {
      const [e] = entries;
      if (!e.isIntersecting || loadingMore || exhausted || !lastSnap) return;
      setLoadingMore(true);
      const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), startAfter(lastSnap), limit(60));
      const snap = await getDocs(qRef);
      const more = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setDocs((prev) => [...prev, ...more]);
      setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.size < 60);
      setLoadingMore(false);
    }, { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lastSnap, loadingMore, exhausted]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return docs.filter((d) => {
      const haystack = [d.brand ?? "", d.productName ?? "", d.rn ?? "", d.styleNumber ?? "", d.category ?? "", d.year ?? "", d.sourceName ?? "", d.notes ?? ""]
        .join(" ")
        .toLowerCase();
      const matchText = t ? haystack.includes(t) : true;
      const matchRN = onlyWithRN ? !!d.rn && d.rn.trim().length > 0 : true;
      const matchStyle = onlyWithStyle ? !!d.styleNumber && d.styleNumber.trim().length > 0 : true;
      const matchVerified = verifiedOnly ? d.verificationStatus === "verified" || d.verificationStatus === "reviewed" : true;
      return matchText && matchRN && matchStyle && matchVerified;
    });
  }, [docs, q, onlyWithRN, onlyWithStyle, verifiedOnly]);

  async function moveToTrash(d: TagDoc) {
    if (busyId) return;
    if (!admin && me !== d.createdBy) return;
    if (!confirm("Move this record to Trash?")) return;

    try {
      setBusyId(d.id);
      const trashDoc = { ...d, originalId: d.id, trashedAt: new Date().toISOString(), trashedBy: me };
      await setDoc(doc(db, "trash", d.id), trashDoc);
      await deleteDoc(doc(db, "tags", d.id));
    } catch (e) {
      alert("Error: " + ((e as any)?.message || String(e)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">TaguSheep database</p>
          <h1 className="text-2xl font-semibold">Search clothing records</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/import" className="underline opacity-80 hover:opacity-100">Import URL</Link>
          <Link href="/trash" className="underline opacity-80 hover:opacity-100">Trash</Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
        <input className="w-full rounded-xl border border-white/12 bg-[#09111f] p-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60" placeholder="Search brand, product name, RN, style number, category, year, source..." value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/78">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={onlyWithRN} onChange={(e) => setOnlyWithRN(e.target.checked)} />Only with RN</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={onlyWithStyle} onChange={(e) => setOnlyWithStyle(e.target.checked)} />Only with style number</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />Reviewed / verified only</label>
          <span className="text-white/50">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {loading ? (
        <SkeletonMasonry />
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-white/80">No records found.</p>
      ) : (
        <>
          <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:balance]">
            {filtered.map((d) => (
              <div key={d.id} className="group relative mb-4 break-inside-avoid">
                <Link href={`/tag/${d.id}`} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:shadow-md">
                  <div className="aspect-[4/5] bg-white overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.imageUrl} alt={d.brand ?? "tag"} loading="lazy" className="h-full w-full object-contain" />
                  </div>
                  <div className="space-y-1 p-3 text-sm">
                    <div className="font-medium truncate text-white">{d.brand || "Unknown brand"}</div>
                    <div className="truncate text-white/78">{d.productName || "—"}</div>
                    <div className="text-white/70">RN: {d.rn || "—"}</div>
                    <div className="text-white/70">Style: {d.styleNumber || "—"}</div>
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px] uppercase tracking-wide">
                      <Badge>{d.verificationStatus || "pending"}</Badge>
                      {d.sourceType && <Badge subtle>{d.sourceType}</Badge>}
                    </div>
                  </div>
                </Link>

                {(admin || me === d.createdBy) && (
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <Link href={`/tag/${d.id}`} className="rounded bg-emerald-500/90 px-2 py-1 text-xs text-black hover:bg-emerald-400">Edit</Link>
                    <button disabled={busyId === d.id} onClick={() => moveToTrash(d)} className="rounded border border-amber-400 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50" title="Move to Trash">
                      {busyId === d.id ? "…" : "Trash"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div ref={loadMoreRef} className="h-12 flex items-center justify-center">
            {loadingMore && <span className="text-sm text-white/70">Loading more…</span>}
            {exhausted && <span className="text-sm text-white/50">End of results</span>}
          </div>
        </>
      )}
    </main>
  );
}

function Badge({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className={`rounded-full border px-2 py-0.5 ${subtle ? "border-white/15 text-white/55" : "border-emerald-300/35 text-emerald-200"}`}>{children}</span>;
}

function SkeletonMasonry() {
  return (
    <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="aspect-[4/5] animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-3 w-1/4 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
