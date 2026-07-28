"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import SmartImage from "@/app/components/SmartImage";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit as qlimit, onSnapshot, startAfter, getDocs, getCountFromServer, type DocumentSnapshot, type DocumentData } from "firebase/firestore";
import { normalizeStyleNumber } from "@/lib/records";

type TagDoc = {
  id: string;
  brand?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  productName?: string | null;
  color?: string | null;
  size?: string | null;
  availableSizes?: string[];
  verificationStatus?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export default function StyleClient() {
  const params = useParams<{ value: string }>();
  const raw = params?.value ?? "";
  const styleValue = normalizeStyleNumber(decodeURIComponent(Array.isArray(raw) ? raw[0] : raw)) || "";

  const [docs, setDocs] = useState<TagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [lastSnap, setLastSnap] = useState<DocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const perPage = 60;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), where("styleNumber", "==", styleValue));
        const agg = await getCountFromServer(qRef);
        setCount(agg.data().count);
      } catch {
        setCount(null);
      }
    })();
  }, [styleValue]);

  useEffect(() => {
    const qRef = query(collection(db, "tags"), where("styleNumber", "==", styleValue), orderBy("createdAt", "desc"), qlimit(perPage));
    const off = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) }));
        setDocs(rows);
        setLoading(false);
        setLoadError(false);
        setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
        setExhausted(snap.size < perPage);
      },
      () => {
        setLoading(false);
        setLoadError(true);
      }
    );
    return () => off();
  }, [styleValue]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || exhausted || !lastSnap) return;
      setLoadingMore(true);
      const qRef = query(collection(db, "tags"), where("styleNumber", "==", styleValue), orderBy("createdAt", "desc"), startAfter(lastSnap), qlimit(perPage));
      const snap = await getDocs(qRef);
      const more = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) }));
      setDocs((prev) => [...prev, ...more]);
      setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.size < perPage);
      setLoadingMore(false);
    }, { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, [styleValue, lastSnap, loadingMore, exhausted]);

  const title = useMemo(() => styleValue || "Unknown style", [styleValue]);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Style number index</p>
          <h1 className="text-2xl font-semibold">Style: {title}</h1>
          <p className="text-sm text-white/70">{count == null ? "Counting…" : `${count} matching record${count === 1 ? "" : "s"}`}</p>
        </div>
        <Link href="/tags" className="text-sm underline">← Back to database</Link>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : loadError ? (
        <div className="mt-8 space-y-4 text-center">
          <p className="text-white/60">Couldn&apos;t load records. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
          >
            Retry
          </button>
        </div>
      ) : docs.length === 0 ? (
        <p className="mt-6 text-white/80">No records for this style number yet.</p>
      ) : (
        <>
          <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:balance]">
            {docs.map((d) => (
              <div key={d.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <Link href={`/tag/${d.id}`} className="block">
                  <div className="relative aspect-[4/5] bg-white overflow-hidden">
                    <SmartImage src={d.thumbnailUrl || d.imageUrl} alt={d.brand ?? "tag"} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-contain" />
                  </div>
                </Link>
                <div className="p-3 text-sm space-y-1">
                  <div className="font-medium text-white truncate">{d.brand || "Unknown brand"}</div>
                  <div className="text-white/70 truncate">{d.productName || "—"}</div>
                  <div className="text-white/70">RN: {d.rn || "—"}</div>
                  <div className="text-white/70">Color: {d.color || "—"}</div>
                  <div className="text-white/70">Size: {d.size || ((d.availableSizes || []).length ? d.availableSizes?.join(", ") : "—")}</div>
                  <div className="text-white/50 text-xs uppercase tracking-wide">{d.verificationStatus || "pending"}</div>
                </div>
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

function SkeletonGrid() {
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
