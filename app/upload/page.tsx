"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, db, storage } from "@/lib/firebase";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  startAt,
  endAt,
  limit as qlimit,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, uploadBytes } from "firebase/storage";
import { CORE_VERIFICATION_FIELDS, CORE_VERIFICATION_FIELD_LABELS, getVerificationPercent, prepareRecord, type SourceType, type TagRecord, type VerificationStatus } from "@/lib/records";
import { findPotentialDuplicates, type DuplicateCandidate } from "@/lib/duplicates";
import AuthPanel from "@/app/components/AuthPanel";
import { safeHostnameFromUrl } from "@/lib/validation";
import { IMAGE_POLICY, normalizeThumbnailImage, normalizeUploadedImage } from "@/lib/images";

export default function UploadPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [brand, setBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [rn, setRn] = useState("");
  const [styleNumber, setStyleNumber] = useState("");
  const [garmentType, setGarmentType] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("");
  const [madeIn, setMadeIn] = useState("");
  const [materials, setMaterials] = useState("");
  const [careText, setCareText] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("pending");
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState<{ kind: "idle" | "info" | "success" | "error"; text: string | null; pct?: number }>({ kind: "idle", text: null });
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const verificationRecord: Partial<TagRecord> = {
    brand,
    productName,
    rn,
    styleNumber,
    garmentType,
    materials,
    madeIn,
    careText,
    imageUrl: file ? "has-image" : "",
    sourceUrl,
  };
  const verificationPreview = getVerificationPercent(verificationRecord);
  const verificationChecklist = CORE_VERIFICATION_FIELDS.map((field) => {
    const value = verificationRecord[field];
    const filled = Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value != null;
    return { field, label: CORE_VERIFICATION_FIELD_LABELS[field], filled };
  });
  const rnWarning = !rn
    ? null
    : !/^\d+$/.test(rn)
      ? "RN must be digits only."
      : rn.length < 3
        ? "RN looks too short."
        : rn.length > 7
          ? "RN looks too long."
          : null;
  const [rnBrandSuggestions, setRnBrandSuggestions] = useState<string[]>([]);
  const [brandAutocomplete, setBrandAutocomplete] = useState<string[]>([]);
  const rnDebounce = useRef<number | null>(null);
  const brandDebounce = useRef<number | null>(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);


  function handleRnChange(val: string) {
    const digits = val.replace(/\D+/g, "");
    setRn(digits);
  }

  useEffect(() => {
    if (!rn) {
      return;
    }

    if (rnDebounce.current) window.clearTimeout(rnDebounce.current);
    rnDebounce.current = window.setTimeout(async () => {
      try {
        const qRef = query(collection(db, "tags"), where("rn", "==", rn), qlimit(8));
        const snap = await getDocs(qRef);
        const brands = Array.from(new Set(snap.docs.map((d) => (d.data().brand || "") as string).filter(Boolean))).slice(0, 8);
        setRnBrandSuggestions(brands);
      } catch {
        setRnBrandSuggestions([]);
      }
    }, 220);

    return () => {
      if (rnDebounce.current) window.clearTimeout(rnDebounce.current);
    };
  }, [rn]);

  useEffect(() => {
    if (!brand) {
      return;
    }
    if (brandDebounce.current) window.clearTimeout(brandDebounce.current);
    brandDebounce.current = window.setTimeout(async () => {
      try {
        const start = brand;
        const end = brand + "\uf8ff";
        const qRef = query(collection(db, "tags"), orderBy("brand"), startAt(start), endAt(end), qlimit(8));
        const snap = await getDocs(qRef);
        const names = Array.from(new Set(snap.docs.map((d) => (d.data().brand || "") as string).filter(Boolean))).slice(0, 8);
        setBrandAutocomplete(names);
      } catch {
        setBrandAutocomplete([]);
      }
    }, 220);

    return () => {
      if (brandDebounce.current) window.clearTimeout(brandDebounce.current);
    };
  }, [brand]);

  const visibleBrandAutocomplete = brand ? brandAutocomplete : [];
  const visibleRnBrandSuggestions = rn ? rnBrandSuggestions : [];

  async function checkDuplicates() {
    const found = await findPotentialDuplicates(brand, styleNumber);
    setDuplicates(found);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setStatus({ kind: "error", text: "Please sign in first." });
      return;
    }
    if (!file) {
      setStatus({ kind: "error", text: "Choose an image." });
      return;
    }
    if (rnWarning) {
      setStatus({ kind: "error", text: rnWarning });
      return;
    }

    try {
      setStatus({ kind: "info", text: "Compressing…" });

      const compressed = await normalizeUploadedImage(file);
      const thumbnail = await normalizeThumbnailImage(file);
      const baseName = `${Date.now()}_${compressed.name}`;
      const path = `tagusheep/uploads/${user.uid}/${baseName}`;
      const thumbPath = `tagusheep/uploads/${user.uid}/thumb_${baseName}`;
      const storageRef = ref(storage, path);
      const thumbRef = ref(storage, thumbPath);
      const task = uploadBytesResumable(storageRef, compressed);

      await new Promise<void>((res, rej) =>
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setStatus({ kind: "info", text: `Uploading… ${pct}%`, pct });
          },
          (error: Error & { code?: string }) => {
            console.error("Upload failed", error);
            const code = error.code ? ` (${error.code})` : "";
            rej(new Error(`${error.message || "Upload failed"}${code}`));
          },
          () => res()
        )
      );
      const imageUrl = await getDownloadURL(storageRef);
      await uploadBytes(thumbRef, thumbnail, { contentType: IMAGE_POLICY.mimeType });
      const thumbnailUrl = await getDownloadURL(thumbRef);

      const payload = prepareRecord({
        brand,
        productName,
        rn,
        styleNumber,
        garmentType,
        tags: tags.split(",").map((v) => v.trim()).filter(Boolean),
        category,
        year,
        madeIn,
        materials,
        careText,
        notes,
        imageUrl,
        thumbnailUrl,
        storagePath: path,
        sourceUrl,
        sourceName: safeHostnameFromUrl(sourceUrl),
        sourceType,
        verificationStatus,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "tags"), payload);

      setStatus({ kind: "success", text: "Record uploaded ✅" });
      setBrand("");
      setProductName("");
      setRn("");
      setStyleNumber("");
      setGarmentType("");
      setTags("");
      setCategory("");
      setYear("");
      setMadeIn("");
      setMaterials("");
      setCareText("");
      setNotes("");
      setSourceUrl("");
      setSourceType("manual");
      setVerificationStatus("pending");
      setFile(null);
      const input = document.getElementById("fileInput") as HTMLInputElement | null;
      if (input) input.value = "";
      setTimeout(() => setStatus({ kind: "idle", text: null }), 1200);
    } catch (err: unknown) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Add a Tagsheep record</h1>
        <div className="flex items-center gap-2 text-sm">
          {user ? (
            <span className="opacity-80">Signed in as <b>{user.displayName || user.email}</b></span>
          ) : (
            <AuthPanel />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80 space-y-3">
        <div>Tagsheep is building a real clothing internet database. Strong records combine a clean reference image with product metadata, source provenance, and review status.</div>
        <div className="text-emerald-200">Verification preview: {verificationPreview}%</div>
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/45">Core 10 fields</div>
          <div className="flex flex-wrap gap-2">
            {verificationChecklist.map((item) => (
              <span key={item.field} className={`rounded-full border px-2 py-1 text-xs ${item.filled ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-white/45"}`}>
                {item.filled ? "✓ " : ""}{item.label}
              </span>
            ))}
          </div>
        </div>
        <Link href="/upload-guide" className="underline">Read the upload & photo guide</Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Brand" value={brand} onChange={setBrand} />
          <Field label="Product name" value={productName} onChange={setProductName} />
          <Field label="RN" value={rn} onChange={handleRnChange} />
          <Field label="Style number" value={styleNumber} onChange={setStyleNumber} />
          <Field label="Garment type" value={garmentType} onChange={setGarmentType} />
          <Field label="Tags (comma separated)" value={tags} onChange={setTags} />
          <Field label="Category" value={category} onChange={setCategory} />
          <Field label="Year" value={year} onChange={setYear} />
          <Field label="Made in" value={madeIn} onChange={setMadeIn} />
          <Field label="Materials" value={materials} onChange={setMaterials} />
        </div>

        {visibleBrandAutocomplete.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleBrandAutocomplete.map((b) => (
              <button key={b} type="button" onClick={() => setBrand(b)} className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition">
                {b}
              </button>
            ))}
          </div>
        )}

        {rnWarning && <p className="text-xs text-amber-300">{rnWarning}</p>}
        {rn && visibleRnBrandSuggestions.length > 0 && (
          <div>
            <p className="text-xs text-white/70 mb-1">Brands already seen for RN {rn}:</p>
            <div className="flex flex-wrap gap-2">
              {visibleRnBrandSuggestions.map((b) => (
                <button key={b} type="button" onClick={() => setBrand(b)} className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition">
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <TextArea label="Care text" value={careText} onChange={setCareText} rows={4} />
        <TextArea label="Notes" value={notes} onChange={setNotes} rows={5} />
        <Field label="Source URL" value={sourceUrl} onChange={setSourceUrl} />

        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Source type" value={sourceType} onChange={(v) => setSourceType(v as SourceType)} options={["manual", "official", "marketplace", "archive", "resale", "unknown"]} />
          <Select label="Verification status" value={verificationStatus} onChange={(v) => setVerificationStatus(v as VerificationStatus)} options={["draft", "needs_info", "pending", "reviewed", "verified", "rejected"]} />
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f && f.type.startsWith("image/")) setFile(f);
          }}
          className="rounded border border-dashed border-white/20 p-4"
        >
          <input id="fileInput" type="file" accept="image/*" className="w-full border rounded p-2 bg-white text-black" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="mt-2 text-xs text-white/70">Best result: one clean label image on a white background, centered and easy to read. Uploads are normalized to {IMAGE_POLICY.format.toUpperCase()} at up to {IMAGE_POLICY.maxDimension}px.</p>
          {file && <p className="text-xs mt-1">Selected: <b>{file.name}</b></p>}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75 space-y-2">
          <button type="button" onClick={checkDuplicates} className="rounded-lg border border-white/20 px-3 py-1 text-white">Check duplicates</button>
          {duplicates?.length ? (
            <div className="space-y-2 text-amber-100">
              <div>Possible duplicates: {duplicates.length}</div>
              {duplicates.map((dup) => (
                <div key={dup.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 truncate">{dup.brand || "Unknown"} — {dup.productName || "No title"}</div>
                  <Link href={`/tag/${dup.id}`} className="underline">Open</Link>
                </div>
              ))}
            </div>
          ) : duplicates ? (
            <div className="text-emerald-200">No duplicates found.</div>
          ) : (
            <div className="text-white/55">Checks brand + style number against existing records.</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" disabled={!user || !file || status.kind === "info" || !!rnWarning} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
            {status.kind === "info" && status.pct != null ? `Uploading… ${status.pct}%` : status.kind === "info" ? "Saving…" : "Add record"}
          </button>
          <Link href="/tags" className="text-sm underline">Search database</Link>
        </div>
      </form>

      {status.text && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg border ${status.kind === "success" ? "bg-emerald-500 text-black border-emerald-400" : status.kind === "error" ? "bg-rose-500 text-white border-rose-400" : "bg-white/10 border-white/20"}`}>
          {status.text}
        </div>
      )}
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
