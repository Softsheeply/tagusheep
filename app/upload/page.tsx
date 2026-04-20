"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { auth, google, db, storage } from "@/lib/firebase";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
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
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

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

export default function UploadPage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [brand, setBrand] = useState("");
  const [rn, setRn] = useState("");
  const [styleNumber, setStyleNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState<{ kind: "idle" | "info" | "success" | "error"; text: string | null; pct?: number }>({ kind: "idle", text: null });
  const [rnWarning, setRnWarning] = useState<string | null>(null);
  const [rnBrandSuggestions, setRnBrandSuggestions] = useState<string[]>([]);
  const [brandAutocomplete, setBrandAutocomplete] = useState<string[]>([]);
  const rnDebounce = useRef<number | null>(null);
  const brandDebounce = useRef<number | null>(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  async function login() {
    try {
      await signInWithPopup(auth, google);
    } catch (e: any) {
      if (e?.code?.startsWith("auth/popup")) await signInWithRedirect(auth, google);
    }
  }

  async function logout() {
    await signOut(auth);
  }

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

      const compressed = await compressWithExifFix(file);
      const path = `tagusheep/uploads/${user.uid}/${Date.now()}_${compressed.name}`;
      const task = uploadBytesResumable(ref(storage, path), compressed);

      task.on("state_changed", (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setStatus({ kind: "info", text: `Uploading… ${pct}%`, pct });
      });

      await new Promise<void>((res, rej) => task.on("state_changed", undefined, rej, () => res()));
      const url = await getDownloadURL(ref(storage, path));

      await addDoc(collection(db, "tags"), {
        brand: brand.trim() || null,
        rn: rn.trim() || null,
        styleNumber: styleNumber.trim() || null,
        notes: notes.trim() || null,
        imageUrl: url,
        storagePath: path,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      setStatus({ kind: "success", text: "Record uploaded ✅" });
      setBrand("");
      setRn("");
      setStyleNumber("");
      setNotes("");
      setFile(null);
      const input = document.getElementById("fileInput") as HTMLInputElement | null;
      if (input) input.value = "";
      setTimeout(() => setStatus({ kind: "idle", text: null }), 1200);
    } catch (err: any) {
      setStatus({ kind: "error", text: err?.message || String(err) });
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Add a TaguSheep record</h1>
        <div className="flex items-center gap-2 text-sm">
          {user ? (
            <>
              <span className="opacity-80">Signed in as <b>{user.displayName || user.email}</b></span>
              <button onClick={logout} className="rounded border border-white/15 px-3 py-1 hover:border-white/40 transition">Sign out</button>
            </>
          ) : (
            <button onClick={login} className="rounded bg-emerald-400/90 hover:bg-emerald-300 text-black font-semibold px-3 py-1 transition">
              Sign in with Google
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/80">
        TaguSheep is aiming to be a clothing internet database. Best uploads are clean, well-lit label photos on a plain white backdrop with no people, cluttered rooms, mirrors, or explicit content in frame.
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
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
                  title="Fill brand"
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

          {rn && rnBrandSuggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-white/70 mb-1">Brands already seen for RN {rn}:</p>
              <div className="flex flex-wrap gap-2">
                {rnBrandSuggestions.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrand(b)}
                    className="text-xs rounded-full border border-white/15 px-2 py-1 hover:border-emerald-300/50 transition"
                    title="Use this brand"
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
          className="w-full border rounded p-2 text-black min-h-28"
          placeholder="Optional label notes: country, fabric blend, season, care text, serial hints, collection info..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f && f.type.startsWith("image/")) setFile(f);
          }}
          className="rounded border border-dashed border-white/20 p-4"
        >
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            className="w-full border rounded p-2 bg-white text-black"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="mt-2 text-xs text-white/70">
            Best result: one clean label image on a white background, centered and easy to read.
          </p>
          {file && <p className="text-xs mt-1">Selected: <b>{file.name}</b></p>}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!user || !file || status.kind === "info" || !!rnWarning}
            className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          >
            {status.kind === "info" && status.pct != null
              ? `Uploading… ${status.pct}%`
              : status.kind === "info"
              ? "Saving…"
              : "Add record"}
          </button>

          <Link href="/tags" className="text-sm underline">Search database</Link>
        </div>
      </form>

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
