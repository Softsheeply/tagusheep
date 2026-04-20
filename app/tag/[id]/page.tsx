"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  startAt,
  endAt,
  limit as qlimit,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

async function readExifOrientation(file: File): Promise<number | null> {
  const buf = await file.slice(0, 64 * 1024).arrayBuffer();
  const view = new DataView(buf);
  let offset = 2;
  const length = view.byteLength;
  if (view.getUint16(0, false) !== 0xffd8) return null;

  while (offset < length) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      const size = view.getUint16(offset, false);
      offset += 2;
      if (view.getUint32(offset, false) === 0x45786966 && view.getUint16(offset + 4, false) === 0x0000) {
        const tiffOffset = offset + 6;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const get16 = (o: number) => view.getUint16(o, little);
        const get32 = (o: number) => view.getUint32(o, little);
        if (get16(tiffOffset + 2) !== 0x002a) return null;
        const firstIFDOffset = get32(tiffOffset + 4);
        if (!firstIFDOffset) return null;

        const dirStart = tiffOffset + firstIFDOffset;
        const entries = get16(dirStart);
        for (let i = 0; i < entries; i++) {
          const entryOffset = dirStart + 2 + i * 12;
          const tag = get16(entryOffset);
          if (tag === 0x0112) return get16(entryOffset + 8) || 1;
        }
        return null;
      } else {
        offset += size - 2;
      }
    } else if ((marker & 0xff00) !== 0xff00) {
      break;
    } else {
      offset += view.getUint16(offset, false);
    }
  }
  return null;
}

function applyCanvasOrientation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  orientation: number
): { dw: number; dh: number } {
  switch (orientation) {
    case 2:
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      return { dw: w, dh: h };
    case 3:
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      return { dw: w, dh: h };
    case 4:
      ctx.translate(0, h);
      ctx.scale(1, -1);
      return { dw: w, dh: h };
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      return { dw: h, dh: w };
    case 6:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -h);
      return { dw: h, dh: w };
    case 7:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(w, -h);
      ctx.scale(-1, 1);
      return { dw: h, dh: w };
    case 8:
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-w, 0);
      return { dw: h, dh: w };
    default:
      return { dw: w, dh: h };
  }
}

async function compressWithExifFix(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  try {
    const orientation = await readExifOrientation(file);
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const srcW = Math.round(bmp.width * scale);
    const srcH = Math.round(bmp.height * scale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    if (orientation && orientation >= 5 && orientation <= 8) {
      canvas.width = srcH;
      canvas.height = srcW;
    } else {
      canvas.width = srcW;
      canvas.height = srcH;
    }
    const { dw, dh } = applyCanvasOrientation(ctx, srcW, srcH, orientation || 1);
    ctx.drawImage(bmp, 0, 0, dw, dh);

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
    if (!blob) return file;
    const name = file.name.replace(/\.(png|jpe?g|gif|webp)$/i, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

type TagDoc = {
  brand?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  notes?: string | null;
  imageUrl: string;
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
  const [brand, setBrand] = useState("");
  const [rn, setRn] = useState("");
  const [styleNumber, setStyleNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [status, setStatus] = useState<{ kind: "idle" | "info" | "success" | "error"; text: string | null; pct?: number }>({ kind: "idle", text: null });
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
      setRn(data.rn ?? "");
      setStyleNumber(data.styleNumber ?? "");
      setNotes(data.notes ?? "");
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
      let storagePath = tag.storagePath ?? null;

      if (newFile) {
        if (storagePath) {
          try {
            await deleteObject(ref(storage, storagePath));
          } catch {}
        }
        const file = await compressWithExifFix(newFile);
        const uid = auth.currentUser?.uid!;
        const newPath = `tagusheep/uploads/${uid}/${Date.now()}_${file.name}`;
        const task = uploadBytesResumable(ref(storage, newPath), file);

        task.on("state_changed", (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setStatus({ kind: "info", text: `Uploading… ${pct}%`, pct });
        });

        await new Promise<void>((res, rej) => task.on("state_changed", undefined, rej, () => res()));
        imageUrl = await getDownloadURL(ref(storage, newPath));
        storagePath = newPath;
      }

      await updateDoc(doc(db, "tags", id), {
        brand: brand.trim() || null,
        rn: rn.trim() || null,
        styleNumber: styleNumber.trim() || null,
        notes: notes.trim() || null,
        imageUrl,
        storagePath,
      });

      setTag({ ...tag, brand, rn, styleNumber, notes, imageUrl, storagePath });
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
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">TaguSheep record</p>
          <h1 className="text-2xl font-semibold">{tag.brand || "Unknown brand"}</h1>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/tags" className="underline">
            ← Back to database
          </Link>
          <Link href="/trash" className="underline">
            Trash
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/76">
        This record is meant to help identify clothing through clear label photography and searchable metadata. Strong records include brand, RN, style number, and useful label notes.
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <a href={tag.imageUrl} target="_blank" className="rounded border border-white/15 px-3 py-1 hover:border-white/40 transition">
          Open image
        </a>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(tag.imageUrl);
              setStatus({ kind: "success", text: "Copied image URL ✅" });
              setTimeout(() => setStatus({ kind: "idle", text: null }), 900);
            } catch {
              setStatus({ kind: "error", text: "Couldn’t copy URL." });
            }
          }}
          className="rounded border border-white/15 px-3 py-1 hover:border-white/40 transition"
        >
          Copy image URL
        </button>
        <a href={storageLink} target="_blank" className="rounded border border-white/15 px-3 py-1 hover:border-emerald-300/50 transition">
          Open in Storage
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tag.imageUrl} alt={tag.brand ?? "tag"} className="h-full w-full object-contain" />
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoBox label="Brand" value={tag.brand} href={tag.brand ? `/brand/${encodeURIComponent(tag.brand)}` : undefined} />
              <InfoBox label="RN" value={tag.rn} href={tag.rn ? `/rn/${encodeURIComponent(tag.rn)}` : undefined} />
            </div>
            <InfoBox label="Style number" value={tag.styleNumber} />
            <InfoBox label="Notes" value={tag.notes} multiline />
          </div>

          <div>
            <input
              className="w-full border rounded p-2 text-black"
              placeholder="Brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            {brandAutocomplete.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {brandAutocomplete.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition"
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <input
              className="w-full border rounded p-2 text-black"
              placeholder="RN (digits only)"
              value={rn}
              onChange={(e) => handleRnChange(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
            />
            {rnWarning && <p className="mt-1 text-xs text-amber-300">{rnWarning}</p>}
            {rnBrandSuggestions.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-white/70 mb-1">Brands already seen for RN {rn}:</p>
                <div className="flex flex-wrap gap-2">
                  {rnBrandSuggestions.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input
            className="w-full border rounded p-2 text-black"
            placeholder="Style number / article code / model code"
            value={styleNumber}
            onChange={(e) => setStyleNumber(e.target.value)}
          />

          <textarea
            className="min-h-28 w-full border rounded p-2 text-black"
            placeholder="Notes: care label text, country, fabric blend, collection clues, authenticity hints..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <input
            type="file"
            accept="image/*"
            className="w-full border rounded p-2 bg-white text-black"
            onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canEdit || status.kind === "info"}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            >
              {status.kind === "info" && status.pct != null
                ? `Uploading… ${status.pct}%`
                : status.kind === "info"
                ? "Saving…"
                : "Save"}
            </button>
            <button
              type="button"
              disabled={!canEdit || status.kind === "info"}
              onClick={onMoveToTrash}
              className="px-4 py-2 rounded border border-amber-400 text-amber-300 disabled:opacity-50"
            >
              Move to Trash
            </button>
          </div>

          {!canEdit && <p className="text-sm text-amber-300">Only the uploader or an admin can edit.</p>}
        </form>
      </div>

      {status.text && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg border
            ${
              status.kind === "success"
                ? "bg-emerald-500 text-black border-emerald-400"
                : status.kind === "error"
                ? "bg-rose-500 text-white border-rose-400"
                : "bg-white/10 border-white/20"
            }`}
        >
          {status.text}
        </div>
      )}
    </main>
  );
}

function InfoBox({ label, value, href, multiline = false }: { label: string; value?: string | null; href?: string; multiline?: boolean }) {
  const content = value?.trim() ? value : "—";
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
      {href && value ? (
        <Link href={href} className="mt-1 block text-white underline-offset-4 hover:underline">
          {content}
        </Link>
      ) : (
        <div className={`mt-1 text-white ${multiline ? "whitespace-pre-wrap text-sm leading-6" : ""}`}>{content}</div>
      )}
    </div>
  );
}
