"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit as qlimit,
  onSnapshot,
  startAfter,
  getDocs,
  getCountFromServer,
  type DocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";

type TagDoc = {
  id: string;
  brand?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  notes?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  createdBy?: string | null;
};

export default function BrandPage() {
  const params = useParams<{ name: string }>();
  const raw = params?.name ?? "";
  const brand = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw);

  const [docs, setDocs] = useState<TagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [lastSnap, setLastSnap] = useState<DocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [styleFilter, setStyleFilter] = useState("");

  const perPage = 60;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), where("brand", "==", brand));
        const agg = await getCountFromServer(qRef);
        setCount(agg.data().count);
      } catch {
        setCount(null);
      }
    })();
  }, [brand]);

  useEffect(() => {
    const qRef = query(
      collection(db, "tags"),
      where("brand", "==", brand),
      orderBy("createdAt", "desc"),
      qlimit(perPage)
    );
    const off = onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) }));
      setDocs(rows);
      setLoading(false);
      setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.size < perPage);
    });
    return () => off();
  }, [brand]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || loadingMore || exhausted || !lastSnap) return;
        setLoadingMore(true);
        const qRef = query(
          collection(db, "tags"),
          where("brand", "==", brand),
          orderBy("createdAt", "desc"),
          startAfter(lastSnap),
          qlimit(perPage)
        );
        const snap = await getDocs(qRef);
        const more = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) }));
        setDocs((prev) => [...prev, ...more]);
        setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
        setExhausted(snap.size < perPage);
        setLoadingMore(false);
      },
      { rootMargin: "500px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [brand, lastSnap, loadingMore, exhausted]);

  const filtered = useMemo(() => {
    const t = styleFilter.trim().toLowerCase();
    if (!t) return docs;
    return docs.filter((d) => [d.styleNumber ?? "", d.rn ?? "", d.notes ?? ""].join(" ").toLowerCase().includes(t));
  }, [docs, styleFilter]);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Brand index</p>
          <h1 className="text-2xl font-semibold">{brand}</h1>
          <p className="text-sm text-white/70">
            {count == null ? "Counting…" : `${count} record${count === 1 ? "" : "s"} in Tagsheep`}
          </p>
        </div>
        <Link href="/tags" className="text-sm underline">← Back to database</Link>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/76">
        Search within this brand by style number, RN, or notes. This is where Tagsheep starts feeling like a real clothing database instead of just a loose gallery.
      </div>

      <div className="mt-4">
        <input
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value)}
          placeholder={`Filter ${brand} by style number, RN, or notes…`}
          className="w-full rounded-xl border border-white/12 bg-[#09111f] p-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
        />
      </div>

      {loading ? (
        <SkeletonMasonry />
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-white/80">No records for this brand yet.</p>
      ) : (
        <>
          <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:balance]">
            {filtered.map((d) => <Card key={d.id} d={d} />)}
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

function Card({ d }: { d: TagDoc }) {
  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:shadow-md">
      <Link href={`/tag/${d.id}`} className="block">
        <div className="aspect-[4/5] bg-white overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.thumbnailUrl || d.imageUrl} alt={d.brand ?? "tag"} loading="lazy" className="h-full w-full object-contain" />
        </div>
      </Link>
      <div className="p-3 text-sm">
        <div className="font-medium text-white truncate">{d.brand || "—"}</div>
        <div className="text-white/70">RN: {d.rn || "—"}</div>
        <div className="text-white/70">Style: {d.styleNumber || "—"}</div>
      </div>
    </div>
  );
}

function SkeletonMasonry() {
  return (
    <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="mb-4 break-inside-avoid rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <div className="aspect-[4/5] animate-pulse bg-white/10" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/2 bg-white/10 rounded" />
            <div className="h-3 w-1/3 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
