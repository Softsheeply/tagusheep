"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, setPersistence, browserLocalPersistence, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { prepareRecord, type SourceType, type VerificationStatus } from "@/lib/records";
import AuthPanel from "@/app/components/AuthPanel";
import { safeHostnameFromUrl } from "@/lib/validation";
import { IMAGE_POLICY, normalizeThumbnailImage, normalizeUploadedImage } from "@/lib/images";

export default function MobileUploadPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [brand, setBrand] = useState("");
  const [styleNumber, setStyleNumber] = useState("");
  const [rn, setRn] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "info" | "success" | "error"; text: string | null; pct?: number }>({ kind: "idle", text: null });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const rnWarning = !rn
    ? null
    : !/^\d+$/.test(rn)
      ? "RN must be digits only."
      : rn.length < 3
        ? "RN looks too short."
        : rn.length > 7
          ? "RN looks too long."
          : null;

  function resetForm() {
    setBrand("");
    setStyleNumber("");
    setRn("");
    setGarmentType("");
    setNotes("");
    setSourceUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setStatus({ kind: "error", text: "Sign in first so your upload can be saved." });
      return;
    }
    if (!file) {
      setStatus({ kind: "error", text: "Take a photo or choose one first." });
      return;
    }
    if (rnWarning) {
      setStatus({ kind: "error", text: rnWarning });
      return;
    }

    try {
      setStatus({ kind: "info", text: "Preparing image…" });
      const compressed = await normalizeUploadedImage(file);
      const thumbnail = await normalizeThumbnailImage(file);
      const baseName = `${Date.now()}_${compressed.name}`;
      const path = `tagusheep/uploads/${user.uid}/${baseName}`;
      const thumbPath = `tagusheep/uploads/${user.uid}/thumb_${baseName}`;
      const storageRef = ref(storage, path);
      const thumbRef = ref(storage, thumbPath);
      const task = uploadBytesResumable(storageRef, compressed);

      await new Promise<void>((resolve, reject) =>
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setStatus({ kind: "info", text: `Uploading… ${pct}%`, pct });
          },
          reject,
          () => resolve()
        )
      );

      const imageUrl = await getDownloadURL(storageRef);
      await uploadBytes(thumbRef, thumbnail, { contentType: IMAGE_POLICY.mimeType });
      const thumbnailUrl = await getDownloadURL(thumbRef);

      const payload = prepareRecord({
        brand,
        styleNumber,
        rn,
        garmentType,
        notes,
        imageUrl,
        thumbnailUrl,
        storagePath: path,
        sourceUrl,
        sourceName: safeHostnameFromUrl(sourceUrl),
        sourceType: "manual" as SourceType,
        verificationStatus: "pending" as VerificationStatus,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "tags"), payload);
      setStatus({ kind: "success", text: "Uploaded. Ready for the next find." });
      resetForm();
      setTimeout(() => setStatus({ kind: "idle", text: null }), 1800);
    } catch (error: unknown) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Phone-friendly upload</p>
            <h1 className="mt-1 text-3xl font-semibold">Quick thrift upload</h1>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Snap a shirt, add the basics, and keep moving. This page is meant for phones while you are out thrifting.
            </p>
          </div>
          {!user && <AuthPanel compact />}
        </div>

        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          Best for fast uploads:
          <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-100/85">
            <li>one clear photo</li>
            <li>brand</li>
            <li>style number</li>
            <li>RN if visible</li>
            <li>quick notes</li>
          </ul>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-white/80">Photo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-white/12 bg-[#09111f] px-4 py-4 text-white"
            />
          </label>

          {file && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
              Ready: <b>{file.name}</b>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand" value={brand} onChange={setBrand} placeholder="Nike" />
            <Field label="Style number" value={styleNumber} onChange={setStyleNumber} placeholder="ABC123" />
            <Field label="RN" value={rn} onChange={(value) => setRn(value.replace(/\D+/g, ""))} placeholder="66170" inputMode="numeric" />
            <Field label="Garment type" value={garmentType} onChange={setGarmentType} placeholder="T-shirt" />
          </div>

          {rnWarning && <p className="text-sm text-amber-300">{rnWarning}</p>}

          <TextArea label="Notes" value={notes} onChange={setNotes} placeholder="Vintage wash, made in USA, tag looks 90s..." rows={4} />
          <Field label="Source URL (optional)" value={sourceUrl} onChange={setSourceUrl} placeholder="Leave blank if this came from in-store thrifting" />

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={!user || !file || status.kind === "info" || !!rnWarning}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {status.kind === "info" && status.pct != null ? `Uploading… ${status.pct}%` : status.kind === "info" ? "Uploading…" : "Upload this find"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-white transition hover:border-white/30"
            >
              Clear
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
          <Link href="/upload" className="underline">Use full upload form</Link>
          <Link href="/tags" className="underline">Browse tags</Link>
        </div>
      </div>

      {status.text && (
        <div className={`fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm shadow-xl ${status.kind === "success" ? "border-emerald-400 bg-emerald-500 text-black" : status.kind === "error" ? "border-rose-400 bg-rose-500 text-white" : "border-white/20 bg-[#0b1222] text-white"}`}>
          {status.text}
        </div>
      )}
    </main>
  );
}

function Field({ label, value, onChange, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-2xl border border-white/12 bg-[#09111f] px-4 py-4 text-white outline-none transition focus:border-emerald-300/60"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-white/12 bg-[#09111f] px-4 py-4 text-white outline-none transition focus:border-emerald-300/60"
      />
    </label>
  );
}
