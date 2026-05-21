"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminGate from "@/app/components/AdminGate";

type SubmissionDoc = {
  id: string;
  productRef?: string | null;
  mode?: string | null;
  details?: string | null;
  contact?: string | null;
  submittedBy?: string | null;
  createdAt?: unknown;
  status?: string | null;
};

export default function SubmissionsReviewPage() {
  const [rows, setRows] = useState<SubmissionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const qRef = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qRef);
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubmissionDoc, "id">) })));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      corrections: rows.filter((row) => (row.mode || "correction") === "correction").length,
      reports: rows.filter((row) => row.mode === "report").length,
      pending: rows.filter((row) => (row.status || "pending_review") === "pending_review").length,
    };
  }, [rows]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await updateDoc(doc(db, "submissions", id), { status });
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
      setMessage(`Submission marked ${status}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update submission.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeSubmission(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await deleteDoc(doc(db, "submissions", id));
      setRows((prev) => prev.filter((row) => row.id !== id));
      setMessage("Submission removed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not remove submission.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminGate
      title="Submission review"
      description="Review correction and report submissions from the community."
    >
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Admin tools</p>
            <h1 className="text-3xl font-semibold">Submission review</h1>
            <p className="mt-2 max-w-2xl text-white/70">Review community corrections and problem reports so they do not disappear into a void.</p>
          </div>
          <Link href="/tools" className="text-sm underline">← Back to tools</Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total submissions" value={stats.total} />
          <StatCard label="Corrections" value={stats.corrections} />
          <StatCard label="Reports" value={stats.reports} />
          <StatCard label="Pending" value={stats.pending} />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Loading submissions…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">No submissions waiting right now.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge>{row.mode === "report" ? "Report" : "Correction"}</Badge>
                    <SubtleBadge>{row.status || "pending_review"}</SubtleBadge>
                    {row.productRef && <SubtleBadge>Tag: {row.productRef}</SubtleBadge>}
                    {row.submittedBy && <SubtleBadge>By: {row.submittedBy.slice(0, 8)}…</SubtleBadge>}
                  </div>
                  {row.productRef && <Link href={`/tag/${row.productRef}`} className="text-sm underline">Open related tag</Link>}
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/85 whitespace-pre-wrap">
                    {row.details || "No details submitted."}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/75 space-y-2">
                    <div><span className="text-white/45">Contact:</span> {row.contact || "—"}</div>
                    <div><span className="text-white/45">Mode:</span> {row.mode || "correction"}</div>
                    <div><span className="text-white/45">Status:</span> {row.status || "pending_review"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                  <button onClick={() => updateStatus(row.id, "reviewed")} disabled={busyId === row.id} className="rounded-xl border border-white/20 px-4 py-2 text-white disabled:opacity-50">Mark reviewed</button>
                  <button onClick={() => updateStatus(row.id, "applied")} disabled={busyId === row.id} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black disabled:opacity-50">Mark applied</button>
                  <button onClick={() => removeSubmission(row.id)} disabled={busyId === row.id} className="rounded-xl border border-rose-300/35 px-4 py-2 text-rose-200 disabled:opacity-50">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
      </main>
    </AdminGate>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString()}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-1 text-emerald-100">{children}</span>;
}

function SubtleBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-white/10 px-2 py-1 text-white/65">{children}</span>;
}
