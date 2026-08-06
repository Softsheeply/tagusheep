"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  isFavorite,
  toggleFavorite,
  type FavoriteSnapshot,
} from "@/lib/favorites";

type SaveButtonProps = {
  tag: FavoriteSnapshot;
  className?: string;
  /** Compact icon-only control for cards */
  compact?: boolean;
};

export default function SaveButton({ tag, className = "", compact = false }: SaveButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUid(user?.uid ?? null);
      if (!user) {
        setSaved(false);
        return;
      }
      try {
        setSaved(await isFavorite(user.uid, tag.tagId));
      } catch {
        setSaved(false);
      }
    });
    return () => unsub();
  }, [tag.tagId]);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    if (!uid) {
      const next = pathname && pathname !== "/signin" ? pathname : `/tag/${tag.tagId}`;
      router.push(`/signin?next=${encodeURIComponent(next)}`);
      return;
    }

    setBusy(true);
    setHint(null);
    try {
      const result = await toggleFavorite(tag);
      setSaved(result === "saved");
      setHint(result === "saved" ? "Saved" : "Removed");
      window.setTimeout(() => setHint(null), 1400);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not save.";
      if (message === "SIGN_IN_REQUIRED") {
        router.push(`/signin?next=${encodeURIComponent(`/tag/${tag.tagId}`)}`);
      } else {
        setHint(message);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? "Saved" : "Save";
  const title = uid ? (saved ? "Remove from favorites" : "Save for later") : "Sign in to save favorites";

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={title}
        aria-label={title}
        aria-pressed={saved}
        className={`rounded bg-black/55 px-2 py-1 text-xs backdrop-blur transition hover:bg-black/70 disabled:opacity-50 ${
          saved ? "text-emerald-300" : "text-white"
        } ${className}`}
      >
        {saved ? "★ Saved" : "☆ Save"}
      </button>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title={title}
        aria-pressed={saved}
        className={`inline-flex items-center gap-2 border px-4 py-2 text-sm transition disabled:opacity-50 ${
          saved
            ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/20"
            : "border-white/20 bg-white/5 text-white hover:border-emerald-300/40 hover:bg-white/8"
        }`}
      >
        <span aria-hidden>{saved ? "★" : "☆"}</span>
        {busy ? "…" : label}
      </button>
      {hint && <span className="text-xs text-white/55">{hint}</span>}
      {!uid && <span className="text-xs text-white/45">Sign in to keep favorites</span>}
    </div>
  );
}
