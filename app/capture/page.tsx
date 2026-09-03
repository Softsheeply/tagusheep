"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminGate from "@/app/components/AdminGate";
import { auth } from "@/lib/firebase";
import { createOcrWorker, recognizeTagPhoto } from "@/lib/ocr";
import { normalizeCaptureImage } from "@/lib/images";
import type { CaptureFields, CaptureStopReason } from "@/lib/capture-policy";
import { extractFreeCapture, suggestPhotoRoles, type FreeOcrInput, type PhotoRole } from "@/lib/free-capture";

type Photo = { id: string; file: File; previewUrl: string; role: PhotoRole };
type Duplicate = { id: string; brand?: string; productName?: string; rn?: string; styleNumber?: string; imageUrl?: string; thumbnailUrl?: string; matchReason: string };
type Success = { id: string; brand?: string; identifier?: string; thumbnailUrl?: string; updatedExisting?: boolean };

const ROLES: PhotoRole[] = ["full garment", "brand label", "RN/style tag", "materials/care tag", "detail"];
const DEFAULT_ROLES: PhotoRole[] = ["full garment", "brand label", "RN/style tag", "materials/care tag"];
const MAX_REQUEST_BYTES = 3_800_000;

function isWebsitePhoto(role: PhotoRole) {
  return role === "full garment" || role === "detail";
}
const STOP_LABELS: Record<CaptureStopReason, string> = {
  no_usable_image: "No usable image was found.",
  missing_brand: "Brand is missing.",
  low_brand_confidence: "Brand confidence is low—check it below.",
  conflicting_brands: "Multiple conflicting brands were detected.",
  missing_identifier_or_description: "Add an RN/CA, style number, or useful product description.",
  conflicting_identifiers: "Conflicting RN/CA or style numbers were detected.",
  duplicate: "A probable duplicate needs your decision.",
};

const EMPTY_FIELDS: CaptureFields = { brand: "", productName: "", rn: "", styleNumber: "", size: "", color: "", category: "", subCategory: "", garmentType: "", gender: "", materials: "", careText: "", madeIn: "", notes: "", tags: [] };

export default function CapturePage() {
  return (
    <AdminGate title="Instant capture" description="Owner-only garment analysis and upload.">
      <CaptureTool />
    </AdminGate>
  );
}

function CaptureTool() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [normalizedFiles, setNormalizedFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<CaptureFields>(EMPTY_FIELDS);
  const [stopReasons, setStopReasons] = useState<CaptureStopReason[]>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [phase, setPhase] = useState<"idle" | "working" | "review" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState<Success | null>(null);
  const [autoNext, setAutoNext] = useState(false);
  const [usePaidAi, setUsePaidAi] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const photosRef = useRef<Photo[]>([]);

  useEffect(() => {
    setAutoNext(localStorage.getItem("tagsheep:auto-next-capture") === "true");
    setUsePaidAi(localStorage.getItem("tagsheep:paid-ai-capture") === "true");
  }, []);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl)), []);

  const busy = phase === "working";
  const canAnalyze = photos.length > 0 && !busy;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = Math.max(0, 8 - photos.length);
    const picked = Array.from(list).filter((file) => file.type.startsWith("image/")).slice(0, room);
    setPhotos((current) => [...current, ...picked.map((file, index) => ({
      id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), role: DEFAULT_ROLES[current.length + index] || "detail",
    }))]);
    setPhase("idle");
    setMessage("");
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  async function authHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in as a TagSheep admin first.");
    return { authorization: `Bearer ${await user.getIdToken()}` };
  }

  async function parseResponse(response: Response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error || `Request failed (${response.status}).`) as Error & { payload?: typeof payload };
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function analyzeAndUpload() {
    if (!canAnalyze) return;
    setPhase("working"); setMessage("Normalizing photos…"); setProgress(5); setStopReasons([]); setDuplicates([]); setSuccess(null);
    try {
      const normalized: File[] = [];
      for (let index = 0; index < photos.length; index++) {
        normalized.push(await normalizeCaptureImage(photos[index].file));
        setProgress(5 + Math.round(((index + 1) / photos.length) * 20));
      }
      const requestBytes = normalized.reduce((total, file) => total + file.size, 0);
      if (requestBytes > MAX_REQUEST_BYTES) {
        throw new Error(`These photos are still ${(requestBytes / 1_000_000).toFixed(1)} MB after compression. Remove one photo and retry.`);
      }
      setNormalizedFiles(normalized);

      setMessage("Reading labels with OCR…");
      const worker = await createOcrWorker();
      const freeOcrInputs: FreeOcrInput[] = [];
      try {
        for (let index = 0; index < normalized.length; index++) {
          const result = await recognizeTagPhoto(worker, normalized[index]);
          freeOcrInputs.push({ role: photos[index].role, ...result });
          setProgress(25 + Math.round(((index + 1) / normalized.length) * 20));
        }
      } finally {
        await worker.terminate();
      }

      // Default phone order often puts a tag first; OCR-based roles fix free extraction
      // and ensure the garment photo (not a tag) is what gets saved on the record.
      const suggestedRoles = suggestPhotoRoles(freeOcrInputs);
      const roleAdjusted = freeOcrInputs.map((input, index) => ({
        ...input,
        role: suggestedRoles[index] || input.role,
      }));
      setPhotos((current) =>
        current.map((photo, index) => ({ ...photo, role: suggestedRoles[index] || photo.role }))
      );

      setMessage(usePaidAi ? "Analyzing this garment with AI…" : "Extracting tag information for free…"); setProgress(50);
      const body = new FormData();
      normalized.forEach((file) => body.append("images", file));
      roleAdjusted.forEach((input) => body.append("ocrText", `${input.role}: ${input.rawText}`));
      body.set("mode", usePaidAi ? "ai" : "free");
      body.set("websiteImageCount", String(roleAdjusted.filter((input) => isWebsitePhoto(input.role as PhotoRole)).length));
      if (!usePaidAi) body.set("freeExtracted", JSON.stringify(extractFreeCapture(roleAdjusted)));
      const analyzed = await parseResponse(await fetch("/api/capture/analyze", { method: "POST", headers: await authHeaders(), body }));
      setFields(analyzed.extracted || EMPTY_FIELDS);
      setStopReasons(analyzed.stopReasons || []);
      setDuplicates(analyzed.duplicates || []);
      setProgress(70);

      if (analyzed.instantUpload) {
        await upload(websiteFiles(normalized, suggestedRoles), { ...analyzed.extracted, mainImageIndex: 0 }, "create");
      } else {
        const emptyFree =
          !usePaidAi &&
          !analyzed.extracted?.brand &&
          !analyzed.extracted?.rn &&
          !analyzed.extracted?.styleNumber;
        setPhase("review");
        setMessage(
          emptyFree
            ? "Free OCR could not read enough tag text. Check photo roles, retake closer label photos, or turn on paid AI."
            : "Review the extracted information below."
        );
        setProgress(70);
      }
    } catch (error: unknown) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Capture failed. Your photos are still here.");
      setProgress(0);
    }
  }

  async function upload(files: File[], extracted: CaptureFields, action: "create" | "reviewed_create" | "create_separate" | "update_existing", existingId = "") {
    setPhase("working"); setMessage(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"}…`); setProgress(75);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("images", file));
      body.set("extracted", JSON.stringify(extracted));
      body.set("action", action);
      if (existingId) body.set("existingId", existingId);
      const result = await parseResponse(await fetch("/api/capture/upload", { method: "POST", headers: await authHeaders(), body }));
      setProgress(100); setSuccess(result); setPhase("success"); setMessage("Uploaded to TagSheep");
      if (autoNext) window.setTimeout(resetCapture, 1200);
    } catch (error: unknown) {
      const payload = error instanceof Error && "payload" in error ? (error as Error & { payload?: { stopReasons?: CaptureStopReason[]; duplicates?: Duplicate[] } }).payload : null;
      if (payload?.stopReasons) setStopReasons(payload.stopReasons);
      if (payload?.duplicates) setDuplicates(payload.duplicates);
      setPhase("error"); setMessage(error instanceof Error ? error.message : "Upload failed. No record was created."); setProgress(0);
    }
  }

  async function uploadReviewed(action: "reviewed_create" | "create_separate" | "update_existing", existingId = "") {
    try {
      const files = normalizedFiles.length === photos.length ? normalizedFiles : await Promise.all(photos.map((photo) => normalizeCaptureImage(photo.file)));
      await upload(websiteFiles(files), { ...fields, mainImageIndex: 0 }, action, existingId);
    } catch (error: unknown) {
      setPhase("error"); setMessage(error instanceof Error ? error.message : "Could not prepare the photos.");
    }
  }

  function websiteFiles(files: File[], roles?: PhotoRole[]) {
    const selected = files
      .map((file, index) => ({ file, role: roles?.[index] || photos[index]?.role }))
      .filter((item) => item.role && isWebsitePhoto(item.role))
      .sort((left, right) => Number(right.role === "full garment") - Number(left.role === "full garment"))
      .map((item) => item.file);
    // Always keep at least one image on the record even if roles were all tag/label.
    return selected.length ? selected : files.slice(0, 1);
  }

  function resetCapture() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]); setNormalizedFiles([]); setFields(EMPTY_FIELDS); setStopReasons([]); setDuplicates([]); setSuccess(null); setMessage(""); setProgress(0); setPhase("idle");
  }

  function updateField(key: keyof CaptureFields, value: string) {
    setFields((current) => ({ ...current, [key]: key === "tags" ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : value }));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin capture</p>
          <h1 className="mt-1 text-3xl font-semibold">Instant garment uploader</h1>
          <p className="mt-2 max-w-xl text-sm text-white/65">Add every photo for one garment, then analyze and upload it as one reviewed TagSheep record.</p>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={usePaidAi} onChange={(event) => { setUsePaidAi(event.target.checked); localStorage.setItem("tagsheep:paid-ai-capture", String(event.target.checked)); }} />
            Use paid AI analysis
          </label>
          <p className="max-w-xs text-xs text-white/45">{usePaidAi ? "AI reads the whole garment and labels. API charges apply." : "Free mode: on-device OCR reads printed tag text only (no style guesses). No AI charge."}</p>
          <label className="flex items-center gap-2 text-sm text-white/65">
            <input type="checkbox" checked={autoNext} onChange={(event) => { setAutoNext(event.target.checked); localStorage.setItem("tagsheep:auto-next-capture", String(event.target.checked)); }} />
            Automatically start next capture
          </label>
        </div>
      </div>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
      <input ref={libraryInput} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />

      {phase !== "success" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cameraInput.current?.click()} disabled={busy || photos.length >= 8} className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-4 font-medium text-emerald-100 disabled:opacity-40">Take photo</button>
            <button type="button" onClick={() => libraryInput.current?.click()} disabled={busy || photos.length >= 8} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-4 font-medium text-white/80 disabled:opacity-40">Choose photos</button>
          </div>

          {photos.length > 0 && (
            <div className="mt-5">
              <p className="mb-3 text-xs text-white/55">Best order: full garment, brand label, RN/style tag, care tag. Roles auto-adjust after OCR if the order was off. Only full-garment and detail photos are saved on the record.</p>
              <div className="grid gap-3 sm:grid-cols-2">
              {photos.map((photo) => (
                <div key={photo.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={photo.role} className="h-24 w-24 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <select value={photo.role} onChange={(event) => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, role: event.target.value as PhotoRole } : item))} className="w-full rounded-lg border border-white/15 bg-[#09111f] px-2 py-2 text-sm">
                      {ROLES.map((role) => <option key={role}>{role}</option>)}
                    </select>
                    <div className="truncate text-xs text-white/45">{photo.file.name}</div>
                    <button type="button" onClick={() => removePhoto(photo.id)} disabled={busy} className="text-xs text-rose-300/80 underline">Remove</button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          <button type="button" onClick={analyzeAndUpload} disabled={!canAnalyze} className="mt-5 w-full rounded-2xl bg-emerald-400 px-5 py-4 text-lg font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-40">Analyze and upload</button>
        </>
      )}

      {(busy || phase === "error") && message && (
        <div className={`mt-5 rounded-2xl border p-4 ${phase === "error" ? "border-rose-300/25 bg-rose-400/10" : "border-emerald-300/20 bg-emerald-400/5"}`}>
          <div className="flex justify-between gap-3 text-sm"><span>{message}</span><span>{progress}%</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>
          {phase === "error" && <button type="button" onClick={analyzeAndUpload} className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm">Retry</button>}
        </div>
      )}

      {(phase === "review" || (phase === "error" && Boolean(fields.brand || fields.productName || fields.rn || fields.styleNumber))) && (
        <section className="mt-6 space-y-5 rounded-2xl border border-amber-300/20 bg-amber-400/5 p-5">
          <div><h2 className="text-xl font-semibold">Check extracted information</h2><p className="mt-1 text-sm text-white/60">Nothing has been added to Firestore yet.</p></div>
          {stopReasons.length > 0 && <ul className="space-y-1 text-sm text-amber-200">{stopReasons.map((reason) => <li key={reason}>• {STOP_LABELS[reason]}</li>)}</ul>}
          <CaptureForm fields={fields} onChange={updateField} />

          {duplicates.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold">Probable duplicate</h3>
              {duplicates.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/15 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.thumbnailUrl || item.imageUrl ? <img src={item.thumbnailUrl || item.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" /> : null}
                    <div><Link href={`/tag/${item.id}`} className="font-medium underline">{item.brand || "Existing record"} {item.productName || ""}</Link><div className="text-xs text-white/50">{item.styleNumber ? `Style ${item.styleNumber}` : item.rn ? `RN ${item.rn}` : item.matchReason} · {item.matchReason}</div></div>
                  </div>
                  <button type="button" onClick={() => uploadReviewed("update_existing", item.id)} className="mt-3 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-medium text-black sm:mt-0">Add photos/details to existing record</button>
                </div>
              ))}
              <button type="button" onClick={() => uploadReviewed("create_separate")} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Create separate record</button>
            </div>
          ) : (
            <button type="button" onClick={() => uploadReviewed("reviewed_create")} className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-black">Upload reviewed record</button>
          )}
        </section>
      )}

      {phase === "success" && success && (
        <section className="rounded-3xl border border-emerald-300/25 bg-emerald-400/10 p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {success.thumbnailUrl && <img src={success.thumbnailUrl} alt="Uploaded garment" className="mx-auto h-36 w-36 rounded-2xl object-cover" />}
          <h2 className="mt-4 text-2xl font-semibold">Uploaded to TagSheep</h2>
          <p className="mt-2 text-white/70">{success.brand || "Garment"}{success.identifier ? ` · ${success.identifier}` : ""}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={`/tag/${success.id}`} className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-black">Open saved record</Link>
            <button type="button" onClick={resetCapture} className="rounded-xl border border-white/20 px-5 py-3">Capture next item</button>
          </div>
        </section>
      )}
    </main>
  );
}

function CaptureForm({ fields, onChange }: { fields: CaptureFields; onChange: (key: keyof CaptureFields, value: string) => void }) {
  const entries: Array<[keyof CaptureFields, string, boolean]> = [
    ["brand", "Brand", true], ["productName", "Searchable product title", true], ["rn", "RN / CA", false], ["styleNumber", "Style / SN", false],
    ["size", "Size", false], ["color", "Color", false], ["category", "Category", false], ["subCategory", "Sub-category", false],
    ["garmentType", "Garment type", false], ["gender", "Gender / fit", false], ["madeIn", "Made in", false], ["materials", "Materials", true],
    ["careText", "Care text", true], ["notes", "Visible design details", true], ["tags", "Tags, comma separated", false],
  ];
  return <div className="grid gap-3 sm:grid-cols-2">{entries.map(([key, label, multiline]) => {
    const value = key === "tags" ? (fields.tags || []).join(", ") : String(fields[key] || "");
    const className = "w-full rounded-xl border border-white/15 bg-[#09111f] px-3 py-2 text-sm outline-none focus:border-emerald-300/60";
    return <label key={key} className={multiline ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs text-white/50">{label}</span>{multiline ? <textarea value={value} rows={key === "careText" ? 4 : 2} onChange={(event) => onChange(key, event.target.value)} className={className} /> : <input value={value} onChange={(event) => onChange(key, event.target.value)} className={className} />}</label>;
  })}</div>;
}
