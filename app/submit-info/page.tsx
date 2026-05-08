"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SubmitInfoPage() {
  return (
    <Suspense fallback={<SubmitInfoFallback />}>
      <SubmitInfoInner />
    </Suspense>
  );
}

function SubmitInfoInner() {
  const searchParams = useSearchParams();
  const tagId = searchParams.get("tag") || "";
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const canSubmit = useMemo(() => details.trim().length > 0, [details]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addDoc(collection(db, "submissions"), {
        productRef: tagId || null,
        details: details.trim(),
        contact: contact.trim() || null,
        submittedBy: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        status: "pending_review",
      });
      setDetails("");
      setContact("");
      setStatus("Thanks — info submitted for review.");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Submission failed.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Community contribution</p>
        <h1 className="text-3xl font-semibold">Submit product info</h1>
        <p className="mt-2 text-white/70 max-w-2xl">
          Have better details on this product? Send what you know and it can be reviewed before being added to the record.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        {tagId && <div className="text-sm text-white/60">Related record: <code>{tagId}</code></div>}
        <label className="block space-y-2">
          <span className="text-sm text-white/80">What should be added or corrected?</span>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={8} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" placeholder="Style number, garment type, materials, era, brand info, label text, anything useful..." />
        </label>
        <label className="block space-y-2">
          <span className="text-sm text-white/80">Contact (optional)</span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" placeholder="Email or note for follow-up" />
        </label>
        <div className="flex gap-3">
          <button type="submit" disabled={!canSubmit} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black disabled:opacity-50">Submit info</button>
          <Link href={tagId ? `/tag/${tagId}` : "/tags"} className="rounded-xl border border-white/15 px-4 py-2 text-white">{tagId ? "Back to tag" : "Browse tags"}</Link>
        </div>
      </form>

      {status && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{status}</div>}
    </main>
  );
}

function SubmitInfoFallback() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Community contribution</p>
        <h1 className="text-3xl font-semibold">Submit product info</h1>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Loading submission form…</div>
    </main>
  );
}
