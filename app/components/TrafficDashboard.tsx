"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type TrafficRow = {
  visitorId?: string;
  day?: string;
  views?: number;
  paths?: string[];
};

type Period = { visitors: number; views: number };

function dayOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function summarize(rows: TrafficRow[], since: string): Period {
  const selected = rows.filter((row) => (row.day || "") >= since);
  return {
    visitors: new Set(selected.map((row) => row.visitorId).filter(Boolean)).size,
    views: selected.reduce((total, row) => total + Math.max(0, Number(row.views) || 0), 0),
  };
}

export default function TrafficDashboard() {
  const [rows, setRows] = useState<TrafficRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, "traffic_visitors"), where("day", ">=", dayOffset(29))))
      .then((snapshot) => {
        if (!cancelled) setRows(snapshot.docs.map((item) => item.data() as TrafficRow));
      })
      .catch(() => {
        if (!cancelled) setError("Traffic numbers could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const periods = [
    { label: "Today", value: summarize(rows, dayOffset(0)) },
    { label: "Last 7 days", value: summarize(rows, dayOffset(6)) },
    { label: "Last 30 days", value: summarize(rows, dayOffset(29)) },
  ];
  const pageCounts = new Map<string, number>();
  for (const row of rows) {
    for (const path of new Set(row.paths || [])) pageCounts.set(path, (pageCounts.get(path) || 0) + 1);
  }
  const popularPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/75">Site traffic</p>
          <h2 className="mt-1 text-xl font-semibold">Visitors</h2>
        </div>
        <p className="text-xs text-white/45">Anonymous, approximate · started when this dashboard launched</p>
      </div>

      {loading ? <p className="mt-5 text-sm text-white/55">Loading traffic…</p> : error ? <p className="mt-5 text-sm text-rose-200">{error}</p> : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {periods.map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/15 p-4">
                <div className="text-sm text-white/55">{label}</div>
                <div className="mt-2 text-3xl font-semibold text-emerald-200">{value.visitors.toLocaleString()}</div>
                <div className="text-xs text-white/45">unique visitors · {value.views.toLocaleString()} page views</div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-sm font-semibold text-white/80">Popular pages · last 30 days</h3>
            {popularPages.length ? (
              <div className="mt-2 space-y-2">
                {popularPages.map(([path, visitors]) => (
                  <div key={path} className="flex items-center justify-between gap-4 text-sm">
                    <span className="truncate text-white/65">{path}</span>
                    <span className="shrink-0 text-white/45">{visitors} visitor{visitors === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-white/45">No visits recorded yet.</p>}
          </div>
        </>
      )}
    </section>
  );
}
