"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, setPersistence, browserLocalPersistence, type User } from "firebase/auth";
import { addDoc, collection, getDocs, limit as qlimit, orderBy, query, serverTimestamp, startAt, endAt, where } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes } from "firebase/storage";
import { buildSearchText, normalizeBrand, normalizeRn, normalizeStyleNumber, type SourceType } from "@/lib/records";
import { findPotentialDuplicates, type DuplicateCandidate } from "@/lib/duplicates";
import { safeHostnameFromUrl } from "@/lib/validation";

export default function UploadPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);

  // Required
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [rn, setRn] = useState("");
  const [styleNumber, setStyleNumber] = useState("");

  // Optional
  const [showOptional, setShowOptional] = useState(false);
  const [productName, setProductName] = useState("");
  const [year, setYear] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [madeIn, setMadeIn] = useState("");
  const [materials, setMaterials] = useState("");
  const [careText, setCareText] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  // UI
  const [status, setStatus] = useState<{ kind: "idle" | "info" | "success" | "error"; text: string | null }>({ kind: "idle", text: null });
  const [sessionCount, setSessionCount] = useState(0);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [rnBrandSuggestions, setRnBrandSuggestions] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rnDebounce = useRef<number | null>(null);
  const brandDebounce = useRef<number | null>(null);

  const rnWarning = !rn
    ? null
    : !/^\d+$/.test(rn)
      ? "RN must be digits only."
      : rn.length > 7
        ? "RN looks too long."
        : null;
  const hasIdentifier = rn.trim().length > 0 || styleNumber.trim().length > 0;
  const canSubmit = !!user && !!file && hasIdentifier && !rnWarning && status.kind !== "info";

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  function pickFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  useEffect(() => {
    if (!brand) { setBrandSuggestions([]); return; }
    if (brandDebounce.current) window.clearTimeout(brandDebounce.current);
    brandDebounce.current = window.setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, "tags"), orderBy("brand"), startAt(brand), endAt(brand + ""), qlimit(6)));
        setBrandSuggestions(Array.from(new Set(snap.docs.map((d) => (d.data().brand || "") as string).filter(Boolean))).slice(0, 6));
      } catch { setBrandSuggestions([]); }
    }, 220);
    return () => { if (brandDebounce.current) window.clearTimeout(brandDebounce.current); };
  }, [brand]);

  useEffect(() => {
    if (!rn || rnWarning) { setRnBrandSuggestions([]); return; }
    if (rnDebounce.current) window.clearTimeout(rnDebounce.current);
    rnDebounce.current = window.setTimeout(async () => {
      try {
        const snap = await getDocs(query(collection(db, "tags"), where("rn", "==", rn), qlimit(8)));
        setRnBrandSuggestions(Array.from(new Set(snap.docs.map((d) => (d.data().brand || "") as string).filter(Boolean))).slice(0, 6));
      } catch { setRnBrandSuggestions([]); }
    }, 220);
    return () => { if (rnDebounce.current) window.clearTimeout(rnDebounce.current); };
  }, [rn, rnWarning]);

  function resetForm() {
    clearFile();
    setBrand(""); setRn(""); setStyleNumber("");
    setProductName(""); setYear(""); setGarmentType("");
    setColor(""); setSize(""); setMadeIn("");
    setMaterials(""); setCareText(""); setNotes(""); setSourceUrl("");
    setDuplicates(null); setBrandSuggestions([]); setRnBrandSuggestions([]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user || !file) return;

    try {
      setStatus({ kind: "info", text: "Uploading…" });

      const baseName = `${Date.now()}_${file.name}`;
      const path = `tagusheep/uploads/${user.uid}/${baseName}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);

      const cleanBrand = normalizeBrand(brand);
      const cleanRn = normalizeRn(rn);
      const cleanStyleNumber = normalizeStyleNumber(styleNumber);
      const cleanProductName = productName.trim() || null;
      const cleanYear = year.trim() || null;
      const cleanGarmentType = garmentType.trim() || null;
      const cleanColor = color.trim() || null;
      const cleanSize = size.trim() || null;
      const cleanMadeIn = madeIn.trim() || null;
      const cleanMaterials = materials.trim() || null;
      const cleanCareText = careText.trim() || null;
      const cleanNotes = notes.trim() || null;
      const cleanSourceUrl = sourceUrl.trim() || null;
      const cleanSourceName = safeHostnameFromUrl(cleanSourceUrl || "") || null;

      const payload: Record<string, unknown> = {
        imageUrl,
        thumbnailUrl: imageUrl,
        storagePath: path,
        sourceType: "manual" as SourceType,
        verificationStatus: "pending",
        searchText: buildSearchText({ brand: cleanBrand, rn: cleanRn, styleNumber: cleanStyleNumber, productName: cleanProductName, garmentType: cleanGarmentType, size: cleanSize, year: cleanYear, madeIn: cleanMadeIn, materials: cleanMaterials, careText: cleanCareText, color: cleanColor, notes: cleanNotes, sourceName: cleanSourceName }),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        uploadFallback: false,
        fallbackReason: null,
      };

      if (cleanBrand) payload.brand = cleanBrand;
      if (cleanRn) payload.rn = cleanRn;
      if (cleanStyleNumber) payload.styleNumber = cleanStyleNumber;
      if (cleanProductName) payload.productName = cleanProductName;
      if (cleanYear) payload.year = cleanYear;
      if (cleanGarmentType) payload.garmentType = cleanGarmentType;
      if (cleanColor) payload.color = cleanColor;
      if (cleanSize) payload.size = cleanSize;
      if (cleanMadeIn) payload.madeIn = cleanMadeIn;
      if (cleanMaterials) payload.materials = cleanMaterials;
      if (cleanCareText) payload.careText = cleanCareText;
      if (cleanNotes) payload.notes = cleanNotes;
      if (cleanSourceUrl) payload.sourceUrl = cleanSourceUrl;
      if (cleanSourceName) payload.sourceName = cleanSourceName;

      await addDoc(collection(db, "imports_review"), payload);
      setSessionCount((n) => n + 1);
      setStatus({ kind: "success", text: `Submitted! ${cleanBrand || "Tag"} sent to review.` });
      resetForm();
      setTimeout(() => setStatus({ kind: "idle", text: null }), 2500);
    } catch (err: unknown) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Community contribution</p>
          <h1 className="mt-1 text-3xl font-semibold">Submit a tag</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">
            Photo + brand + RN or style number gets it into review. Everything else fills in the record.
          </p>
        </div>
        {sessionCount > 0 && (
          <div className="shrink-0 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-center">
            <div className="text-2xl font-semibold text-white">{sessionCount}</div>
            <div className="text-[11px] text-emerald-200/60 uppercase tracking-wide">submitted</div>
          </div>
        )}
      </div>

      {/* Sign-in gate */}
      {!user && (
        <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-4">
          <div className="font-medium text-amber-100">Sign in to submit tags</div>
          <p className="mt-1 text-sm text-amber-100/75">
            Use the <b>Sign in</b> button at the top right. Once approved your submission appears in search for everyone.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">

        {/* ── Photo ── */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) pickFile(f); }}
          className={`rounded-2xl border-2 border-dashed p-5 transition ${previewUrl ? "border-emerald-300/30 bg-emerald-400/5" : "border-white/15 hover:border-white/30"}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />
          {previewUrl ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Tag preview" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{file?.name}</div>
                <div className="text-xs text-white/45">{file ? (file.size / 1024).toFixed(0) + " KB" : ""}</div>
              </div>
              <button type="button" onClick={clearFile} className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/30 hover:text-white/80">
                Change
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center gap-3 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5">
                <svg className="h-6 w-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-white/80">Add tag photo</div>
                <div className="mt-0.5 text-xs text-white/40">Tap to choose · drag &amp; drop works too</div>
              </div>
            </button>
          )}
        </div>

        {/* ── Required fields ── */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40">Required</p>

          <div className="space-y-1.5">
            <Field label="Brand" value={brand} onChange={setBrand} placeholder="Nike, Levi's, Ralph Lauren…" required />
            {brandSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {brandSuggestions.map((b) => (
                  <button key={b} type="button" onClick={() => { setBrand(b); setBrandSuggestions([]); }}
                    className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs transition hover:border-emerald-300/50 hover:text-emerald-200">
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Field label="RN number" value={rn} onChange={(v) => setRn(v.replace(/\D+/g, ""))} placeholder="66170" inputMode="numeric" />
              {rnWarning && <p className="text-xs text-amber-300">{rnWarning}</p>}
              {rnBrandSuggestions.length > 0 && (
                <div>
                  <p className="text-xs text-white/45">This RN is linked to:</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rnBrandSuggestions.map((b) => (
                      <button key={b} type="button" onClick={() => { setBrand(b); setRnBrandSuggestions([]); }}
                        className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs transition hover:border-emerald-300/50 hover:text-emerald-200">
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Field label="Style number" value={styleNumber} onChange={setStyleNumber} placeholder="ABC-1234" />
          </div>

          {!hasIdentifier && (brand || file) && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Add an <b>RN</b> or <b>style number</b> — at least one is needed to match duplicates.
            </div>
          )}
        </div>

        {/* ── Optional fields ── */}
        <div className="rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-sm transition hover:text-white"
          >
            <span className="text-white/65">
              Additional details
              <span className="ml-1.5 text-white/35">(year, size, materials…)</span>
            </span>
            <span className="text-lg leading-none text-white/30">{showOptional ? "−" : "+"}</span>
          </button>

          {showOptional && (
            <div className="space-y-4 border-t border-white/10 px-4 pb-5 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Product name" value={productName} onChange={setProductName} placeholder="Vintage logo tee" />
                <Field label="Year / era" value={year} onChange={setYear} placeholder="1990s, 1987…" />
                <Field label="Garment type" value={garmentType} onChange={setGarmentType} placeholder="T-shirt, jacket, dress…" />
                <Field label="Color" value={color} onChange={setColor} placeholder="Navy, faded black…" />
                <Field label="Size" value={size} onChange={setSize} placeholder="L, XL, 34…" />
                <Field label="Made in" value={madeIn} onChange={setMadeIn} placeholder="USA, Mexico…" />
              </div>
              <Field label="Materials" value={materials} onChange={setMaterials} placeholder="100% cotton, poly blend…" />
              <TextArea label="Care text" value={careText} onChange={setCareText} rows={2} placeholder="Machine wash cold…" />
              <TextArea label="Notes" value={notes} onChange={setNotes} rows={3} placeholder="Anything else worth noting about this tag" />
              <Field label="Source URL" value={sourceUrl} onChange={setSourceUrl} placeholder="https://… (leave blank for in-store finds)" />
            </div>
          )}
        </div>

        {/* ── Duplicate check ── */}
        {hasIdentifier && (
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <button
              type="button"
              onClick={async () => setDuplicates(await findPotentialDuplicates(brand, styleNumber, rn))}
              className="text-white/50 underline transition hover:text-white/80"
            >
              Check for existing matches
            </button>
            {duplicates && duplicates.length > 0 && (
              <div className="mt-2 space-y-1.5 text-amber-100">
                <div className="text-xs font-medium text-amber-200">Possible duplicates already in database:</div>
                {duplicates.map((dup) => (
                  <div key={dup.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">
                      {dup.brand || "Unknown"} — {dup.styleNumber || dup.rn || "—"}
                      {dup.matchReason && <span className="ml-1 text-amber-100/50">({dup.matchReason})</span>}
                    </span>
                    <Link href={`/tag/${dup.id}`} target="_blank" className="shrink-0 underline">View</Link>
                  </div>
                ))}
              </div>
            )}
            {duplicates?.length === 0 && (
              <span className="ml-2 text-emerald-300/70 text-xs">No duplicates found.</span>
            )}
          </div>
        )}

        {/* ── Submit — sticky on mobile ── */}
        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1222]/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-xl bg-emerald-400/90 px-5 py-3.5 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-40 sm:flex-none"
          >
            {status.kind === "info" ? "Uploading…" : "Submit tag"}
          </button>
          {!user && (
            <p className="text-xs text-white/45 sm:hidden">Sign in above first.</p>
          )}
          {user && !canSubmit && file && !hasIdentifier && (
            <p className="text-xs text-amber-300/80 sm:hidden">Add RN or style number.</p>
          )}
        </div>
      </form>

      {/* Toast */}
      {status.text && (
        <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-xl border px-5 py-3 text-sm font-medium shadow-xl ${
          status.kind === "success" ? "border-emerald-400/40 bg-emerald-500 text-black" :
          status.kind === "error" ? "border-rose-400/40 bg-rose-600 text-white" :
          "border-white/20 bg-white/10 text-white"
        }`}>
          {status.text}
        </div>
      )}
    </main>
  );
}

function Field({ label, value, onChange, placeholder, inputMode, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"]; required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-white/75">{label}{required && <span className="ml-1 text-white/30 text-xs">(required)</span>}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-emerald-300/60"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-white/75">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-emerald-300/60"
      />
    </label>
  );
}
