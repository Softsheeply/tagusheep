"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type AdminGateProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export default function AdminGate({ title, description, children }: AdminGateProps) {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        if (!cancelled) {
          setSignedIn(false);
          setAdmin(false);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) setSignedIn(true);

      try {
        const snap = await getDoc(doc(db, "admins", uid));
        if (!cancelled) {
          setAdmin(snap.exists());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-white/70 mt-2 max-w-2xl">Checking access…</p>
        </div>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="mx-auto max-w-4xl p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-white/70 mt-2 max-w-2xl">{description}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/75">
          Please sign in first. These tools are admin-only right now.
          <div className="mt-3">
            <Link href="/tags" className="text-sm underline">← Back to database</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className="mx-auto max-w-4xl p-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-white/70 mt-2 max-w-2xl">{description}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/75">
          These tools are locked to admins for now while Tagsheep is still in controlled beta.
          <div className="mt-3">
            <Link href="/tags" className="text-sm underline">← Back to database</Link>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
