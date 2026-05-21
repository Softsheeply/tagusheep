"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminGate from "@/app/components/AdminGate";
import { normalizeBrand, normalizeStyleNumber } from "@/lib/records";
import { safeHostnameFromUrl } from "@/lib/validation";

type CleanRow = {
  brand: string;
  productName: string;
  styleNumber: string;
  rn: string;
  category: string;
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  notes: string;
};

const PRODUCT_URL_RE = /https?:\/\/www\.aritzia\.com\/en\/product\/[^\s]+/g;
const IMAGE_URL_RE = /https?:\/\/assets\.aritzia\.com\/image\/upload\/[^\s]+/g;
const TITLE_RE = /([A-Z][A-Za-z0-9™'’&+\-\/ ]{2,80}(Top|Bodysuit|Camisole|Sweater Vest|Vest|Shirt|Dress|Tank|Halter Top))/;

function inferCategory(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("bodysuit")) return "bodysuit";
  if (lower.includes("camisole")) return "camisole";
  if (lower.includes("sweater vest") || lower.includes("vest")) return "vest";
  if (lower.includes("dress")) return "dress";
  if (lower.includes("shirt")) return "shirt";
  if (lower.includes("tank")) return "tank";
  if (lower.includes("top") || lower.includes("halter")) return "top";
  return "top";
}

function cleanProductUrl(url: string) {
  return url.replace(/\?.*$/, "");
}

function extractStyleNumber(url: string) {
  const match = url.match(/\/product\/[^/]+\/(\d+)\.html/i);
  return match?.[1] || "";
}

function parseAritziaDump(text: string): CleanRow[] {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  const productUrls = Array.from(normalized.matchAll(PRODUCT_URL_RE)).map((match) => ({
    url: match[0],
    index: match.index ?? 0,
  }));
  const imageUrls = Array.from(normalized.matchAll(IMAGE_URL_RE)).map((match) => ({
    url: match[0],
    index: match.index ?? 0,
  }));

  const rows: CleanRow[] = [];

  for (let i = 0; i < productUrls.length; i++) {
    const current = productUrls[i];
    const next = productUrls[i + 1];
    const chunk = normalized.slice(current.index, next ? next.index : normalized.length);
    const sourceUrl = cleanProductUrl(current.url);
    const styleNumber = extractStyleNumber(sourceUrl);
    const titleMatch = chunk.match(TITLE_RE);
    const productName = titleMatch?.[1]?.trim() || "";

    const nearestImage = imageUrls.find((image) => image.index > current.index && (!next || image.index < next.index));
    const imageUrl = nearestImage?.url || "";

    rows.push({
      brand: "Aritzia",
      productName,
      styleNumber: normalizeStyleNumber(styleNumber) || styleNumber,
      rn: "",
      category: inferCategory(productName),
      imageUrl,
      sourceUrl,
      sourceName: "Aritzia",
      notes: "Imported from pasted Aritzia listing scrape.",
    });
  }

  const deduped = new Map<string, CleanRow>();
  for (const row of rows) {
    if (!row.sourceUrl) continue;
    if (!deduped.has(row.sourceUrl)) deduped.set(row.sourceUrl, row);
  }
  return Array.from(deduped.values());
}

export default function PasteImportPage() {
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsedRows = useMemo(() => parseAritziaDump(rawText), [rawText]);

  async function importRows() {
    if (!auth.currentUser) {
      setMessage("Please sign in first.");
      return;
    }
    if (parsedRows.length === 0) {
      setMessage("No usable rows found.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      for (const row of parsedRows) {
        const cleanSourceUrl = row.sourceUrl.trim() || null;
        const cleanSourceName = row.sourceName.trim() || safeHostnameFromUrl(cleanSourceUrl || "") || null;
        await addDoc(collection(db, "imports_review"), {
          brand: normalizeBrand(row.brand) || null,
          productName: row.productName.trim() || null,
          styleNumber: normalizeStyleNumber(row.styleNumber) || null,
          rn: null,
          category: row.category.trim() || null,
          imageUrl: row.imageUrl.trim() || null,
          thumbnailUrl: row.imageUrl.trim() || null,
          sourceUrl: cleanSourceUrl,
          sourceName: cleanSourceName,
          sourceType: "archive",
          verificationStatus: "pending",
          notes: row.notes.trim() || null,
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          importedAt: new Date().toISOString(),
          bulkImported: true,
          scrapeImported: true,
        });
      }
      setMessage(`Imported ${parsedRows.length} cleaned row(s) into the review queue.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Paste import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGate
      title="Paste scrape cleaner"
      description="Paste raw scrape dumps and turn them into review-ready candidates."
    >
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Bulk import</p>
            <h1 className="text-3xl font-semibold">Paste scrape cleaner</h1>
            <p className="mt-2 max-w-3xl text-white/70">Paste raw listing text from a scrape or browser extension. This first version is tuned for Aritzia-style product listing dumps.</p>
          </div>
          <Link href="/tools" className="text-sm underline">← Back to tools</Link>
        </div>

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/8 p-4 text-sm text-emerald-100 space-y-2">
          <div className="font-medium">Current cleaner expectations</div>
          <div>- Aritzia product URLs</div>
          <div>- Aritzia image URLs</div>
          <div>- Product title on the same line</div>
          <div className="text-emerald-100/75">It keeps one row per canonical product URL and ignores repeated color links.</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block space-y-2">
              <span className="text-sm text-white/80">Paste raw scrape text</span>
              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={22} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-emerald-300/60" placeholder="Paste raw Instant Data Scraper output here..." />
            </label>

            <button onClick={importRows} disabled={busy || parsedRows.length === 0} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black disabled:opacity-50">
              {busy ? "Importing…" : "Import cleaned rows to review"}
            </button>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Preview</h2>
              <span className="text-sm text-white/55">{parsedRows.length} row(s)</span>
            </div>

            {parsedRows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">No usable rows parsed yet.</div>
            ) : (
              <div className="space-y-3 max-h-[720px] overflow-auto pr-1">
                {parsedRows.map((row, index) => (
                  <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80 space-y-1">
                    <div><span className="text-white/45">Brand:</span> {row.brand}</div>
                    <div><span className="text-white/45">Product:</span> {row.productName || "—"}</div>
                    <div><span className="text-white/45">Style:</span> {row.styleNumber || "—"}</div>
                    <div><span className="text-white/45">Category:</span> {row.category || "—"}</div>
                    <div><span className="text-white/45">Image:</span> {row.imageUrl || "—"}</div>
                    <div><span className="text-white/45">Source:</span> {row.sourceUrl || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
      </main>
    </AdminGate>
  );
}
