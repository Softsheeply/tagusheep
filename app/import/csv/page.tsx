"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminGate from "@/app/components/AdminGate";
import { normalizeBrand, normalizeRn, normalizeStyleNumber } from "@/lib/records";
import { safeHostnameFromUrl } from "@/lib/validation";

type ParsedRow = {
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

const SAMPLE_HEADERS = ["brand", "productName", "styleNumber", "rn", "category", "imageUrl", "sourceUrl", "sourceName", "notes"];

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])) as Record<string, string>;
    return {
      brand: row.brand || "",
      productName: row.productName || "",
      styleNumber: row.styleNumber || "",
      rn: row.rn || "",
      category: row.category || "",
      imageUrl: row.imageUrl || "",
      sourceUrl: row.sourceUrl || "",
      sourceName: row.sourceName || "",
      notes: row.notes || "",
    } satisfies ParsedRow;
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
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

export default function CsvImportPage() {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsedRows = useMemo(() => parseCsv(csvText), [csvText]);

  async function handleFile(file: File) {
    const text = await file.text();
    setCsvText(text);
  }

  async function importRows() {
    if (!auth.currentUser) {
      setMessage("Please sign in first.");
      return;
    }

    const validRows = parsedRows.filter((row) => row.imageUrl || row.sourceUrl || row.brand || row.productName);
    if (validRows.length === 0) {
      setMessage("No usable rows found.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      for (const row of validRows) {
        const cleanSourceUrl = row.sourceUrl.trim() || null;
        const cleanSourceName = row.sourceName.trim() || safeHostnameFromUrl(cleanSourceUrl || "") || null;
        const cleanRn = normalizeRn(row.rn);

        await addDoc(collection(db, "imports_review"), {
          brand: normalizeBrand(row.brand) || null,
          productName: row.productName.trim() || null,
          styleNumber: normalizeStyleNumber(row.styleNumber) || null,
          rn: cleanRn,
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
        });
      }

      setMessage(`Imported ${validRows.length} row(s) into the review queue.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "CSV import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGate
      title="CSV import"
      description="Import Google Sheets CSV exports into the review queue."
    >
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Bulk import</p>
            <h1 className="text-3xl font-semibold">CSV import from Google Sheets</h1>
            <p className="mt-2 max-w-3xl text-white/70">Paste CSV text or upload a CSV exported from Google Sheets. Rows go to the review queue, not directly live.</p>
          </div>
          <Link href="/tools" className="text-sm underline">← Back to tools</Link>
        </div>

        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/8 p-4 text-sm text-emerald-100 space-y-2">
          <div className="font-medium">Recommended CSV columns</div>
          <div>{SAMPLE_HEADERS.join(", ")}</div>
          <div className="text-emerald-100/75">Minimum useful rows usually include image URL, source URL, and at least brand or product name.</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="block space-y-2">
              <span className="text-sm text-white/80">Upload CSV file</span>
              <input type="file" accept=".csv,text/csv" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-white/80">Or paste CSV text</span>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={18} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-emerald-300/60" placeholder="brand,productName,styleNumber,rn,category,imageUrl,sourceUrl,sourceName,notes" />
            </label>

            <button onClick={importRows} disabled={busy || parsedRows.length === 0} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black disabled:opacity-50">
              {busy ? "Importing…" : "Import to review queue"}
            </button>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Preview</h2>
              <span className="text-sm text-white/55">{parsedRows.length} row(s)</span>
            </div>

            {parsedRows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">No rows parsed yet.</div>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
                {parsedRows.slice(0, 25).map((row, index) => (
                  <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80 space-y-1">
                    <div><span className="text-white/45">Brand:</span> {row.brand || "—"}</div>
                    <div><span className="text-white/45">Product:</span> {row.productName || "—"}</div>
                    <div><span className="text-white/45">Style:</span> {row.styleNumber || "—"}</div>
                    <div><span className="text-white/45">RN:</span> {row.rn || "—"}</div>
                    <div><span className="text-white/45">Image:</span> {row.imageUrl || "—"}</div>
                    <div><span className="text-white/45">Source:</span> {row.sourceUrl || "—"}</div>
                  </div>
                ))}
                {parsedRows.length > 25 && <div className="text-xs text-white/50">Preview limited to first 25 rows.</div>}
              </div>
            )}
          </div>
        </div>

        {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
      </main>
    </AdminGate>
  );
}
