"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildContributorStats, getUnlockedBadges, type ContributorStats } from "@/lib/badges";
import type { TagRecord } from "@/lib/records";

// Leaderboards are ranked over the most recent records, not the whole
// history -- fine for a young dataset, but if this grows past a few
// thousand records, move the aggregation server-side (a scheduled
// Cloud Function writing precomputed totals) instead of scanning client-side.
const MAX_RECORDS = 3000;

type RankedContributor = {
  uid: string;
  stats: ContributorStats;
};

export default function LeaderboardClient() {
  const [rows, setRows] = useState<RankedContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(MAX_RECORDS))
        );

        const byUser = new Map<string, Partial<TagRecord>[]>();
        snap.docs.forEach((doc) => {
          const data = doc.data() as Partial<TagRecord>;
          const uid = data.createdBy;
          if (!uid) return;
          // Bulk-imported records (licensed datasets, archive sources) carry
          // the importing admin's uid, but nobody photographed them -- they'd
          // hand whoever ran the import thousands of phantom "uploads" on a
          // board that's explicitly ranking people who contributed tags.
          if (data.sourceType === "archive") return;
          const existing = byUser.get(uid);
          if (existing) existing.push(data);
          else byUser.set(uid, [data]);
        });

        const ranked = Array.from(byUser.entries())
          .map(([uid, records]) => ({ uid, stats: buildContributorStats(records) }))
          .sort((a, b) => b.stats.uploadCount - a.stats.uploadCount)
          .slice(0, 50);

        setRows(ranked);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalContributors = useMemo(() => rows.length, [rows]);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Community</p>
        <h1 className="text-3xl font-semibold">Top contributors</h1>
        <p className="mt-2 max-w-2xl text-white/70">
          {`Ranked by uploads across the most recent ${MAX_RECORDS.toLocaleString()} records, excluding bulk-imported archive records. Contributors are shown by the first characters of their account ID rather than a name, since Tagsheep doesn't expose other users' profile info publicly.`}
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Loading…</div>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm text-rose-100">
          Couldn&apos;t load the leaderboard. Check your connection and try refreshing.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          No contributors yet.{" "}
          <Link href="/upload" className="underline">
            Be the first
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead className="bg-black/20 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Contributor</th>
                <th className="px-4 py-3 text-left">Uploads</th>
                <th className="px-4 py-3 text-left">Verified</th>
                <th className="px-4 py-3 text-left">Badges</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const badges = getUnlockedBadges(row.stats);
                const topBadge = badges[badges.length - 1];
                return (
                  <tr key={row.uid} className="border-t border-white/10">
                    <td className="px-4 py-3 text-white/60">{index + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/85">{row.uid.slice(0, 10)}…</td>
                    <td className="px-4 py-3">{row.stats.uploadCount}</td>
                    <td className="px-4 py-3">{row.stats.verifiedCount}</td>
                    <td className="px-4 py-3 text-white/70">{topBadge ? topBadge.title : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && totalContributors > 0 && (
        <p className="text-sm text-white/45">{totalContributors} contributor{totalContributors === 1 ? "" : "s"} shown.</p>
      )}
    </main>
  );
}
