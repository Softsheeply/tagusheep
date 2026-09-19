"use client";

import Link from "next/link";
import { useState } from "react";
import AdminGate from "@/app/components/AdminGate";
import { auth } from "@/lib/firebase";

export default function ResetArchivePage() {
  return (
    <AdminGate title="Reset archive" description="Delete all tag records and start fresh.">
      <ResetTool />
    </AdminGate>
  );
}

function ResetTool() {
  const [confirm, setConfirm] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ deleted: number; backupPath?: string } | null>(null);

  async function runReset() {
    if (confirm !== "RESET TAGSHEEP") {
      setMessage('Type exactly: RESET TAGSHEEP');
      return;
    }
    setRunning(true);
    setMessage(null);
    setResult(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in as admin first.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/reset-archive", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Reset failed (${response.status}).`);
      const filename = payload.backupFilename || `tagsheep-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Array.isArray(payload.backup)) {
        const blob = new Blob([JSON.stringify(payload.backup, null, 2)], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(href);
      }
      setResult({ deleted: payload.deleted, backupPath: filename });
      setMessage("Archive cleared. A JSON backup downloaded. Start capturing your clothes from /capture.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-rose-200/80">Danger zone</p>
        <h1 className="text-2xl font-semibold">Reset archive</h1>
        <p className="mt-2 text-white/70">
          Deletes every document in the <code className="text-white/80">tags</code> collection. Photos in Cloudflare/Firebase storage are
          not auto-deleted — orphan cleanup can happen later.
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-white/65">
        <li>
          <Link href="/export" className="underline">
            Export a backup
          </Link>{" "}
          first.
        </li>
        <li>Type <strong className="text-white">RESET TAGSHEEP</strong> below.</li>
        <li>Click reset — then use <Link href="/capture" className="underline">Capture</Link> on your clothes.</li>
      </ol>

      <label className="block space-y-2">
        <span className="text-sm text-white/55">Confirmation</span>
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="w-full rounded-xl border border-white/15 bg-[#09111f] px-3 py-2 text-sm outline-none focus:border-rose-300/50"
          placeholder="RESET TAGSHEEP"
          disabled={running}
        />
      </label>

      <button
        type="button"
        onClick={runReset}
        disabled={running}
        className="rounded-xl bg-rose-500 px-5 py-3 font-semibold text-white transition hover:bg-rose-400 disabled:opacity-40"
      >
        {running ? "Resetting…" : "Reset all tag records"}
      </button>

      {message && <p className="text-sm text-white/75">{message}</p>}
      {result && (
        <p className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          Deleted {result.deleted} records.
          {result.backupPath ? ` Server backup: ${result.backupPath}` : ""}
        </p>
      )}
    </main>
  );
}
