"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { auth, db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  setDoc,
  deleteDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";

type TrashDoc = {
  id: string;
  // original tag fields
  brand?: string | null;
  rn?: string | null;
  imageUrl: string;
  storagePath?: string | null;
  createdBy?: string | null;
  createdAt?: unknown;

  // trash metadata
  originalId?: string | null;
  trashedAt?: string | null;
  trashedBy?: string | null;
};

export default function TrashPage() {
  const [docs, setDocs] = useState<TrashDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastSnap, setLastSnap] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const [admin, setAdmin] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // check auth + admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdmin(false);
        setAuthResolved(true);
        setLoading(false);
        return;
      }

      setAuthResolved(true);
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        setAdmin(snap.exists());
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // initial live page
  useEffect(() => {
    if (!authResolved || !admin) return;

    const qRef = query(
      collection(db, "trash"),
      orderBy("trashedAt", "desc"),
      limit(60)
    );
    const off = onSnapshot(
      qRef,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrashDoc, "id">) })));
        setLoading(false);
        setLoadError(false);
        setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
        setExhausted(snap.size < 60);
      },
      () => {
        setLoading(false);
        setLoadError(true);
      }
    );
    return () => off();
  }, [authResolved, admin]);

  // infinite scroll
  useEffect(() => {
    if (!authResolved || !admin || !loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const io = new IntersectionObserver(async (entries) => {
      const [e] = entries;
      if (!e.isIntersecting || loadingMore || exhausted || !lastSnap) return;
      setLoadingMore(true);
      const qRef = query(
        collection(db, "trash"),
        orderBy("trashedAt", "desc"),
        startAfter(lastSnap),
        limit(60)
      );
      const snap = await getDocs(qRef);
      const more = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrashDoc, "id">) }));
      setDocs((prev) => [...prev, ...more]);
      setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.size < 60);
      setLoadingMore(false);
    }, { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, [authResolved, admin, lastSnap, loadingMore, exhausted]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return docs;
    return docs.filter((d) =>
      `${d.brand ?? ""} ${d.rn ?? ""}`.toLowerCase().includes(t)
    );
  }, [docs, q]);

  async function restore(d: TrashDoc) {
    // NOTE: Requires admin-create allowed in /tags rules (recommended).
    if (!admin) {
      alert("Restore is limited to admins.");
      return;
    }
    if (busyId) return;

    try {
      setBusyId(d.id);
      const payload = {
        brand: d.brand ?? null,
        rn: d.rn ?? null,
        imageUrl: d.imageUrl,
        storagePath: d.storagePath ?? null,
        createdBy: d.createdBy ?? null,
        createdAt: d.createdAt ?? null,
      };
      await setDoc(doc(db, "tags", d.id), payload, { merge: false });
      await deleteDoc(doc(db, "trash", d.id));
    } catch (e: unknown) {
      alert("Restore failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  async function purge(d: TrashDoc) {
    if (!admin) {
      alert("Purge is limited to admins.");
      return;
    }
    if (!confirm("Permanently delete this item (and image if present)?")) return;
    if (busyId) return;

    try {
      setBusyId(d.id);
      // delete image in Storage (best-effort)
      if (d.storagePath) {
        try {
          await deleteObject(ref(storage, d.storagePath));
        } catch {
          // ignore storage errors to ensure Firestore purge proceeds
        }
      }
      await deleteDoc(doc(db, "trash", d.id));
    } catch (e: unknown) {
      alert("Purge failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminGate
      title="Trash"
      description="Soft-deleted tags. Admins can restore or permanently purge records."
    >
      <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Trash</h1>
          <p className="text-white/70 text-sm">
            Soft-deleted tags. Admins can restore or permanently purge.
          </p>
        </div>
        <Link href="/tags" className="text-sm underline">
          ← Back to Tags
        </Link>
      </div>

      <div className="mt-3">
        <input
          type="search"
          aria-label="Search trash"
          className="w-full border rounded p-2 text-black"
          placeholder="Search brand or RN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : loadError ? (
        <div className="mt-8 space-y-4 text-center">
          <p className="text-white/60">Couldn&apos;t load trash. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-white/80">Trash is empty.</p>
      ) : (
        <>
          {/* Masonry-like grid via CSS columns */}
          <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:balance]">
            {filtered.map((d) => (
              <div
                key={d.id}
                className="mb-4 break-inside-avoid relative group border border-white/10 rounded overflow-hidden bg-white/5"
              >
                {d.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.imageUrl}
                      alt={d.brand ?? "tag"}
                      loading="lazy"
                      className="w-full h-auto object-cover"
                    />
                  </>
                ) : (
                  <div className="flex h-56 items-center justify-center bg-white/5 text-sm text-white/40">
                    No image saved
                  </div>
                )}
                <div className="p-2 text-sm">
                  <div className="font-medium truncate">{d.brand || "—"}</div>
                  <div className="text-white/70">RN: {d.rn || "—"}</div>
                  <div className="text-white/50 text-xs mt-1">
                    Trashed: {d.trashedAt ? new Date(d.trashedAt).toLocaleString() : "—"}
                  </div>
                </div>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    disabled={!admin || busyId === d.id}
                    onClick={() => restore(d)}
                    className="px-2 py-1 text-xs rounded bg-emerald-500/90 text-black hover:bg-emerald-400 disabled:opacity-50"
                    title={admin ? "Restore to Tags" : "Admins only"}
                  >
                    {busyId === d.id ? "…" : "Restore"}
                  </button>
                  <button
                    disabled={!admin || busyId === d.id}
                    onClick={() => purge(d)}
                    className="px-2 py-1 text-xs rounded border border-rose-400 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                    title={admin ? "Permanently delete" : "Admins only"}
                  >
                    Purge
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div ref={loadMoreRef} className="h-12 flex items-center justify-center">
            {loadingMore && (
              <span className="text-sm text-white/70">Loading more…</span>
            )}
            {exhausted && (
              <span className="text-sm text-white/50">End of results</span>
            )}
          </div>
        </>
      )}
      </main>
    </AdminGate>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="mb-4 break-inside-avoid rounded overflow-hidden border border-white/10 bg-white/5"
        >
          <div className="h-56 animate-pulse bg-white/10" />
          <div className="p-2 space-y-2">
            <div className="h-3 w-1/2 bg-white/10 rounded" />
            <div className="h-3 w-1/3 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
