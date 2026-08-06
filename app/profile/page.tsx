"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import SmartImage from "@/app/components/SmartImage";
import { auth, db } from "@/lib/firebase";
import { buildContributorStats, getUnlockedBadges } from "@/lib/badges";
import type { TagRecord } from "@/lib/records";

type ContributorRecord = Pick<TagRecord, "brand" | "rn" | "styleNumber" | "imageUrl" | "verificationStatus"> & {
  id?: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [records, setRecords] = useState<ContributorRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRecords(uid: string) {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "tags"), where("createdBy", "==", uid)));
        if (!cancelled) {
          setRecords(snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ContributorRecord) })));
        }
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    void loadRecords(user.uid);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = useMemo(() => buildContributorStats(records), [records]);
  const unlockedBadges = useMemo(() => getUnlockedBadges(stats), [stats]);

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Contributor profile</p>
          <h1 className="text-3xl font-semibold">Your Tagsheep profile</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Track your uploads, badge progress, and the quality of the records you have added to Tagsheep.
          </p>
        </div>
      </div>

      {!user ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/75">
          Use the <b className="text-white">Sign in</b> button at the top right to see your contributor stats and unlocked badges.
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/75">Loading your profile…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Uploads" value={stats.uploadCount} help="Records created from your account" />
            <StatCard label="Reviewed / verified" value={stats.verifiedCount} help="Uploads that made it further through review" />
            <StatCard label="High quality" value={stats.highQualityCount} help="Uploads with image + RN + style number" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-semibold">Unlocked badges</h2>
                <p className="mt-2 text-sm text-white/65">Badges unlock automatically from your contribution history.</p>
              </div>
              <span className="text-sm text-white/50">{unlockedBadges.length} unlocked</span>
            </div>

            {unlockedBadges.length === 0 ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                No badges yet. Upload your first record to get started.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {unlockedBadges.map((badge) => (
                  <div key={badge.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <SmartImage src={badge.image} alt={badge.title} width={96} height={96} className="mb-3 h-24 w-24 object-contain" />
                    <div className="font-semibold text-white">{badge.title}</div>
                    <p className="mt-1 text-sm text-white/65">{badge.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-2xl font-semibold">Keep going</h2>
                <p className="mt-2 text-sm text-white/65">The fastest way to level up is still the same: upload clear tag photos with style numbers and RN info.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href="/upload" className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black">Submit a tag</Link>
              <Link href="/favorites" className="rounded-xl border border-white/15 px-4 py-2 text-white">Your favorites</Link>
              <Link href="/tags" className="rounded-xl border border-white/15 px-4 py-2 text-white">Browse tags</Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm text-white/65">{help}</p>
    </div>
  );
}
