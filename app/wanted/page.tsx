"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type SearchRow = {
  id: string;
  query?: string | null;
  count?: number | null;
};

export default function MostSearchedPage() {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "search_queries"), orderBy("count", "desc"), limit(10)))
      .then((snapshot) => setRows(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SearchRow, "id">) }))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.22em] text-sky-200/80">Global TagSheep searches</p>
      <h1 className="mt-2 text-3xl font-semibold">Most searched</h1>
      <p className="mt-2 text-white/65">The current Top 10 searches made by the TagSheep community.</p>

      <div className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {loading ? (
          <p className="p-6 text-white/60">Loading the Top 10…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-white/60">The leaderboard will appear as people search TagSheep.</p>
        ) : (
          <ol>
            {rows.map((row, index) => (
              <li key={row.id} className="flex items-center gap-4 border-b border-white/10 p-4 last:border-b-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400/15 font-semibold text-sky-100">{index + 1}</span>
                <Link href={`/tags?${new URLSearchParams({ q: row.query || "" }).toString()}`} className="min-w-0 flex-1 truncate font-medium text-white hover:underline">
                  {row.query || row.id}
                </Link>
                <span className="text-sm text-white/50">{row.count ?? 1} search{row.count === 1 ? "" : "es"}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
