"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { uploadImageObject } from "@/lib/object-storage";

export default function StorageTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function runTest() {
    if (!file) {
      setResult("Choose a file first.");
      return;
    }

    const uid = auth.currentUser?.uid || "no-user";
    const path = `tagusheep/uploads/${uid}/storage-test-${Date.now()}-${file.name}`;

    setBusy(true);
    setResult([
      `uid=${uid}`,
      `provider=Cloudflare R2`,
      `projectId=${process.env.NEXT_PUBLIC_FB_PROJECT_ID || "unknown"}`,
      `path=${path}`,
      `fileName=${file.name}`,
      `fileType=${file.type || "unknown"}`,
      `fileSize=${file.size}`,
      `status=starting`,
    ].join("\n"));

    try {
      const { url } = await uploadImageObject(file, path);
      setResult([
        `uid=${uid}`,
        `provider=Cloudflare R2`,
        `projectId=${process.env.NEXT_PUBLIC_FB_PROJECT_ID || "unknown"}`,
        `path=${path}`,
        `status=success`,
        `downloadUrl=${url}`,
      ].join("\n"));
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      setResult([
        `uid=${uid}`,
        `bucket=${process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET || "unknown"}`,
        `projectId=${process.env.NEXT_PUBLIC_FB_PROJECT_ID || "unknown"}`,
        `path=${path}`,
        `status=error`,
        `code=${err?.code || "unknown"}`,
        `message=${err?.message || String(error)}`,
      ].join("\n"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Storage diagnosis</p>
        <h1 className="text-3xl font-semibold">Minimal Firebase Storage test</h1>
        <p className="mt-2 text-white/70">
          This page bypasses the Tagsheep upload form complexity and tests the authenticated Cloudflare R2 upload gateway directly.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full rounded border bg-white p-2 text-black" />
        <button onClick={runTest} disabled={!file || busy} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black disabled:opacity-50">
          {busy ? "Testing…" : "Run storage test"}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85 whitespace-pre-wrap min-h-32">
        {result || "No test run yet."}
      </div>
    </main>
  );
}
