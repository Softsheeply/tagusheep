"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import SmartImage from "@/app/components/SmartImage";
import SaveButton from "@/app/components/SaveButton";
import { auth } from "@/lib/firebase";
import { listFavorites, removeFavorite, type FavoriteRecord } from "@/lib/favorites";

export default function FavoritesPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [items, setItems] = useState<FavoriteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load(uid: string) {
      setLoading(true);
      try {
        const rows = await listFavorites(uid);
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    void load(user.uid);
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onRemove(tagId: string) {
    if (!user || busyId) return;
    setBusyId(tagId);
    try {
      await removeFavorite(user.uid, tagId);
      setItems((prev) => prev.filter((item) => item.tagId !== tagId));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Come back later</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-white sm:text-4xl">
          Your favorites
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
          Save clothing records while you browse. Sign in once — your list stays here when you return.
        </p>
      </div>

      {!user ? (
        <div className="border border-amber-300/20 bg-amber-400/10 px-5 py-5">
          <div className="font-medium text-amber-100">Sign in to save favorites</div>
          <p className="mt-1 text-sm text-amber-100/75">
            Hit Save on any tag while browsing, then find everything here.
          </p>
          <Link href="/signin?next=/favorites" className="mt-4 inline-flex bg-emerald-400/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300">
            Sign in
          </Link>
        </div>
      ) : loading ? (
        <div className="border border-white/10 bg-white/5 px-5 py-8 text-white/65">Loading favorites…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-white/15 bg-white/[0.03] px-5 py-12 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl text-white">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
            Browse the archive and tap Save on tags you want to revisit.
          </p>
          <Link href="/tags" className="mt-6 inline-flex bg-emerald-400/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300">
            Browse tags
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const photo = item.thumbnailUrl || item.imageUrl;
            return (
              <div key={item.tagId} className="group relative">
                <Link href={`/tag/${item.tagId}`} className="relative block aspect-[3/4] overflow-hidden bg-white/5">
                  {photo ? (
                    <SmartImage
                      src={photo}
                      alt={item.brand || "Saved tag"}
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">No photo</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-14">
                    <div className="truncate text-sm font-medium text-white">{item.brand || "Unknown brand"}</div>
                    <div className="truncate text-xs text-white/65">
                      {item.styleNumber ? `Style ${item.styleNumber}` : item.rn ? `RN ${item.rn}` : item.productName || "View record"}
                    </div>
                  </div>
                </Link>
                <div className="absolute right-2 top-2 flex gap-1">
                  <SaveButton
                    compact
                    tag={{
                      tagId: item.tagId,
                      brand: item.brand,
                      productName: item.productName,
                      rn: item.rn,
                      styleNumber: item.styleNumber,
                      imageUrl: item.imageUrl,
                      thumbnailUrl: item.thumbnailUrl,
                    }}
                  />
                  <button
                    type="button"
                    disabled={busyId === item.tagId}
                    onClick={() => onRemove(item.tagId)}
                    className="rounded bg-black/55 px-2 py-1 text-xs text-white/80 backdrop-blur hover:bg-black/70 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
