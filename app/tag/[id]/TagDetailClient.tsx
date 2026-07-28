"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import SmartImage from "@/app/components/SmartImage";
import { auth, db, storage } from "@/lib/firebase";
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, startAt, endAt, limit as qlimit, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from "firebase/storage";
import { buildSearchText, getVerificationPercent, normalizeBrand, normalizeRn, normalizeStyleNumber, type SourceType, type VerificationStatus } from "@/lib/records";
import { safeHostnameFromUrl } from "@/lib/validation";
import { IMAGE_POLICY, normalizeThumbnailImage, normalizeUploadedImage } from "@/lib/images";

type TagDoc = {
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  garmentType?: string | null;
  size?: string | null;
  availableSizes?: string[];
  tags?: string[];
  category?: string | null;
  color?: string | null;
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
  extraImageUrls?: string[];
  storagePath?: string | null;
  createdBy?: string | null;
  createdAt?: unknown;
};

export default function TagDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const id = useMemo(() => pathname?.split("/").pop() ?? "", [pathname]);

  const [tag, setTag] = useState<TagDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [availableSizes, setAvailableSizes] = useState("");
  const [year, setYear] = useState("");
  const [madeIn, setMadeIn] = useState("");
  const [materials, setMaterials] = useState("");
  const [careText, setCareText] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("unknown");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("pending");

  const [similarTags, setSimilarTags] = useState<(TagDoc & { id: string })[]>([]);
  const [rnBrandSuggestions, setRnBrandSuggestions] = useState<string[]>([]);
  const [brandAutocomplete, setBrandAutocomplete] = useState<string[]>([]);
  const rnDebounce = useRef<number | null>(null);
  const brandDebounce = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      let snap;
      try {
        snap = await getDoc(doc(db, "tags", id));
      } catch {
        setLoading(false);
        setLoadError(true);
        return;
      }
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
      setColor(data.color ?? "");
      setSize(data.size ?? "");
      setAvailableSizes((data.availableSizes || []).join(", "));
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
      } else if (uid) {
        try {
          const adminSnap = await getDoc(doc(db, "admins", uid));
          if (adminSnap.exists()) setCanEdit(true);
        } catch {}
      }

      // Load similar tags (same RN, or same brand if no RN)
      try {
        const similarQ = data.rn
          ? query(collection(db, "tags"), where("rn", "==", data.rn), qlimit(7))
          : data.brand
            ? query(collection(db, "tags"), where("brand", "==", data.brand), qlimit(7))
            : null;
        if (similarQ) {
          const simSnap = await getDocs(similarQ);
          setSimilarTags(simSnap.docs.filter((d) => d.id !== snap.id).slice(0, 6).map((d) => ({ id: d.id, ...(d.data() as TagDoc) })));
        }
      } catch {}
    })();
  }, [id]);

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

  const rnWarning = !rn
    ? null
    : !/^\d+$/.test(rn)
      ? "RN must be digits only."
      : rn.length < 3
        ? "RN looks too short."
        : rn.length > 7
          ? "RN looks too long."
          : null;

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

  useEffect(() => {
    if (!brand) {
      setBrandAutocomplete([]);
    }
    if (!rn) {
      setRnBrandSuggestions([]);
    }
  }, [brand, rn]);

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
        const uid = auth.currentUser?.uid;
        if (!uid) {
          throw new Error("You must be signed in to replace the image.");
        }
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

      const cleanBrand = normalizeBrand(brand);
      const cleanStyleNumber = normalizeStyleNumber(styleNumber);
      const cleanRn = normalizeRn(rn);
      const cleanProductName = productName.trim() || null;
      const cleanGarmentType = garmentType.trim() || null;
      const cleanTags = tags.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 25);
      const cleanCategory = category.trim() || null;
      const cleanColor = color.trim() || null;
      const cleanSize = size.trim() || null;
      const cleanAvailableSizes = availableSizes.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 20);
      const cleanYear = year.trim() || null;
      const cleanMadeIn = madeIn.trim() || null;
      const cleanMaterials = materials.trim() || null;
      const cleanCareText = careText.trim() || null;
      const cleanNotes = notes.trim() || null;
      const cleanSourceUrl = sourceUrl.trim() || null;
      const cleanSourceName = safeHostnameFromUrl(cleanSourceUrl || "") || null;

      const payload: Record<string, unknown> = {
        imageUrl,
        thumbnailUrl,
        sourceType,
        verificationStatus,
        searchText: buildSearchText({
          brand: cleanBrand,
          productName: cleanProductName,
          rn: cleanRn,
          styleNumber: cleanStyleNumber,
          garmentType: cleanGarmentType,
          size: cleanSize,
          category: cleanCategory,
          year: cleanYear,
          madeIn: cleanMadeIn,
          materials: cleanMaterials,
          careText: cleanCareText,
          color: cleanColor,
          notes: cleanNotes,
          sourceName: cleanSourceName,
        }),
        storagePath,
        createdBy: tag.createdBy || auth.currentUser?.uid || null,
        createdAt: tag.createdAt || null,
      };

      if (cleanBrand) payload.brand = cleanBrand;
      if (cleanProductName) payload.productName = cleanProductName;
      if (cleanRn) payload.rn = cleanRn;
      if (cleanStyleNumber) payload.styleNumber = cleanStyleNumber;
      if (cleanGarmentType) payload.garmentType = cleanGarmentType;
      if (cleanSize) payload.size = cleanSize;
      if (cleanCategory) payload.category = cleanCategory;
      if (cleanYear) payload.year = cleanYear;
      if (cleanMadeIn) payload.madeIn = cleanMadeIn;
      if (cleanMaterials) payload.materials = cleanMaterials;
      if (cleanCareText) payload.careText = cleanCareText;
      if (cleanColor) payload.color = cleanColor;
      if (cleanNotes) payload.notes = cleanNotes;
      if (cleanSourceUrl) payload.sourceUrl = cleanSourceUrl;
      if (cleanSourceName) payload.sourceName = cleanSourceName;
      if (cleanTags.length > 0) payload.tags = cleanTags;
      if (cleanAvailableSizes.length > 0) payload.availableSizes = cleanAvailableSizes;

      await updateDoc(doc(db, "tags", id), payload);
      setTag({ ...(tag as TagDoc), ...(payload as TagDoc) });
      setNewFile(null);
      setStatus({ kind: "success", text: "Saved ✅" });
      setTimeout(() => setStatus({ kind: "idle", text: null }), 1200);
    } catch (err: unknown) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
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
    } catch (err: unknown) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  if (loading) return <main className="max-w-3xl mx-auto p-6">Loading…</main>;
  if (loadError) {
    return (
      <main className="max-w-3xl mx-auto space-y-4 p-6 text-center">
        <p className="text-white/60">Couldn&apos;t load this tag. Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
        >
          Retry
        </button>
      </main>
    );
  }
  if (!tag) return <main className="max-w-3xl mx-auto p-6">Not found.</main>;

  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID!;
  const bucket = process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET!;
  const storageLink = consoleStorageUrl(projectId, bucket, tag.storagePath);

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3 text-sm text-white/50">
        <Link href="/tags" className="transition hover:text-white">← Browse</Link>
        <span>/</span>
        <span className="text-white/80">{tag.brand || "Tag"}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(340px,0.85fr)_minmax(420px,1.15fr)] items-start">
        <div className="space-y-4 sticky top-6 self-start">
          {tag.imageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tag.imageUrl} alt={tag.brand ?? "tag"} className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-emerald-300/20 bg-emerald-400/8 p-6 text-center space-y-3">
              <svg className="mx-auto h-10 w-10 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>
              <div>
                <div className="font-medium text-white">No photo for this tag yet</div>
                <p className="mt-1 text-sm text-white/60">Own this item or seen it before? Be the first to snap the label.</p>
              </div>
              <Link
                href={`/upload?${new URLSearchParams({ ...(tag.brand ? { brand: tag.brand } : {}), ...(tag.rn ? { rn: tag.rn } : {}), ...(tag.styleNumber ? { styleNumber: tag.styleNumber } : {}) }).toString()}`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
              >
                Submit a photo
              </Link>
            </div>
          )}

          {tag.extraImageUrls && tag.extraImageUrls.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Extra detail photos</div>
                <p className="mt-1 text-sm text-white/65">Additional tag angles, RN closeups, care labels, or supporting garment details.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tag.extraImageUrls.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="relative block aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-white/25">
                    <SmartImage src={url} alt={`${tag.brand || "tag"} detail ${index + 1}`} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            <a href={tag.imageUrl} target="_blank" rel="noreferrer" className="rounded border border-white/15 px-3 py-1 hover:border-white/40 transition">Open image</a>
            {canEdit && (
              <a href={storageLink} target="_blank" rel="noreferrer" className="rounded border border-white/15 px-3 py-1 hover:border-emerald-300/50 transition">
                Open in Storage
              </a>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {/* ── Identity hero ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Brand</div>
              <h1 className="mt-1 text-3xl font-bold text-white leading-tight">{tag.brand || "Unknown brand"}</h1>
              {tag.productName && <div className="mt-1 text-base text-white/60">{tag.productName}</div>}
            </div>

            {(tag.rn || tag.styleNumber) && (
              <div className="flex flex-wrap gap-3">
                {tag.rn && (
                  <Link href={`/rn/${tag.rn}`} className="group rounded-xl border border-emerald-300/25 bg-emerald-400/8 px-4 py-2.5 transition hover:border-emerald-300/50 hover:bg-emerald-400/12">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/60">RN Number</div>
                    <div className="mt-0.5 text-xl font-semibold text-emerald-200">{tag.rn}</div>
                    {estimateRnYear(tag.rn) && (
                      <div className="mt-1 text-[10px] text-emerald-300/50">Registered circa {estimateRnYear(tag.rn)}</div>
                    )}
                  </Link>
                )}
                {tag.styleNumber && (
                  <Link href={`/style/${encodeURIComponent(tag.styleNumber)}`} className="group rounded-xl border border-sky-300/25 bg-sky-400/8 px-4 py-2.5 transition hover:border-sky-300/50 hover:bg-sky-400/12">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-sky-300/60">Style Number</div>
                    <div className="mt-0.5 text-xl font-semibold text-sky-200">{tag.styleNumber}</div>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ── Details grid ── */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Meta label="Garment type" value={tag.garmentType} />
            <Meta label="Year / Era" value={tag.year} />
            <Meta label="Color" value={tag.color} />
            <Meta label="Size" value={tag.size || ((tag.availableSizes || []).length ? tag.availableSizes?.join(", ") : null)} />
            <Meta label="Made in" value={tag.madeIn} />
            <Meta label="Category" value={tag.category} />
          </div>

          {tag.materials && (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="mb-1 text-[11px] uppercase tracking-[0.15em] text-white/40">Materials</div>
              <div className="text-sm text-white/80">{tag.materials}</div>
            </div>
          )}
          {tag.careText && (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="mb-1 text-[11px] uppercase tracking-[0.15em] text-white/40">Care text</div>
              <div className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{tag.careText}</div>
            </div>
          )}
          {tag.notes && (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="mb-1 text-[11px] uppercase tracking-[0.15em] text-white/40">Notes</div>
              <div className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{tag.notes}</div>
            </div>
          )}

          {/* ── Badges ── */}
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
            <VerificationBadge status={tag.verificationStatus} />
            <Badge subtle>{getVerificationPercent(tag)}% verified</Badge>
            {tag.sourceType && <Badge subtle>{tag.sourceType}</Badge>}
            {tag.createdBy && <Badge subtle>community submitted</Badge>}
          </div>

          {/* ── Community CTAs (non-admin) ── */}
          {!canEdit && (
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              <Link href={`/submit-info?tag=${id}&mode=correction`} className="rounded-xl border border-emerald-300/30 px-4 py-2 text-emerald-200 transition hover:bg-emerald-400/10">
                Submit a correction
              </Link>
              <Link href={`/submit-info?tag=${id}&mode=report`} className="rounded-xl border border-rose-300/30 px-4 py-2 text-rose-200 transition hover:bg-rose-400/10">
                Report a problem
              </Link>
            </div>
          )}

          {canEdit ? (
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
          <Field label="Color" value={color} onChange={setColor} />
          <Field label="Primary size" value={size} onChange={setSize} />
          <Field label="Available sizes (comma separated)" value={availableSizes} onChange={setAvailableSizes} />
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
          <div className="flex gap-2 flex-wrap">
            <button type="submit" disabled={!canEdit || status.kind === "info"} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
              {status.kind === "info" && status.pct != null ? `Uploading… ${status.pct}%` : status.kind === "info" ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={onMoveToTrash} disabled={!canEdit || status.kind === "info"} className="px-4 py-2 rounded border border-rose-300/35 text-rose-200 disabled:opacity-50">
              Move to Trash
            </button>
          </div>
          </form>
          ) : null}
        </div>
      </div>

      {/* ── Similar tags ── */}
      {similarTags.length > 0 && (
        <section>
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/40">
              {tag.rn ? `Other tags with RN ${tag.rn}` : `Other ${tag.brand || "brand"} tags`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {similarTags.map((s) => (
              <Link key={s.id} href={`/tag/${s.id}`} className="group rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition hover:border-white/25">
                <div className="relative aspect-[4/5] overflow-hidden">
                  {s.thumbnailUrl || s.imageUrl ? (
                    <SmartImage src={s.thumbnailUrl || s.imageUrl} alt={s.brand ?? "tag"} fill sizes="(min-width: 1024px) 16vw, 33vw" className="bg-white object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white/[0.03] text-xs text-white/25">No photo</div>
                  )}
                </div>
                <div className="p-2.5 text-xs">
                  <div className="truncate font-medium text-white">{s.brand || "—"}</div>
                  {s.color && <div className="truncate text-white/50">{s.color}</div>}
                  {s.styleNumber && <div className="truncate text-white/40">Style: {s.styleNumber}</div>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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

function estimateRnYear(rn?: string | null): number | null {
  if (!rn) return null;
  const n = parseInt(rn, 10);
  if (isNaN(n) || n < 1000) return null;
  const year = Math.round((n - 13670) / 2635 + 1959);
  const now = new Date().getFullYear();
  return year >= 1952 && year <= now ? year : null;
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/35">{label}</div>
      <div className="mt-0.5 truncate text-sm text-white">{value?.trim() || <span className="text-white/30">—</span>}</div>
    </div>
  );
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
