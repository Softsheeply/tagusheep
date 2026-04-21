"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { prepareRecord, type SourceType, type VerificationStatus } from "@/lib/records";
import { scrapeProductUrl } from "@/lib/scrape";

type FormState = {
  brand: string;
  productName: string;
  rn: string;
  styleNumber: string;
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
  verificationStatus: "pending",
};

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyState);

  const canSave = useMemo(() => !!form.imageUrl.trim() && !!form.brand.trim(), [form]);

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
        verificationStatus: (data.verificationStatus as VerificationStatus) || "pending",
      });
      setMessage("Imported product data. Review and save when ready.");
    } catch (error: any) {
      setMessage(error?.message || "Import failed.");
    } finally {
      setBusy(false);
    }
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
      const payload = prepareRecord({
        brand: form.brand,
        productName: form.productName,
        rn: form.rn,
        styleNumber: form.styleNumber,
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
        imageUrl: form.imageUrl,
        extraImageUrls: form.extraImageUrls.split(/\r?\n/).map((v) => v.trim()).filter(Boolean),
        sourceUrl: form.sourceUrl,
        sourceName: form.sourceName,
        sourceType: form.sourceType,
        confidence: form.confidence ? Number(form.confidence) : null,
        verificationStatus: form.verificationStatus,
        createdBy: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        importedAt: new Date().toISOString(),
      });

      await addDoc(collection(db, "tags"), payload);
      setMessage("Record saved to TaguSheep.");
      setForm(emptyState);
      setUrl("");
    } catch (error: any) {
      setMessage(error?.message || "Save failed.");
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
            Paste a real product or listing URL. TaguSheep will fetch the page, extract structured data, and let you save a live record with review status, source metadata, and searchable fields.
          </p>
        </div>
        <Link href="/tags" className="text-sm underline">← Back to database</Link>
      </div>

      <form onSubmit={onImport} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <label className="block text-sm text-white/80">Source URL</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/product/..."
            className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
          >
            {busy ? "Importing…" : "Fetch product"}
          </button>
        </div>
      </form>

      <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Brand" value={form.brand} onChange={(v) => update("brand", v)} />
            <Field label="Product name" value={form.productName} onChange={(v) => update("productName", v)} />
            <Field label="RN" value={form.rn} onChange={(v) => update("rn", v)} />
            <Field label="Style number" value={form.styleNumber} onChange={(v) => update("styleNumber", v)} />
            <Field label="Category" value={form.category} onChange={(v) => update("category", v)} />
            <Field label="Sub-category" value={form.subCategory} onChange={(v) => update("subCategory", v)} />
            <Field label="Gender / fit" value={form.gender} onChange={(v) => update("gender", v)} />
            <Field label="Year" value={form.year} onChange={(v) => update("year", v)} />
            <Field label="Season / collection" value={form.season} onChange={(v) => update("season", v)} />
            <Field label="Made in" value={form.madeIn} onChange={(v) => update("madeIn", v)} />
            <Field label="Materials" value={form.materials} onChange={(v) => update("materials", v)} />
            <Field label="Color" value={form.color} onChange={(v) => update("color", v)} />
          </div>

          <TextArea label="Care text" value={form.careText} onChange={(v) => update("careText", v)} rows={4} />
          <TextArea label="Notes" value={form.notes} onChange={(v) => update("notes", v)} rows={6} />
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <Field label="Primary image URL" value={form.imageUrl} onChange={(v) => update("imageUrl", v)} />
          {form.imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.imageUrl} alt={form.productName || form.brand || "record preview"} className="w-full object-contain max-h-96" />
            </div>
          )}
          <TextArea label="Extra image URLs (one per line)" value={form.extraImageUrls} onChange={(v) => update("extraImageUrls", v)} rows={5} />
          <Field label="Source URL" value={form.sourceUrl} onChange={(v) => update("sourceUrl", v)} />
          <Field label="Source name" value={form.sourceName} onChange={(v) => update("sourceName", v)} />

          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Source type"
              value={form.sourceType}
              onChange={(v) => update("sourceType", v as SourceType)}
              options={["manual", "official", "marketplace", "archive", "resale", "unknown"]}
            />
            <Select
              label="Verification"
              value={form.verificationStatus}
              onChange={(v) => update("verificationStatus", v as VerificationStatus)}
              options={["draft", "pending", "reviewed", "verified", "rejected"]}
            />
          </div>

          <Field label="Confidence (0-1)" value={form.confidence} onChange={(v) => update("confidence", v)} />

          <button
            type="submit"
            disabled={saving || !canSave}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save live record"}
          </button>
        </div>
      </form>

      {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
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
