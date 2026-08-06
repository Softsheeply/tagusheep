"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, setPersistence, browserLocalPersistence, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { buildSearchText, normalizeBrand, normalizeRn, normalizeStyleNumber } from "@/lib/records";
import { createOcrWorker, recognizeTagPhoto } from "@/lib/ocr";
import { normalizeUploadedImage } from "@/lib/images";
import { uploadImageObject } from "@/lib/object-storage";
import type { Worker as OcrWorker } from "tesseract.js";

type BatchItem = {
  id: string;
  file: File;
  previewUrl: string;
  brand: string;
  rn: string;
  styleNumber: string;
  madeIn: string;
  materials: string;
  ocrStatus: "pending" | "scanning" | "done" | "error";
  submitStatus: "idle" | "uploading" | "done" | "error";
  submitMessage?: string;
};

// Photos are scanned a few at a time so a big batch doesn't try to run
// dozens of Tesseract recognize() passes at once and choke the tab.
const SCAN_CONCURRENCY = 2;
const UPLOAD_CONCURRENCY = 3;

let nextId = 0;

export default function BatchUploadPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<OcrWorker | null>(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate().catch(() => {});
      for (const item of items) URL.revokeObjectURL(item.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanItem = useCallback(async (item: BatchItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ocrStatus: "scanning" } : i)));
    try {
      if (!workerRef.current) workerRef.current = await createOcrWorker();
      const result = await recognizeTagPhoto(workerRef.current, item.file);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                rn: i.rn || result.rn || "",
                styleNumber: i.styleNumber || result.styleNumber || "",
                madeIn: i.madeIn || result.madeIn || "",
                materials: i.materials || result.materials || "",
                ocrStatus: "done",
              }
            : i
        )
      );
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ocrStatus: "error" } : i)));
    }
  }, []);

  function addFiles(files: FileList | File[]) {
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;

    const newItems: BatchItem[] = picked.map((file) => ({
      id: String(nextId++),
      file,
      previewUrl: URL.createObjectURL(file),
      brand: "",
      rn: "",
      styleNumber: "",
      madeIn: "",
      materials: "",
      ocrStatus: "pending",
      submitStatus: "idle",
    }));
    setItems((prev) => [...prev, ...newItems]);

    (async () => {
      for (let i = 0; i < newItems.length; i += SCAN_CONCURRENCY) {
        await Promise.all(newItems.slice(i, i + SCAN_CONCURRENCY).map(scanItem));
      }
    })();
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function updateItem(id: string, patch: Partial<BatchItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function submitAll() {
    if (!user) return;
    const uid = user.uid;
    const submittable = items.filter(
      (i) => i.submitStatus !== "done" && i.brand.trim() && (i.rn.trim() || i.styleNumber.trim())
    );
    if (submittable.length === 0) return;

    setSubmitting(true);

    async function submitOne(item: BatchItem) {
      updateItem(item.id, { submitStatus: "uploading" });
      try {
        const normalized = await normalizeUploadedImage(item.file);
        const baseName = `${Date.now()}_${normalized.name}`;
        const path = `tagusheep/uploads/${uid}/${baseName}`;
        const uploaded = await uploadImageObject(normalized, path);

        const cleanBrand = normalizeBrand(item.brand);
        const cleanRn = normalizeRn(item.rn);
        const cleanStyleNumber = normalizeStyleNumber(item.styleNumber);
        const cleanMadeIn = item.madeIn.trim() || null;
        const cleanMaterials = item.materials.trim() || null;

        const payload: Record<string, unknown> = {
          imageUrl: uploaded.url,
          thumbnailUrl: uploaded.thumbnailUrl,
          storagePath: uploaded.storagePath,
          sourceType: "manual",
          verificationStatus: "pending",
          searchText: buildSearchText({
            brand: cleanBrand,
            rn: cleanRn,
            styleNumber: cleanStyleNumber,
            madeIn: cleanMadeIn,
            materials: cleanMaterials,
          }),
          createdBy: uid,
          createdAt: serverTimestamp(),
        };
        if (cleanBrand) payload.brand = cleanBrand;
        else throw new Error("Brand is required.");
        if (cleanRn) payload.rn = cleanRn;
        if (cleanStyleNumber) payload.styleNumber = cleanStyleNumber;
        if (cleanMadeIn) payload.madeIn = cleanMadeIn;
        if (cleanMaterials) payload.materials = cleanMaterials;

        await addDoc(collection(db, "tags"), payload);
        updateItem(item.id, { submitStatus: "done" });
      } catch (err: unknown) {
        updateItem(item.id, {
          submitStatus: "error",
          submitMessage: err instanceof Error ? err.message : "Upload failed.",
        });
      }
    }

    for (let i = 0; i < submittable.length; i += UPLOAD_CONCURRENCY) {
      await Promise.all(submittable.slice(i, i + UPLOAD_CONCURRENCY).map(submitOne));
    }

    setSubmitting(false);
  }

  const readyCount = items.filter((i) => i.brand.trim() && (i.rn.trim() || i.styleNumber.trim())).length;
  const doneCount = items.filter((i) => i.submitStatus === "done").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Community contribution</p>
          <h1 className="mt-1 text-3xl font-semibold">Batch upload</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/65">
            Photograph a stack of tags, drop them all in here, and each one gets scanned for RN/style
            number automatically. Fill in whatever the scan misses, then submit — each ready tag goes
            live as pending.
          </p>
        </div>
        <Link href="/upload" className="text-sm underline text-white/60 hover:text-white">
          Single upload instead
        </Link>
      </div>

      {!user && (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-4">
          <div className="font-medium text-amber-100">Sign in to submit tags</div>
          <p className="mt-1 text-sm text-amber-100/75">
            Use the <b>Sign in</b> button at the top right first.
          </p>
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className="rounded-2xl border-2 border-dashed border-white/15 p-6 text-center transition hover:border-white/30"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Add tag photos"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full">
          <div className="text-sm font-medium text-white/80">Add tag photos</div>
          <div className="mt-1 text-xs text-white/40">Select multiple files at once · drag &amp; drop works too</div>
        </button>
      </div>

      {items.length > 0 && (
        <>
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <BatchRow key={item.id} item={item} onChange={(patch) => updateItem(item.id, patch)} onRemove={() => removeItem(item.id)} />
            ))}
          </div>

          <div className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1222]/95 p-4 backdrop-blur">
            <button
              type="button"
              onClick={submitAll}
              disabled={!user || submitting || readyCount === 0}
              className="rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-40"
            >
              {submitting ? "Submitting…" : `Submit ${readyCount} ready tag${readyCount === 1 ? "" : "s"}`}
            </button>
            <span className="text-sm text-white/55">
              {items.length} photo{items.length === 1 ? "" : "s"} added
              {doneCount > 0 && ` · ${doneCount} submitted`}
            </span>
          </div>
        </>
      )}
    </main>
  );
}

function BatchRow({ item, onChange, onRemove }: { item: BatchItem; onChange: (patch: Partial<BatchItem>) => void; onRemove: () => void }) {
  const ready = item.brand.trim() && (item.rn.trim() || item.styleNumber.trim());

  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.previewUrl} alt="Tag preview" className="h-20 w-20 shrink-0 rounded-xl object-cover" />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={item.brand}
            onChange={(e) => onChange({ brand: e.target.value })}
            placeholder="Brand (required)"
            aria-label="Brand"
            disabled={item.submitStatus === "done"}
            className="rounded-lg border border-white/12 bg-[#09111f] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-emerald-300/60 disabled:opacity-50"
          />
          <input
            value={item.rn}
            onChange={(e) => onChange({ rn: e.target.value.replace(/\D+/g, "") })}
            placeholder="RN number"
            aria-label="RN number"
            inputMode="numeric"
            disabled={item.submitStatus === "done"}
            className="rounded-lg border border-white/12 bg-[#09111f] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-emerald-300/60 disabled:opacity-50"
          />
          <input
            value={item.styleNumber}
            onChange={(e) => onChange({ styleNumber: e.target.value })}
            placeholder="Style number"
            aria-label="Style number"
            disabled={item.submitStatus === "done"}
            className="rounded-lg border border-white/12 bg-[#09111f] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-emerald-300/60 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {item.ocrStatus === "scanning" && <span className="text-white/45">Scanning…</span>}
          {item.ocrStatus === "done" && !item.rn && !item.styleNumber && (
            <span className="text-white/45">No RN/style found — fill in manually.</span>
          )}
          {item.ocrStatus === "error" && <span className="text-rose-300">Scan failed — fill in manually.</span>}
          {!ready && item.ocrStatus !== "scanning" && (
            <span className="text-amber-300/80">Needs brand + RN or style number.</span>
          )}
          {item.submitStatus === "uploading" && <span className="text-white/60">Uploading…</span>}
          {item.submitStatus === "done" && <span className="text-emerald-300">Submitted</span>}
          {item.submitStatus === "error" && <span className="text-rose-300">{item.submitMessage || "Failed"}</span>}
        </div>
      </div>

      {item.submitStatus !== "done" && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="shrink-0 self-start rounded-lg border border-white/15 px-2 py-1 text-xs text-white/50 transition hover:border-rose-300/40 hover:text-rose-200"
        >
          Remove
        </button>
      )}
    </div>
  );
}
