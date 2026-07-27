"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminGate from "@/app/components/AdminGate";
import { buildSearchText, normalizeBrand, normalizeRn, normalizeStyleNumber } from "@/lib/records";
import { safeHostnameFromUrl } from "@/lib/validation";

// All supported columns — flexible aliases accepted
const FIELD_ALIASES: Record<string, string> = {
  brand: "brand",
  productname: "productName",
  "product name": "productName",
  "product": "productName",
  stylenumber: "styleNumber",
  "style number": "styleNumber",
  "style#": "styleNumber",
  style: "styleNumber",
  rn: "rn",
  "rn number": "rn",
  rnumber: "rn",
  category: "category",
  garmenttype: "garmentType",
  "garment type": "garmentType",
  garment: "garmentType",
  type: "garmentType",
  color: "color",
  colour: "color",
  size: "size",
  year: "year",
  era: "year",
  decade: "year",
  madein: "madeIn",
  "made in": "madeIn",
  origin: "madeIn",
  country: "madeIn",
  materials: "materials",
  material: "materials",
  fabric: "materials",
  caretext: "careText",
  "care text": "careText",
  care: "careText",
  notes: "notes",
  note: "notes",
  imageurl: "imageUrl",
  "image url": "imageUrl",
  image: "imageUrl",
  photo: "imageUrl",
  sourceurl: "sourceUrl",
  "source url": "sourceUrl",
  url: "sourceUrl",
  source: "sourceUrl",
  sourcename: "sourceName",
  "source name": "sourceName",
};

type ParsedRow = Record<string, string>;

const TEMPLATE_HEADERS = ["brand", "styleNumber", "rn", "productName", "garmentType", "color", "size", "year", "madeIn", "materials", "notes", "imageUrl", "sourceUrl"];

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[_\-]/g, " ");
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rawHeaders = splitCsvLine(lines[0]);
  const headers = rawHeaders.map((h) => FIELD_ALIASES[normalizeHeader(h)] ?? normalizeHeader(h));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function isValidRow(row: ParsedRow) {
  const hasBrand = !!(row.brand?.trim());
  const hasIdentifier = !!(row.styleNumber?.trim() || row.rn?.trim());
  return hasBrand && hasIdentifier;
}

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS.join(","), TEMPLATE_HEADERS.map(() => "").join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tagsheep-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function chunkImport(rows: ParsedRow[], onProgress: (done: number) => void): Promise<{ ok: number; failed: number }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  let ok = 0;
  let failed = 0;
  const CHUNK = 10;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async (row) => {
      try {
        const cleanBrand = normalizeBrand(row.brand) || null;
        const cleanStyleNumber = normalizeStyleNumber(row.styleNumber) || null;
        const cleanRn = normalizeRn(row.rn) || null;
        const cleanProductName = row.productName?.trim() || null;
        const cleanGarmentType = row.garmentType?.trim() || null;
        const cleanColor = row.color?.trim() || null;
        const cleanSize = row.size?.trim() || null;
        const cleanYear = row.year?.trim() || null;
        const cleanMadeIn = row.madeIn?.trim() || null;
        const cleanMaterials = row.materials?.trim() || null;
        const cleanCareText = row.careText?.trim() || null;
        const cleanNotes = row.notes?.trim() || null;
        const cleanSourceUrl = row.sourceUrl?.trim() || null;
        const cleanSourceName = row.sourceName?.trim() || safeHostnameFromUrl(cleanSourceUrl || "") || null;
        const cleanImageUrl = row.imageUrl?.trim() || null;

        const payload: Record<string, unknown> = {
          sourceType: "archive",
          verificationStatus: "pending",
          createdBy: uid,
          createdAt: serverTimestamp(),
          importedAt: new Date().toISOString(),
          bulkImported: true,
          uploadFallback: false,
          fallbackReason: null,
          searchText: buildSearchText({ brand: cleanBrand, rn: cleanRn, styleNumber: cleanStyleNumber, productName: cleanProductName, garmentType: cleanGarmentType, size: cleanSize, year: cleanYear, madeIn: cleanMadeIn, materials: cleanMaterials, color: cleanColor, notes: cleanNotes, sourceName: cleanSourceName }),
        };
        if (cleanBrand) payload.brand = cleanBrand;
        if (cleanStyleNumber) payload.styleNumber = cleanStyleNumber;
        if (cleanRn) payload.rn = cleanRn;
        if (cleanProductName) payload.productName = cleanProductName;
        if (cleanGarmentType) payload.garmentType = cleanGarmentType;
        if (cleanColor) payload.color = cleanColor;
        if (cleanSize) payload.size = cleanSize;
        if (cleanYear) payload.year = cleanYear;
        if (cleanMadeIn) payload.madeIn = cleanMadeIn;
        if (cleanMaterials) payload.materials = cleanMaterials;
        if (cleanCareText) payload.careText = cleanCareText;
        if (cleanNotes) payload.notes = cleanNotes;
        if (cleanSourceUrl) payload.sourceUrl = cleanSourceUrl;
        if (cleanSourceName) payload.sourceName = cleanSourceName;
        if (cleanImageUrl) { payload.imageUrl = cleanImageUrl; payload.thumbnailUrl = cleanImageUrl; }

        await addDoc(collection(db, "imports_review"), payload);
        ok++;
      } catch {
        failed++;
      }
    }));
    onProgress(Math.min(i + CHUNK, rows.length));
  }
  return { ok, failed };
}

export default function CsvImportPage() {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; failed: number; skipped: number } | null>(null);

  const parsedRows = useMemo(() => parseCsv(csvText), [csvText]);
  const validRows = useMemo(() => parsedRows.filter(isValidRow), [parsedRows]);
  const skippedRows = useMemo(() => parsedRows.filter((r) => !isValidRow(r)), [parsedRows]);

  async function handleFile(file: File) {
    setCsvText(await file.text());
    setResult(null);
  }

  async function runImport() {
    if (!auth.currentUser) { alert("Sign in first."); return; }
    if (validRows.length === 0) return;
    setBusy(true);
    setProgress(0);
    setResult(null);
    try {
      const { ok, failed } = await chunkImport(validRows, setProgress);
      setResult({ ok, failed, skipped: skippedRows.length });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGate title="CSV import" description="Bulk import records into the review queue.">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Bulk import</p>
            <h1 className="text-3xl font-semibold">CSV import</h1>
            <p className="mt-2 max-w-2xl text-white/65">
              Upload or paste a CSV. Rows go into the review queue — nothing goes live until approved.
              Headers are flexible (case-insensitive, spaces/underscores accepted).
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={downloadTemplate} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/30 hover:text-white">
              Download template
            </button>
            <Link href="/tools" className="text-sm underline self-center">← Tools</Link>
          </div>
        </div>

        {/* Column guide */}
        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/8 p-4 text-sm space-y-2">
          <div className="font-medium text-emerald-100">Required columns (at minimum)</div>
          <div className="text-emerald-100/80">
            <b>brand</b> + (<b>styleNumber</b> or <b>rn</b>) — rows missing both are skipped automatically.
          </div>
          <div className="mt-1 text-xs text-emerald-100/60">
            All columns: {TEMPLATE_HEADERS.join(", ")}. Headers are matched flexibly — &ldquo;Style Number&rdquo;, &ldquo;style_number&rdquo;, &ldquo;style&rdquo; all work.
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Input */}
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block space-y-2">
              <span className="text-sm text-white/80">Upload CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
                className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-white/80">Or paste CSV text</span>
              <textarea
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setResult(null); }}
                rows={14}
                className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-emerald-300/60"
                placeholder="brand,styleNumber,rn,productName,garmentType,color,size,year..."
              />
            </label>

            {/* Stats before import */}
            {parsedRows.length > 0 && !result && (
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl border border-white/10 bg-black/20 py-2">
                  <div className="text-lg font-semibold text-white">{parsedRows.length}</div>
                  <div className="text-xs text-white/45">total rows</div>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/8 py-2">
                  <div className="text-lg font-semibold text-emerald-200">{validRows.length}</div>
                  <div className="text-xs text-emerald-200/60">will import</div>
                </div>
                <div className="rounded-xl border border-amber-300/20 bg-amber-400/8 py-2">
                  <div className="text-lg font-semibold text-amber-200">{skippedRows.length}</div>
                  <div className="text-xs text-amber-200/60">skipped</div>
                </div>
              </div>
            )}

            {/* Progress bar */}
            {busy && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.round((progress / validRows.length) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-white/55 text-center">{progress} of {validRows.length} imported…</div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 space-y-1">
                <div className="font-semibold">Import complete</div>
                <div>{result.ok} imported · {result.failed > 0 ? `${result.failed} failed · ` : ""}{result.skipped} skipped (no identifier)</div>
                <Link href="/imports-review" className="underline text-emerald-200">Review queue →</Link>
              </div>
            )}

            <button
              onClick={runImport}
              disabled={busy || validRows.length === 0}
              className="w-full rounded-xl bg-emerald-400/90 px-4 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-40"
            >
              {busy ? `Importing… ${progress}/${validRows.length}` : `Import ${validRows.length} rows to review queue`}
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Preview</h2>
              <span className="text-sm text-white/45">{parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} parsed</span>
            </div>

            {parsedRows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-white/40">
                Upload or paste a CSV to preview rows here.
              </div>
            ) : (
              <div className="max-h-[580px] space-y-2 overflow-auto pr-1">
                {parsedRows.slice(0, 50).map((row, i) => {
                  const valid = isValidRow(row);
                  return (
                    <div key={i} className={`rounded-xl border px-3 py-2.5 text-xs ${valid ? "border-white/10 bg-black/20 text-white/80" : "border-amber-300/15 bg-amber-400/8 text-amber-100/70"}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-medium text-sm text-white">{row.brand || <span className="text-white/30">No brand</span>}</div>
                        {!valid && <span className="shrink-0 rounded-full border border-amber-300/30 px-1.5 py-0.5 text-[10px] text-amber-300">skipped</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {row.styleNumber && <div>Style: {row.styleNumber}</div>}
                        {row.rn && <div>RN: {row.rn}</div>}
                        {row.garmentType && <div>Type: {row.garmentType}</div>}
                        {row.color && <div>Color: {row.color}</div>}
                        {row.size && <div>Size: {row.size}</div>}
                        {row.year && <div>Year: {row.year}</div>}
                        {row.madeIn && <div>Made in: {row.madeIn}</div>}
                        {row.imageUrl && <div className="col-span-2 truncate text-white/45">Image: {row.imageUrl}</div>}
                      </div>
                    </div>
                  );
                })}
                {parsedRows.length > 50 && (
                  <div className="text-center text-xs text-white/40 py-2">Preview limited to first 50 rows — all {parsedRows.length} will import.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </AdminGate>
  );
}
