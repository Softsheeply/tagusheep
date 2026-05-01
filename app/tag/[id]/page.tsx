"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, startAt, endAt, limit as qlimit, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { prepareRecord, getVerificationPercent, type SourceType, type VerificationStatus } from "@/lib/records";
import { safeHostnameFromUrl } from "@/lib/validation";
import { IMAGE_POLICY, normalizeThumbnailImage, normalizeUploadedImage } from "@/lib/images";

type TagDoc = {
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  garmentType?: string | null;
  tags?: string[];
  category?: string | null;
  year?: string | null;
  madeIn?: string | null;
  materials?: string | null;
  careText?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceType?: SourceType | null;
  verificationStatus?: VerificationStatus | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  storagePath?: string | null;
  createdBy?: string | null;
  createdAt?: any;
};

export default function TagDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const id = useMemo(() => pathname?.split("/").pop() ?? "", [pathname]);

  const [tag, setTag] = useState<TagDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "info" | "success" | "error"; text: string | null; pct?: number }>({ kind: "idle", text: null });

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
  const [sourceType, setSourceType] = useState<SourceType>("unknown");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("pending");

  const [rnWarning, setRnWarning] = useState<string | null>(null);
  const [rnBrandSuggestions, setRnBrandSuggestions] = useState<string[]>([]);
  const [brandAutocomplete, setBrandAutocomplete] = useState<string[]>([]);
  const rnDebounce = useRef<number | null>(null);
  const brandDebounce = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const snap = await getDoc(doc(db, "tags", id));
      if (!snap.exists()) {
        setTag(null);
        setLoading(false);
        return;
      }
      const data = snap.data() as TagDoc;
      setTag(data);
      setBrand(data.brand ?? "");
      setProductName(data.productName ?? "");
      setRn(data.rn ?? "");
      setStyleNumber(data.styleNumber ?? "");
      setGarmentType(data.garmentType ?? "");
      setTags((data.tags || []).join(", "));
      setCategory(data.category ?? "");
      setYear(data.year ?? "");
      setMadeIn(data.madeIn ?? "");
      setMaterials(data.materials ?? "");
      setCareText(data.careText ?? "");
      setNotes(data.notes ?? "");
      setSourceUrl(data.sourceUrl ?? "");
      setSourceType(data.sourceType ?? "unknown");
      setVerificationStatus(data.verificationStatus ?? "pending");
      setLoading(false);

      const uid = auth.currentUser?.uid ?? null;
      if (uid && uid === data.createdBy) {
        setCanEdit(true);
        return;
      }
      if (uid) {
        const adminSnap = await getDoc(doc(db, "admins", uid));
        setCanEdit(adminSnap.exists());
      }
    })();
  }, [id]);

  function handleRnChange(val: string) {
    const digits = val.replace(/\D+/g, "");
    setRn(digits);
  }

  useEffect(() => {
    if (!rn) {
      setRnWarning(null);
      setRnBrandSuggestions([]);
      return;
    }
    if (!/^\d+$/.test(rn)) setRnWarning("RN must be digits only.");
    else if (rn.length < 3) setRnWarning("RN looks too short.");
    else if (rn.length > 7) setRnWarning("RN looks too long.");
    else setRnWarning(null);

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
      setBrandAutocomplete([]);
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

  function consoleStorageUrl(projectId: string, bucket: string, storagePath?: string | null) {
    const base = `https://console.firebase.google.com/project/${projectId}/storage/${bucket}/files`;
    if (!storagePath) return base;
    const encoded = "~2F" + storagePath.split("/").map(encodeURIComponent).join("~2F");
    return `${base}/${encoded}`;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !tag) return;
    if (!canEdit) {
      setStatus({ kind: "error", text: "You don’t have permission to edit." });
      return;
    }
    if (rnWarning) {
      setStatus({ kind: "error", text: rnWarning });
      return;
    }

    try {
      setStatus({ kind: "info", text: "Saving…" });
      let imageUrl = tag.imageUrl;
      let thumbnailUrl = tag.thumbnailUrl ?? null;
      let storagePath = tag.storagePath ?? null;
      if (newFile) {
        if (storagePath) {
          try { await deleteObject(ref(storage, storagePath)); } catch {}
        }
        const file = await normalizeUploadedImage(newFile);
        const thumbnail = await normalizeThumbnailImage(newFile);
        const uid = auth.currentUser?.uid!;
        const baseName = `${Date.now()}_${file.name}`;
        const newPath = `tagusheep/uploads/${uid}/${baseName}`;
        const thumbPath = `tagusheep/uploads/${uid}/thumb_${baseName}`;
        const task = uploadBytesResumable(ref(storage, newPath), file);
        task.on("state_changed", (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setStatus({ kind: "info", text: `Uploading… ${pct}%`, pct });
        });
        await new Promise<void>((res, rej) => task.on("state_changed", undefined, rej, () => res()));
        imageUrl = await getDownloadURL(ref(storage, newPath));
        await uploadBytes(ref(storage, thumbPath), thumbnail, { contentType: IMAGE_POLICY.mimeType });
        thumbnailUrl = await getDownloadURL(ref(storage, thumbPath));
        storagePath = newPath;
      }

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
        sourceUrl,
        sourceName: safeHostnameFromUrl(sourceUrl),
        sourceType,
        verificationStatus,
        imageUrl,
        thumbnailUrl,
        storagePath,
      });

      await updateDoc(doc(db, "tags", id), payload);
      setTag({ ...(tag as TagDoc), ...(payload as TagDoc) });
      setNewFile(null);
      setStatus({ kind: "success", text: "Saved ✅" });
      setTimeout(() => setStatus({ kind: "idle", text: null }), 1200);
    } catch (err: any) {
      setStatus({ kind: "error", text: err?.message || String(err) });
    }
  }

  async function onMoveToTrash() {
    if (!id || !tag) return;
    if (!canEdit) {
      setStatus({ kind: "error", text: "You don’t have permission to delete." });
      return;
    }
    if (!confirm("Move this record to Trash?")) return;

    try {
      setStatus({ kind: "info", text: "Moving to Trash…" });
      const me = auth.currentUser?.uid ?? null;
      const trashDoc = { ...tag, id, originalId: id, trashedAt: new Date().toISOString(), trashedBy: me };
      await setDoc(doc(db, "trash", id), trashDoc);
      await deleteDoc(doc(db, "tags", id));
      setStatus({ kind: "success", text: "Moved to Trash ✅" });
      router.push("/trash");
    } catch (err: any) {
      setStatus({ kind: "error", text: err?.message || String(err) });
    }
  }

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading…</main>;
  if (!tag) return <main className="max-w-3xl mx-auto p-6">Not found.</main>;

  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID!;
  const bucket = process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET!;
  const storageLink = consoleStorageUrl(projectId, bucket, tag.storagePath);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Tagsheep record</p>
          <h1 className="text-2xl font-semibold">{tag.brand || "Unknown brand"}</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/tags" className="underline">← Back to database</Link>
          <Link href="/trash" className="underline">Trash</Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tag.imageUrl} alt={tag.brand ?? "tag"} className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a href={tag.imageUrl} target="_blank" className="rounded border border-white/15 px-3 py-1 hover:border-white/40 transition">Open image</a>
            <a href={storageLink} target="_blank" className="rounded border border-white/15 px-3 py-1 hover:border-emerald-300/50 transition">Open in Storage</a>
            {tag.sourceUrl && <a href={tag.sourceUrl} target="_blank" className="rounded border border-white/15 px-3 py-1 hover:border-emerald-300/50 transition">View source</a>}
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Brand" value={tag.brand} href={tag.brand ? `/brand/${encodeURIComponent(tag.brand)}` : undefined} />
              <InfoBox label="RN" value={tag.rn} href={tag.rn ? `/rn/${encodeURIComponent(tag.rn)}` : undefined} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Product name" value={tag.productName} />
              <InfoBox label="Style number" value={tag.styleNumber} href={tag.styleNumber ? `/style/${encodeURIComponent(tag.styleNumber)}` : undefined} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Garment type" value={tag.garmentType} />
              <InfoBox label="Year" value={tag.year} />
            </div>
            <InfoBox label="Tags" value={(tag.tags || []).join(", ")} />
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Category" value={tag.category} />
              <InfoBox label="Made in" value={tag.madeIn} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Materials" value={tag.materials} />
              <InfoBox label="Source" value={tag.sourceName} />
            </div>
            <InfoBox label="Care text" value={tag.careText} multiline />
            <InfoBox label="Notes" value={tag.notes} multiline />
            <div className="flex flex-wrap gap-2 pt-2 text-[11px] uppercase tracking-wide">
              <VerificationBadge status={tag.verificationStatus} />
              <Badge subtle>{getVerificationPercent(tag)}% verified</Badge>
              {tag.sourceType && <Badge subtle>{tag.sourceType}</Badge>}
              {tag.sourceName && <Badge subtle>{tag.sourceName}</Badge>}
            </div>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <Field label="Brand" value={brand} onChange={setBrand} />
          {brandAutocomplete.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {brandAutocomplete.map((b) => (
                <button key={b} type="button" onClick={() => setBrand(b)} className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition">{b}</button>
              ))}
            </div>
          )}
          <Field label="Product name" value={productName} onChange={setProductName} />
          <Field label="RN" value={rn} onChange={handleRnChange} />
          {rnWarning && <p className="text-xs text-amber-300">{rnWarning}</p>}
          {rnBrandSuggestions.length > 0 && (
            <div>
              <p className="text-xs text-white/70 mb-1">Brands already seen for RN {rn}:</p>
              <div className="flex flex-wrap gap-2">
                {rnBrandSuggestions.map((b) => (
                  <button key={b} type="button" onClick={() => setBrand(b)} className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition">{b}</button>
                ))}
              </div>
            </div>
          )}
          <Field label="Style number" value={styleNumber} onChange={setStyleNumber} />
          <Field label="Garment type" value={garmentType} onChange={setGarmentType} />
          <Field label="Tags (comma separated)" value={tags} onChange={setTags} />
          <Field label="Category" value={category} onChange={setCategory} />
          <Field label="Year" value={year} onChange={setYear} />
          <Field label="Made in" value={madeIn} onChange={setMadeIn} />
          <Field label="Materials" value={materials} onChange={setMaterials} />
          <TextArea label="Care text" value={careText} onChange={setCareText} rows={4} />
          <TextArea label="Notes" value={notes} onChange={setNotes} rows={5} />
          <Field label="Source URL" value={sourceUrl} onChange={setSourceUrl} />
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Source type" value={sourceType} onChange={(v) => setSourceType(v as SourceType)} options={["manual", "official", "marketplace", "archive", "resale", "unknown"]} />
            <Select label="Verification status" value={verificationStatus} onChange={(v) => setVerificationStatus(v as VerificationStatus)} options={["draft", "needs_info", "pending", "reviewed", "verified", "rejected"]} />
          </div>
          <input type="file" accept="image/*" className="w-full border rounded p-2 bg-white text-black" onChange={(e) => setNewFile(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-white/60">Replacement uploads are normalized to {IMAGE_POLICY.format.toUpperCase()} at up to {IMAGE_POLICY.maxDimension}px.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={!canEdit || status.kind === "info"} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
              {status.kind === "info" && status.pct != null ? `Uploading… ${status.pct}%` : status.kind === "info" ? "Saving…" : "Save"}
            </button>
            <button type="button" disabled={!canEdit || status.kind === "info"} onClick={onMoveToTrash} className="px-4 py-2 rounded border border-amber-400 text-amber-300 disabled:opacity-50">Move to Trash</button>
          </div>
          {!canEdit && (
            <div className="space-y-3">
              <p className="text-sm text-amber-300">Only the uploader or an admin can edit.</p>
              <Link href={`/submit-info?tag=${id}`} className="inline-block rounded-xl border border-emerald-300/35 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-400/10 transition">
                Have info on this product? Submit here
              </Link>
            </div>
          )}
        </form>
      </div>

      {status.text && <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg border ${status.kind === "success" ? "bg-emerald-500 text-black border-emerald-400" : status.kind === "error" ? "bg-rose-500 text-white border-rose-400" : "bg-white/10 border-white/20"}`}>{status.text}</div>}
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" /></label>;
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function InfoBox({ label, value, href, multiline = false }: { label: string; value?: string | null; href?: string; multiline?: boolean }) {
  const content = value?.trim() ? value : "—";
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>{href && value ? <Link href={href} className="mt-1 block text-white underline-offset-4 hover:underline">{content}</Link> : <div className={`mt-1 text-white ${multiline ? "whitespace-pre-wrap text-sm leading-6" : ""}`}>{content}</div>}</div>;
}

function Badge({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className={`rounded-full border px-2 py-0.5 ${subtle ? "border-white/15 text-white/55" : "border-emerald-300/35 text-emerald-200"}`}>{children}</span>;
}

function VerificationBadge({ status }: { status?: string | null }) {
  if (status === "verified") {
    return <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">✓ Tagsheep Verified</span>;
  }
  if (status === "reviewed") {
    return <span className="rounded-full border border-sky-300/35 bg-sky-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200">Reviewed</span>;
  }
  if (status === "rejected") {
    return <span className="rounded-full border border-rose-300/35 bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-200">Rejected</span>;
  }
  if (status === "needs_info") {
    return <span className="rounded-full border border-fuchsia-300/35 bg-fuchsia-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-200">Needs Info</span>;
  }
  return <span className="rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">Pending</span>;
}
