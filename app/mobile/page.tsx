"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, setPersistence, browserLocalPersistence, type User } from "firebase/auth";
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, startAt, endAt, where, limit as qlimit } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from "firebase/storage";
import { prepareRecord, type SourceType, type VerificationStatus } from "@/lib/records";
import { findPotentialDuplicates, type DuplicateCandidate } from "@/lib/duplicates";
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
  const [lastUploadSummary, setLastUploadSummary] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [rnBrandSuggestions, setRnBrandSuggestions] = useState<string[]>([]);
  const brandDebounce = useRef<number | null>(null);
  const rnDebounce = useRef<number | null>(null);
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
    setDuplicates(null);
    setBrandSuggestions([]);
    setRnBrandSuggestions([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForNextUpload() {
    resetForm();
    setStatus({ kind: "idle", text: null });
    setLastUploadSummary(null);
  }

  useEffect(() => {
    if (!brand) {
      setBrandSuggestions([]);
      return;
    }

    if (brandDebounce.current) window.clearTimeout(brandDebounce.current);
    brandDebounce.current = window.setTimeout(async () => {
      try {
        const start = brand;
        const end = brand + "\uf8ff";
        const qRef = query(collection(db, "tags"), orderBy("brand"), startAt(start), endAt(end), qlimit(6));
        const snap = await getDocs(qRef);
        const names = Array.from(new Set(snap.docs.map((d) => (d.data().brand || "") as string).filter(Boolean))).slice(0, 6);
        setBrandSuggestions(names);
      } catch {
        setBrandSuggestions([]);
      }
    }, 200);

    return () => {
      if (brandDebounce.current) window.clearTimeout(brandDebounce.current);
    };
  }, [brand]);

  useEffect(() => {
    if (!rn) {
      setRnBrandSuggestions([]);
      return;
    }

    if (rnDebounce.current) window.clearTimeout(rnDebounce.current);
    rnDebounce.current = window.setTimeout(async () => {
      try {
        const qRef = query(collection(db, "tags"), where("rn", "==", rn), qlimit(6));
        const snap = await getDocs(qRef);
        const names = Array.from(new Set(snap.docs.map((d) => (d.data().brand || "") as string).filter(Boolean))).slice(0, 6);
        setRnBrandSuggestions(names);
      } catch {
        setRnBrandSuggestions([]);
      }
    }, 200);

    return () => {
      if (rnDebounce.current) window.clearTimeout(rnDebounce.current);
    };
  }, [rn]);

  useEffect(() => {
    let cancelled = false;

    async function runDuplicateCheck() {
      if (!brand || !styleNumber) {
        setDuplicates(null);
        return;
      }

      const found = await findPotentialDuplicates(brand, styleNumber);
      if (!cancelled) setDuplicates(found);
    }

    void runDuplicateCheck();
    return () => {
      cancelled = true;
    };
  }, [brand, styleNumber]);

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
      setLastUploadSummary([brand || "Unknown brand", styleNumber ? `Style ${styleNumber}` : null, rn ? `RN ${rn}` : null].filter(Boolean).join(" • "));
      setStatus({ kind: "success", text: "Uploaded. Ready for the next find." });
      resetForm();
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

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/75">
          <div className="font-medium text-white">Use it like an app</div>
          <div className="mt-2 space-y-2 text-white/70">
            <p><b>iPhone:</b> tap Share in Safari, then <b>Add to Home Screen</b>.</p>
            <p><b>Android:</b> open the browser menu, then tap <b>Add to Home screen</b> or <b>Install app</b>.</p>
          </div>
        </div>

        {lastUploadSummary && status.kind === "success" && (
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm text-emerald-100 space-y-3">
            <div className="font-medium">Last upload saved</div>
            <div className="text-emerald-100/80">{lastUploadSummary}</div>
            <button
              type="button"
              onClick={resetForNextUpload}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-400/90 px-4 py-2 font-semibold text-black transition hover:bg-emerald-300"
            >
              Upload another find
            </button>
          </div>
        )}

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
            <div className="flex flex-wrap gap-2 text-xs text-white/55">
              <span className="rounded-full border border-white/10 px-2 py-1">Back camera</span>
              <span className="rounded-full border border-white/10 px-2 py-1">Single photo</span>
              <span className="rounded-full border border-white/10 px-2 py-1">Fast upload</span>
            </div>
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

          {brandSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {brandSuggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setBrand(suggestion)} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/80 transition hover:border-emerald-300/50 hover:text-white">
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {rnWarning && <p className="text-sm text-amber-300">{rnWarning}</p>}
          {rnBrandSuggestions.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
              Brands already seen for RN {rn}: {rnBrandSuggestions.join(", ")}
            </div>
          )}

          {duplicates && duplicates.length > 0 && (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100 space-y-2">
              <div className="font-medium">Possible duplicate already in Tagsheep</div>
              {duplicates.map((dup) => (
                <div key={dup.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 truncate">{dup.brand || "Unknown brand"} — {dup.productName || dup.styleNumber || "Existing record"}</div>
                  <Link href={`/tag/${dup.id}`} className="underline">Open</Link>
                </div>
              ))}
            </div>
          )}

          <TextArea label="Notes" value={notes} onChange={setNotes} placeholder="Vintage wash, made in USA, tag looks 90s..." rows={4} />
          <Field label="Source URL (optional)" value={sourceUrl} onChange={setSourceUrl} placeholder="Leave blank if this came from in-store thrifting" />

          <div className="sticky bottom-3 z-40 flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#0b1222]/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <button
              type="submit"
              disabled={!user || !file || status.kind === "info" || !!rnWarning}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {status.kind === "info" && status.pct != null ? `Uploading… ${status.pct}%` : status.kind === "info" ? "Uploading…" : "Upload this find"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-white transition hover:border-white/30"
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
