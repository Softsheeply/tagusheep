"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AdminTestPage() {
  const [result, setResult] = useState("Checking…");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setResult("No signed-in user.");
        return;
      }

      const uid = user.uid;
      try {
        const snap = await getDoc(doc(db, "admins", uid));
        setResult([
          `uid=${uid}`,
          `signedIn=yes`,
          `adminDocExists=${snap.exists() ? "yes" : "no"}`,
        ].join("\n"));
      } catch (error: unknown) {
        const err = error as { message?: string };
        setResult([
          `uid=${uid}`,
          `signedIn=yes`,
          `error=${err?.message || String(error)}`,
        ].join("\n"));
      }
    });

    return () => unsub();
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin diagnosis</p>
        <h1 className="text-3xl font-semibold">Admin test</h1>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85 whitespace-pre-wrap min-h-24">
        {result}
      </div>
    </main>
  );
}
