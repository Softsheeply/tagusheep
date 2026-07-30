"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { prepareRecord } from "@/lib/records";
import { scrapeProductUrl } from "@/lib/scrape";
import { fetchRemoteImageAsFile, IMAGE_POLICY, normalizeThumbnailImage, normalizeUploadedImage } from "@/lib/images";
import { safeHostnameFromUrl } from "@/lib/validation";
import { findPotentialDuplicates } from "@/lib/duplicates";
import { uploadImageObject } from "@/lib/object-storage";

type ImportResult = {
  url: string;
  status: "pending" | "success" | "review" | "duplicate" | "error";
  message?: string;
  recordName?: string;
};

// Each item does a scrape + one or more image fetch/uploads, so keep this
// small enough not to hammer source sites or blow through storage quota bursts.
const BATCH_SIZE = 3;

export default function BulkImportPage() {
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const urls = useMemo(() => {
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [input]);

  async function runBulkImport() {
    if (!auth.currentUser) {
      setMessage("Please sign in before running bulk import.");
      return;
    }
    if (urls.length === 0) {
      setMessage("Paste at least one URL.");
      return;
    }

    setRunning(true);
    setMessage(null);
    const initial = urls.map((url) => ({ url, status: "pending" as const }));
    setResults(initial);

    const uid = auth.currentUser.uid;

    async function importOne(url: string) {
      try {
        const data = await scrapeProductUrl(url);
        let hostedImageUrl = data.imageUrl || "";
        let hostedThumbnailUrl: string | null = null;
        let hostedExtraImageUrls = (data.extraImageUrls || []).filter(Boolean);
        let hostedStoragePath: string | null = null;

        if (data.imageUrl) {
          try {
            const remoteFile = await fetchRemoteImageAsFile(data.imageUrl, "bulk-import-primary");
            const normalizedFile = await normalizeUploadedImage(remoteFile);
            const thumbnailFile = await normalizeThumbnailImage(remoteFile);
            const baseName = `${Date.now()}_${normalizedFile.name}`;
            const path = `tagusheep/imports/${uid}/${baseName}`;
            const thumbPath = `tagusheep/imports/${uid}/thumb_${baseName}`;
            hostedImageUrl = (await uploadImageObject(normalizedFile, path)).url;
            hostedThumbnailUrl = (await uploadImageObject(thumbnailFile, thumbPath)).url;
            hostedStoragePath = path;

            if (hostedExtraImageUrls.length > 0) {
              const limitedExtraUrls = hostedExtraImageUrls.slice(0, IMAGE_POLICY.maxImportedImageUrlCount);
              hostedExtraImageUrls = await Promise.all(limitedExtraUrls.map(async (extraUrl, index) => {
                const extraFile = await fetchRemoteImageAsFile(extraUrl, `bulk-import-extra-${index + 1}`);
                const normalizedExtra = await normalizeUploadedImage(extraFile);
                const extraBaseName = `${Date.now()}_${index + 1}_${normalizedExtra.name}`;
                const extraPath = `tagusheep/imports/${uid}/extra_${extraBaseName}`;
                return (await uploadImageObject(normalizedExtra, extraPath)).url;
              }));
            }
          } catch {
            // keep original remote URLs if hosting fails during bulk import
          }
        }

        const payload = prepareRecord({
          ...data,
          imageUrl: hostedImageUrl,
          thumbnailUrl: hostedThumbnailUrl,
          extraImageUrls: hostedExtraImageUrls,
          sourceUrl: data.sourceUrl || url,
          sourceName: data.sourceName || safeHostnameFromUrl(data.sourceUrl || url),
          verificationStatus: "pending",
          storagePath: hostedStoragePath,
          createdBy: uid,
          createdAt: serverTimestamp(),
          importedAt: new Date().toISOString(),
        });

        if (!payload.imageUrl || !payload.brand) {
          await addDoc(collection(db, "imports_review"), {
            ...payload,
            sourceUrl: payload.sourceUrl || url,
            sourceName: payload.sourceName || safeHostnameFromUrl(payload.sourceUrl || url),
            createdBy: uid,
            createdAt: serverTimestamp(),
            importedAt: new Date().toISOString(),
            importStatus: "needs_review",
          });
          setResults((prev) => prev.map((item) => item.url === url ? { ...item, status: "review", recordName: payload.productName || payload.brand || url, message: "Saved to review queue." } : item));
          return;
        }

        const duplicates = await findPotentialDuplicates(payload.brand, payload.styleNumber, payload.rn);
        if (duplicates.length > 0) {
          await addDoc(collection(db, "imports_review"), {
            ...payload,
            sourceUrl: payload.sourceUrl || url,
            sourceName: payload.sourceName || safeHostnameFromUrl(payload.sourceUrl || url),
            createdBy: uid,
            createdAt: serverTimestamp(),
            importedAt: new Date().toISOString(),
            importStatus: "possible_duplicate",
          });
          setResults((prev) => prev.map((item) => item.url === url ? { ...item, status: "duplicate", recordName: payload.productName || payload.brand || url, message: `Matches an existing record (${duplicates[0].matchReason}). Sent to review queue.` } : item));
          return;
        }

        await addDoc(collection(db, "tags"), payload);
        setResults((prev) => prev.map((item) => item.url === url ? { ...item, status: "success", recordName: payload.productName || payload.brand || url } : item));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Import failed.";
        setResults((prev) => prev.map((item) => item.url === url ? { ...item, status: "error", message } : item));
      }
    }

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(importOne));
    }

    setRunning(false);
    setMessage("Bulk import finished. Strong records were saved as pending; partial records and possible duplicates were sent to the review queue.");
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const duplicateCount = results.filter((r) => r.status === "duplicate").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Import pipeline</p>
          <h1 className="text-3xl font-semibold">Bulk URL import</h1>
          <p className="mt-2 max-w-3xl text-white/70">
            Paste many product URLs and Tagsheep will import them a few at a time. Clean records save live as <b>pending</b>; partial records and possible duplicates go to the review queue instead.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/import" className="underline">Single import</Link>
          <Link href="/tools" className="underline">← Back to tools</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-white/80">Paste one URL per line</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={18}
              placeholder={"https://oldnavy.gapcanada.ca/browse/product.do?...\nhttps://example.com/product/..."}
              className="w-full rounded-2xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-emerald-300/60"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={runBulkImport}
              disabled={running || urls.length === 0}
              className="rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {running ? "Importing…" : `Import ${urls.length} URL${urls.length === 1 ? "" : "s"}`}
            </button>
            <span className="text-sm text-white/55">Successful imports save immediately as pending records.</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <StatCard label="Queued" value={String(urls.length)} />
            <StatCard label="Imported" value={String(successCount)} />
            <StatCard label="Duplicates" value={String(duplicateCount)} />
            <StatCard label="Errors" value={String(errorCount)} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 max-h-[560px] overflow-auto">
            {results.length === 0 ? (
              <p className="text-sm text-white/60">No results yet. Paste URLs and run the importer.</p>
            ) : (
              results.map((result) => (
                <div key={result.url} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-white/90">{result.recordName || result.url}</div>
                      <div className="truncate text-white/45 text-xs mt-1">{result.url}</div>
                      {result.message && <div className="mt-2 text-rose-200 text-xs">{result.message}</div>}
                    </div>
                    <StatusPill status={result.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: ImportResult["status"] }) {
  const cls = status === "success"
    ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-200"
    : status === "review"
    ? "border-sky-300/35 bg-sky-400/10 text-sky-200"
    : status === "duplicate"
    ? "border-violet-300/35 bg-violet-400/10 text-violet-200"
    : status === "error"
    ? "border-rose-300/35 bg-rose-400/10 text-rose-200"
    : "border-amber-300/35 bg-amber-400/10 text-amber-200";

  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>{status}</span>;
}
