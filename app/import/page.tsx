"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "@/lib/firebase";
import { CATEGORY_OPTIONS, CORE_VERIFICATION_FIELDS, CORE_VERIFICATION_FIELD_LABELS, getVerificationPercent, prepareRecord, type SourceType, type TagRecord, type VerificationStatus } from "@/lib/records";
import { scrapeProductUrl } from "@/lib/scrape";
import { findPotentialDuplicates, type DuplicateCandidate } from "@/lib/duplicates";
import { safeHostnameFromUrl } from "@/lib/validation";
import { fetchRemoteImageAsFile, IMAGE_POLICY, normalizeThumbnailImage, normalizeUploadedImage } from "@/lib/images";

type FormState = {
  brand: string;
  productName: string;
  rn: string;
  styleNumber: string;
  garmentType: string;
  size: string;
  availableSizes: string;
  tags: string;
  category: string;
  subCategory: string;
  gender: string;
  year: string;
  season: string;
  madeIn: string;
  materials: string;
  careText: string;
  color: string;
  notes: string;
  imageUrl: string;
  extraImageUrls: string;
  sourceUrl: string;
  sourceName: string;
  sourceType: SourceType;
  confidence: string;
  verificationStatus: VerificationStatus;
};

const emptyState: FormState = {
  brand: "",
  productName: "",
  rn: "",
  styleNumber: "",
  garmentType: "",
  size: "",
  availableSizes: "",
  tags: "",
  category: "",
  subCategory: "",
  gender: "",
  year: "",
  season: "",
  madeIn: "",
  materials: "",
  careText: "",
  color: "",
  notes: "",
  imageUrl: "",
  extraImageUrls: "",
  sourceUrl: "",
  sourceName: "",
  sourceType: "unknown",
  confidence: "",
  verificationStatus: "needs_info",
};

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyState);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [hostImportedImage, setHostImportedImage] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(adminSnap.exists());
      } catch {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);
  const verificationRecord: Partial<TagRecord> = {
    brand: form.brand,
    productName: form.productName,
    rn: form.rn,
    styleNumber: form.styleNumber,
    garmentType: form.garmentType,
    materials: form.materials,
    madeIn: form.madeIn,
    careText: form.careText,
    imageUrl: form.imageUrl,
    sourceUrl: form.sourceUrl,
  };
  const verificationPreview = getVerificationPercent(verificationRecord);
  const verificationChecklist = CORE_VERIFICATION_FIELDS.map((field) => {
    const value = verificationRecord[field];
    const filled = Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value != null;
    return { field, label: CORE_VERIFICATION_FIELD_LABELS[field], filled };
  });

  const canSave = useMemo(() => {
    return [form.brand, form.productName, form.styleNumber, form.rn, form.notes, form.imageUrl, form.sourceUrl]
      .some((value) => value.trim().length > 0);
  }, [form]);

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = await scrapeProductUrl(url.trim());
      setForm({
        brand: data.brand || "",
        productName: data.productName || "",
        rn: data.rn || "",
        styleNumber: data.styleNumber || "",
        garmentType: "",
        size: data.size || "",
        availableSizes: (data.availableSizes || []).join(", "),
        tags: "",
        category: data.category || "",
        subCategory: data.subCategory || "",
        gender: data.gender || "",
        year: data.year || "",
        season: data.season || "",
        madeIn: data.madeIn || "",
        materials: data.materials || "",
        careText: data.careText || "",
        color: data.color || "",
        notes: data.notes || "",
        imageUrl: data.imageUrl || "",
        extraImageUrls: (data.extraImageUrls || []).join("\n"),
        sourceUrl: data.sourceUrl || url.trim(),
        sourceName: data.sourceName || "",
        sourceType: (data.sourceType as SourceType) || "unknown",
        confidence: data.confidence == null ? "" : String(data.confidence),
        verificationStatus: (data.verificationStatus as VerificationStatus) || "needs_info",
      });
      setDuplicates(null);
      setMessage("Imported product data. Partial records can be saved as Needs Info.");
    } catch (error: unknown) {
      console.error("Import failed", error);
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkDuplicates() {
    const found = await findPotentialDuplicates(form.brand, form.styleNumber);
    setDuplicates(found);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.currentUser) {
      setMessage("Please sign in before saving records.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const uid = auth.currentUser.uid;
      let hostedImageUrl = form.imageUrl;
      let hostedThumbnailUrl: string | null = null;
      let hostedExtraImageUrls = form.extraImageUrls.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
      let hostedStoragePath: string | null = null;
      let rehostWarning: string | null = null;

      if (hostImportedImage && form.imageUrl) {
        try {
          const remoteFile = await fetchRemoteImageAsFile(form.imageUrl, "primary-import");
          const normalizedFile = await normalizeUploadedImage(remoteFile);
          const thumbnailFile = await normalizeThumbnailImage(remoteFile);
          const baseName = `${Date.now()}_${normalizedFile.name}`;
          const path = `tagusheep/imports/${uid}/${baseName}`;
          const thumbPath = `tagusheep/imports/${uid}/thumb_${baseName}`;
          const storageRef = ref(storage, path);
          const thumbRef = ref(storage, thumbPath);
          await uploadBytes(storageRef, normalizedFile, { contentType: IMAGE_POLICY.mimeType });
          await uploadBytes(thumbRef, thumbnailFile, { contentType: IMAGE_POLICY.mimeType });
          hostedImageUrl = await getDownloadURL(storageRef);
          hostedThumbnailUrl = await getDownloadURL(thumbRef);
          hostedStoragePath = path;

          if (hostedExtraImageUrls.length > 0) {
            const limitedExtraUrls = hostedExtraImageUrls.slice(0, IMAGE_POLICY.maxImportedImageUrlCount);
            const hostedExtras = await Promise.all(limitedExtraUrls.map(async (extraUrl, index) => {
              const extraFile = await fetchRemoteImageAsFile(extraUrl, `extra-import-${index + 1}`);
              const normalizedExtra = await normalizeUploadedImage(extraFile);
              const extraBaseName = `${Date.now()}_${index + 1}_${normalizedExtra.name}`;
              const extraPath = `tagusheep/imports/${uid}/extra_${extraBaseName}`;
              const extraRef = ref(storage, extraPath);
              await uploadBytes(extraRef, normalizedExtra, { contentType: IMAGE_POLICY.mimeType });
              return getDownloadURL(extraRef);
            }));
            hostedExtraImageUrls = hostedExtras;
          }
        } catch (imageError: unknown) {
          // The source site's CDN can block server-side image fetches (e.g. Aritzia
          // returns 403 to datacenter IPs regardless of headers). That's a
          // property of the source, not a reason to lose an otherwise-complete
          // record -- fall back to linking the original external image instead
          // of failing the whole save.
          console.error("Image re-host failed, saving with external image URL", imageError);
          hostedImageUrl = form.imageUrl;
          hostedThumbnailUrl = null;
          hostedStoragePath = null;
          const reason = imageError instanceof Error ? imageError.message : "Image re-host failed";
          rehostWarning = `Saved, but couldn't re-host the image (${reason}). Using the original external image URL instead.`;
        }
      }

      const payload = prepareRecord({
        brand: form.brand,
        productName: form.productName,
        rn: form.rn,
        styleNumber: form.styleNumber,
        garmentType: form.garmentType,
        size: form.size,
        availableSizes: form.availableSizes.split(",").map((v) => v.trim()).filter(Boolean),
        tags: form.tags.split(",").map((v) => v.trim()).filter(Boolean),
        category: form.category,
        subCategory: form.subCategory,
        gender: form.gender,
        year: form.year,
        season: form.season,
        madeIn: form.madeIn,
        materials: form.materials,
        careText: form.careText,
        color: form.color,
        notes: form.notes,
        imageUrl: hostedImageUrl,
        thumbnailUrl: hostedThumbnailUrl,
        extraImageUrls: hostedExtraImageUrls,
        sourceUrl: form.sourceUrl,
        sourceName: form.sourceName || safeHostnameFromUrl(form.sourceUrl),
        sourceType: form.sourceType,
        confidence: form.confidence ? Number(form.confidence) : null,
        verificationStatus: form.verificationStatus || "needs_info",
        storagePath: hostedStoragePath,
        createdBy: uid,
        createdAt: serverTimestamp(),
        importedAt: new Date().toISOString(),
      });

      await addDoc(collection(db, "tags"), payload);
      setMessage(rehostWarning || "Record saved to Tagsheep.");
      setForm(emptyState);
      setUrl("");
      setDuplicates(null);
    } catch (error: unknown) {
      console.error("Save live record failed", error);
      const errorWithCode = error instanceof Error ? (error as Error & { code?: string }) : null;
      const code = errorWithCode?.code ? ` (${errorWithCode.code})` : "";
      const message = errorWithCode?.message || "Save failed.";
      setMessage(`${message}${code}`);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Import pipeline</p>
          <h1 className="text-3xl font-semibold">Import from URL</h1>
          <p className="mt-2 text-white/70 max-w-2xl">
            Paste a real product or listing URL. Tagsheep will fetch the page, extract structured data, and let you save a live record with review status, source metadata, and searchable fields.
          </p>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            Current image policy: normalize uploads to {IMAGE_POLICY.format.toUpperCase()} at up to {IMAGE_POLICY.maxDimension}px. Imported remote images will follow this same storage policy when brought fully in-house.
          </p>
          <p className="mt-2 text-emerald-200">Verification preview: {verificationPreview}%</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {verificationChecklist.map((item) => (
              <span key={item.field} className={`rounded-full border px-2 py-1 ${item.filled ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-white/45"}`}>
                {item.filled ? "✓ " : ""}{item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/import/bulk" className="underline">Bulk import</Link>
          <Link href="/tags" className="underline">← Back to database</Link>
        </div>
      </div>

      <form onSubmit={onImport} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <label htmlFor="source-url-import" className="block text-sm text-white/80">Source URL</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="source-url-import"
            name="source-url-import"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/product/..."
            className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
          />
          <button type="submit" disabled={busy || !url.trim()} className="rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50">
            {busy ? "Importing…" : "Fetch product"}
          </button>
        </div>
      </form>

      <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field field="brand" label="Brand" value={form.brand} onChange={(v) => update("brand", v)} />
            <Field field="productName" label="Product name" value={form.productName} onChange={(v) => update("productName", v)} />
            <Field field="rn" label="RN" value={form.rn} onChange={(v) => update("rn", v)} />
            <Field field="styleNumber" label="Style number" value={form.styleNumber} onChange={(v) => update("styleNumber", v)} />
            <Field field="garmentType" label="Garment type" value={form.garmentType} onChange={(v) => update("garmentType", v)} />
            <Field field="size" label="Primary size" value={form.size} onChange={(v) => update("size", v)} />
            <Field field="availableSizes" label="Available sizes (comma separated)" value={form.availableSizes} onChange={(v) => update("availableSizes", v)} />
            <Field field="tags" label="Tags (comma separated)" value={form.tags} onChange={(v) => update("tags", v)} />
            <Select field="category" label="Category" value={form.category} onChange={(v) => update("category", v)} options={["", ...CATEGORY_OPTIONS]} />
            <Field field="subCategory" label="Sub-category" value={form.subCategory} onChange={(v) => update("subCategory", v)} />
            <Field field="gender" label="Gender / fit" value={form.gender} onChange={(v) => update("gender", v)} />
            <Field field="year" label="Year" value={form.year} onChange={(v) => update("year", v)} />
            <Field field="season" label="Season / collection" value={form.season} onChange={(v) => update("season", v)} />
            <Field field="madeIn" label="Made in" value={form.madeIn} onChange={(v) => update("madeIn", v)} />
            <Field field="materials" label="Materials" value={form.materials} onChange={(v) => update("materials", v)} />
            <Field field="color" label="Color" value={form.color} onChange={(v) => update("color", v)} />
          </div>

          <TextArea field="careText" label="Care text" value={form.careText} onChange={(v) => update("careText", v)} rows={4} />
          <TextArea field="notes" label="Notes" value={form.notes} onChange={(v) => update("notes", v)} rows={6} />
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Field field="imageUrl" label="Primary image URL" value={form.imageUrl} onChange={(v) => update("imageUrl", v)} />
          {form.imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.imageUrl} alt={form.productName || form.brand || "record preview"} className="w-full object-contain max-h-96" />
            </div>
          )}
          <TextArea field="extraImageUrls" label="Extra image URLs (one per line)" value={form.extraImageUrls} onChange={(v) => update("extraImageUrls", v)} rows={5} />
          <Field field="sourceUrl" label="Source URL" value={form.sourceUrl} onChange={(v) => update("sourceUrl", v)} />
          <Field field="sourceName" label="Source name" value={form.sourceName} onChange={(v) => update("sourceName", v)} />

          <div className="grid gap-4 md:grid-cols-2">
            <Select field="sourceType" label="Source type" value={form.sourceType} onChange={(v) => update("sourceType", v as SourceType)} options={["manual", "official", "marketplace", "archive", "resale", "unknown"]} />
            <Select
              field="verificationStatus"
              label="Verification"
              value={form.verificationStatus}
              onChange={(v) => update("verificationStatus", v as VerificationStatus)}
              options={
                isAdmin
                  ? ["draft", "needs_info", "pending", "reviewed", "verified", "rejected"]
                  : Array.from(new Set(["draft", "needs_info", "pending", form.verificationStatus]))
              }
              disabled={!isAdmin && elevatedVerificationStatus(form.verificationStatus)}
            />
          </div>

          <Field field="confidence" label="Confidence (0-1)" value={form.confidence} onChange={(v) => update("confidence", v)} />
          <label className="flex items-center gap-2 text-sm text-white/78">
            <input type="checkbox" className="accent-emerald-400" checked={hostImportedImage} onChange={(e) => setHostImportedImage(e.target.checked)} />
            Re-host and normalize imported primary image into Tagsheep storage
          </label>
          <Link href="/upload-guide" className="block text-sm underline text-white/75">Read the upload & photo guide</Link>

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

          <button type="submit" disabled={saving || !canSave} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save live record"}
          </button>
        </div>
      </form>

      {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
    </main>
  );
}

function Field({ field, label, value, onChange }: { field: string; label: string; value: string; onChange: (value: string) => void }) {
  const id = `import-${field}`;
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <input id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
    </label>
  );
}

function TextArea({ field, label, value, onChange, rows = 4 }: { field: string; label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  const id = `import-${field}`;
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <textarea id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
    </label>
  );
}

function Select({ field, label, value, onChange, options, disabled }: { field: string; label: string; value: string; onChange: (value: string) => void; options: string[]; disabled?: boolean }) {
  const id = `import-${field}`;
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm text-white/80">{label}</span>
      <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60 disabled:opacity-50">
        {options.map((option) => (
          <option key={option} value={option}>{option || "— none —"}</option>
        ))}
      </select>
    </label>
  );
}

// Mirrors elevatedVerificationStatus() in firestore.rules -- these three
// states are admin judgement calls, not something a self-submitter should
// be able to grant their own tag.
function elevatedVerificationStatus(status: string) {
  return status === "reviewed" || status === "verified" || status === "rejected";
}
