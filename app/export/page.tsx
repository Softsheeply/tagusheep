"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ExportRecord = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  category?: string | null;
  year?: string | null;
  sourceName?: string | null;
  sourceType?: string | null;
  verificationStatus?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  createdAt?: unknown;
};

export default function ExportPage() {
  const [rows, setRows] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qRef);
        setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExportRecord, "id">) })));
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Failed to load records.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const payload = useMemo(() => {
    if (format === "json") {
      return JSON.stringify(rows, null, 2);
    }
    const headers = [
      "id",
      "brand",
      "productName",
      "rn",
      "styleNumber",
      "category",
      "year",
      "sourceName",
      "sourceType",
      "verificationStatus",
      "imageUrl",
      "sourceUrl",
      "notes",
    ];
    const lines = rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header as keyof ExportRecord] ?? "";
          const text = String(value).replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(",")
    );
    return [headers.join(","), ...lines].join("\n");
  }, [rows, format]);

  function download() {
    const blob = new Blob([payload], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `tagsheep-export.${format}`;
    a.click();
    URL.revokeObjectURL(href);
    setMessage(`Downloaded ${rows.length} records as ${format.toUpperCase()}.`);
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Export</p>
          <h1 className="text-3xl font-semibold">Export Tagsheep data</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Export the live database as JSON or CSV. This is useful for backups, offline analysis, cleaning records, or importing into another system.
          </p>
        </div>
        <Link href="/tags" className="text-sm underline">← Back to database</Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm text-white/80">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "csv")} className="rounded-xl border border-white/12 bg-[#09111f] px-4 py-2 text-white">
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button onClick={download} disabled={loading || rows.length === 0} className="rounded-xl bg-white px-4 py-2 font-semibold text-black disabled:opacity-50">
            Download export
          </button>
          <span className="text-sm text-white/55">{loading ? "Loading…" : `${rows.length} records`}</span>
        </div>

        <textarea readOnly value={payload} className="min-h-[420px] w-full rounded-2xl border border-white/10 bg-[#09111f] p-4 text-sm text-white/85" />
      </div>

      {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
    </main>
  );
}
