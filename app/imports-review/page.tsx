"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { CORE_VERIFICATION_FIELDS, CORE_VERIFICATION_FIELD_LABELS, getVerificationPercent, normalizeBrand, normalizeStyleNumber, prepareRecord, type VerificationStatus, type SourceType } from "@/lib/records";
import { findPotentialDuplicates, type DuplicateCandidate } from "@/lib/duplicates";

type ReviewDoc = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  extraImageUrls?: string[];
  garmentType?: string | null;
  subCategory?: string | null;
  gender?: string | null;
  season?: string | null;
  madeIn?: string | null;
  materials?: string | null;
  careText?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceType?: SourceType | null;
  notes?: string | null;
  styleNumber?: string | null;
  rn?: string | null;
  size?: string | null;
  availableSizes?: string[];
  tags?: string[];
  category?: string | null;
  year?: string | null;
  color?: string | null;
  storagePath?: string | null;
  verificationStatus?: VerificationStatus | null;
  duplicateOfId?: string | null;
  createdBy?: string | null;
  createdAt?: unknown;
  importedAt?: string | null;
};

function duplicateKey(row: Pick<ReviewDoc, "brand" | "styleNumber">) {
  const brand = normalizeBrand(row.brand) || "";
  const style = normalizeStyleNumber(row.styleNumber) || "";
  return `${brand}::${style}`;
}

export default function ImportsReviewPage() {
  const [rows, setRows] = useState<ReviewDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Record<string, DuplicateCandidate[]>>({});
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!currentUser) {
      setRows([]);
      setLoading(false);
      setMessage("Please sign in to view the import review queue.");
      return;
    }

    if (!isAdmin) {
      setRows([]);
      setLoading(false);
      setMessage("Import review is admin-only right now.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const qRef = query(collection(db, "imports_review"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qRef);
      const loadedRows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReviewDoc, "id">) }));
      setRows(loadedRows);
      setExpandedIds(Object.fromEntries(loadedRows.map((row, index) => [row.id, index < 3])));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load import review queue.");
    } finally {
      setLoading(false);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (!currentUser) {
        if (!cancelled) {
          setAccessChecked(true);
          setIsAdmin(false);
        }
        return;
      }

      const snap = await getDoc(doc(db, "admins", currentUser.uid));
      if (!cancelled) {
        setIsAdmin(snap.exists());
        setAccessChecked(true);
      }
    }

    if (authChecked) {
      setAccessChecked(false);
      void checkAccess();
    }
    return () => {
      cancelled = true;
    };
  }, [authChecked, currentUser]);

  useEffect(() => {
    if (accessChecked) {
      void load();
    }
  }, [accessChecked, load]);

  const localDuplicateGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const key = duplicateKey(row);
      if (key === "::") continue;
      const current = groups.get(key) || [];
      current.push(row.id);
      groups.set(key, current);
    }
    return groups;
  }, [rows]);

  const queueStats = useMemo(() => {
    const stats = { total: rows.length, pending: 0, needsInfo: 0, rejected: 0, withImage: 0 };
    for (const row of rows) {
      const s = row.verificationStatus || "pending";
      if (s === "pending") stats.pending++;
      if (s === "needs_info") stats.needsInfo++;
      if (s === "rejected") stats.rejected++;
      if (row.imageUrl) stats.withImage++;
    }
    return stats;
  }, [rows]);

  function updateLocal(id: string, patch: Partial<ReviewDoc>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((item) => item.id !== id));
    setExpandedIds((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setDuplicates((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  async function saveDraft(row: ReviewDoc) {
    setBusyId(row.id);
    setMessage(null);
    try {
      await updateDoc(doc(db, "imports_review", row.id), {
        brand: row.brand || null,
        productName: row.productName || null,
        imageUrl: row.imageUrl || null,
        thumbnailUrl: row.thumbnailUrl || null,
        sourceUrl: row.sourceUrl || null,
        sourceName: row.sourceName || null,
        sourceType: row.sourceType || null,
        notes: row.notes || null,
        styleNumber: row.styleNumber || null,
        rn: row.rn || null,
        size: row.size || null,
        availableSizes: row.availableSizes || [],
        category: row.category || null,
        year: row.year || null,
        verificationStatus: row.verificationStatus || "pending",
        duplicateOfId: row.duplicateOfId || null,
      });
      setMessage("Draft updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function checkDuplicates(row: ReviewDoc) {
    const found = await findPotentialDuplicates(row.brand, row.styleNumber, row.rn);
    setDuplicates((prev) => ({ ...prev, [row.id]: found }));
  }

  async function mergeAsVariant(row: ReviewDoc, targetId: string) {
    setBusyId(row.id);
    setMessage(null);
    try {
      const targetSnap = await getDoc(doc(db, "tags", targetId));
      if (!targetSnap.exists()) {
        setMessage("Target record not found.");
        return;
      }
      const target = targetSnap.data();
      const existingExtras: string[] = Array.isArray(target.extraImageUrls) ? target.extraImageUrls : [];
      const newExtras = row.imageUrl ? [...existingExtras, row.imageUrl] : existingExtras;
      await updateDoc(doc(db, "tags", targetId), {
        extraImageUrls: newExtras,
        ...(row.color && !target.color ? { color: row.color } : {}),
      });
      await deleteDoc(doc(db, "imports_review", row.id));
      removeRow(row.id);
      setMessage("Merged as variant — photo added to existing record.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Merge failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAsDuplicate(row: ReviewDoc, duplicateId: string) {
    setBusyId(row.id);
    setMessage(null);
    try {
      await updateDoc(doc(db, "imports_review", row.id), {
        duplicateOfId: duplicateId,
        verificationStatus: "rejected",
      });
      updateLocal(row.id, { duplicateOfId: duplicateId, verificationStatus: "rejected" });
      setMessage("Marked as duplicate candidate.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not mark duplicate.");
    } finally {
      setBusyId(null);
    }
  }

  async function approve(row: ReviewDoc) {
    if (!auth.currentUser) {
      setMessage("Please sign in first.");
      return;
    }
    if (row.duplicateOfId) {
      setMessage("This row is marked as a duplicate. Clear that first or discard it.");
      return;
    }

    setBusyId(row.id);
    setMessage(null);
    try {
      // Built as an explicit allowlist rather than spreading ...row: the raw
      // imports_review document can carry bookkeeping-only fields (id,
      // importStatus, duplicateOfId, bulkImported, etc.) that aren't valid
      // on a tags document and would fail Firestore's schema validation.
      const payload = prepareRecord({
        imageUrl: row.imageUrl || "",
        thumbnailUrl: row.thumbnailUrl || null,
        extraImageUrls: row.extraImageUrls || [],
        brand: row.brand || null,
        productName: row.productName || null,
        garmentType: row.garmentType || null,
        subCategory: row.subCategory || null,
        gender: row.gender || null,
        season: row.season || null,
        madeIn: row.madeIn || null,
        materials: row.materials || null,
        careText: row.careText || null,
        color: row.color || null,
        storagePath: row.storagePath || null,
        sourceUrl: row.sourceUrl || null,
        sourceName: row.sourceName || null,
        sourceType: row.sourceType || null,
        notes: row.notes || null,
        styleNumber: row.styleNumber || null,
        rn: row.rn || null,
        size: row.size || null,
        availableSizes: row.availableSizes || [],
        tags: row.tags || [],
        category: row.category || null,
        year: row.year || null,
        verificationStatus: (row.verificationStatus as VerificationStatus) || "pending",
        createdBy: row.createdBy || auth.currentUser.uid,
        createdAt: row.createdAt || serverTimestamp(),
        importedAt: row.importedAt || new Date().toISOString(),
      });

      if (!payload.imageUrl) {
        const blockedNotes = [row.notes || "", "Approval blocked: missing primary image URL."].filter(Boolean).join("\n\n");
        await updateDoc(doc(db, "imports_review", row.id), {
          verificationStatus: "needs_info",
          notes: blockedNotes,
        });
        updateLocal(row.id, {
          verificationStatus: "needs_info",
          notes: blockedNotes,
        });
        setMessage("This import still needs a valid primary image before it can be approved into the main database.");
        return;
      }

      await addDoc(collection(db, "tags"), payload);
      await deleteDoc(doc(db, "imports_review", row.id));
      removeRow(row.id);
      setMessage("Import promoted to main database.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function discard(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await deleteDoc(doc(db, "imports_review", id));
      removeRow(id);
      setMessage("Review item removed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Review queue</p>
          <h1 className="text-3xl font-semibold">Imported candidates</h1>
          <p className="mt-2 max-w-2xl text-white/70">Edit partial imports here, then approve the good ones into the main database.</p>
        </div>
        <Link href="/tools" className="text-sm underline">← Back to tools</Link>
      </div>

      {!authChecked || !accessChecked || loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">Loading review queue…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">No pending import candidates.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total in queue" value={queueStats.total} />
            <StatCard label="Pending" value={queueStats.pending} />
            <StatCard label="Needs info" value={queueStats.needsInfo} />
            <StatCard label="Rejected / dupes" value={queueStats.rejected} />
            <StatCard label="With image" value={queueStats.withImage} />
          </div>

          {rows.map((row) => {
            const localGroup = localDuplicateGroups.get(duplicateKey(row)) || [];
            const hasLocalDuplicates = localGroup.length > 1;
            const externalDuplicates = duplicates[row.id] || [];
            const expanded = !!expandedIds[row.id];

            return (
              <div key={row.id} className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  {row.imageUrl ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.imageUrl} alt={row.productName || row.brand || "candidate"} className="w-full max-h-80 object-contain" />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-white/50">No image extracted</div>
                  )}

                  {row.sourceUrl && <a href={row.sourceUrl} target="_blank" className="block break-all text-sm text-emerald-200 underline">{row.sourceUrl}</a>}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <QueueBadge tone="neutral">{row.verificationStatus || "pending"}</QueueBadge>
                      {row.brand && <QueueBadge tone="subtle">Brand: {row.brand}</QueueBadge>}
                      {row.styleNumber && <QueueBadge tone="subtle">Style: {row.styleNumber}</QueueBadge>}
                      {row.rn && <QueueBadge tone="subtle">RN: {row.rn}</QueueBadge>}
                      {row.createdBy && <QueueBadge tone="subtle">By: {row.createdBy.slice(0, 8)}…</QueueBadge>}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.id)}
                      className="rounded-lg border border-white/15 px-3 py-1 text-xs text-white/80 transition hover:border-emerald-300/40 hover:text-white"
                    >
                      {expanded ? "Collapse details" : "Expand details"}
                    </button>
                  </div>

                  {!expanded ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                      Expand details to edit fields, inspect verification coverage, and fine-tune this submission before approval.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Brand" value={row.brand || ""} onChange={(value) => updateLocal(row.id, { brand: value })} />
                        <Field label="Product name" value={row.productName || ""} onChange={(value) => updateLocal(row.id, { productName: value })} />
                        <Field label="RN" value={row.rn || ""} onChange={(value) => updateLocal(row.id, { rn: value })} />
                        <Field label="Style number" value={row.styleNumber || ""} onChange={(value) => updateLocal(row.id, { styleNumber: value })} />
                        <Field label="Category" value={row.category || ""} onChange={(value) => updateLocal(row.id, { category: value })} />
                        <Field label="Size" value={row.size || ""} onChange={(value) => updateLocal(row.id, { size: value })} />
                        <Field label="Year" value={row.year || ""} onChange={(value) => updateLocal(row.id, { year: value })} />
                        <Field label="Source name" value={row.sourceName || ""} onChange={(value) => updateLocal(row.id, { sourceName: value })} />
                        <Field label="Image URL" value={row.imageUrl || ""} onChange={(value) => updateLocal(row.id, { imageUrl: value })} />
                        <Field label="Source URL" value={row.sourceUrl || ""} onChange={(value) => updateLocal(row.id, { sourceUrl: value })} />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Select label="Source type" value={row.sourceType || "unknown"} onChange={(value) => updateLocal(row.id, { sourceType: value as SourceType })} options={["manual", "official", "marketplace", "archive", "resale", "unknown"]} />
                        <Select label="Verification" value={row.verificationStatus || "needs_info"} onChange={(value) => updateLocal(row.id, { verificationStatus: value as VerificationStatus })} options={["draft", "needs_info", "pending", "reviewed", "verified", "rejected"]} />
                      </div>

                      <div className="text-sm text-emerald-200">Verification preview: {getVerificationPercent({ ...row, imageUrl: row.imageUrl || "" })}%</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {CORE_VERIFICATION_FIELDS.map((field) => {
                          const value = row[field];
                          const filled = Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value != null;
                          return (
                            <span key={field} className={`rounded-full border px-2 py-1 ${filled ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100" : "border-white/10 text-white/45"}`}>
                              {filled ? "✓ " : ""}{CORE_VERIFICATION_FIELD_LABELS[field]}
                            </span>
                          );
                        })}
                      </div>
                      <Field label="Available sizes (comma separated)" value={(row.availableSizes || []).join(", ")} onChange={(value) => updateLocal(row.id, { availableSizes: value.split(",").map((v) => v.trim()).filter(Boolean) })} />
                      <TextArea label="Notes" value={row.notes || ""} onChange={(value) => updateLocal(row.id, { notes: value })} rows={4} />
                    </>
                  )}

                  <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => checkDuplicates(row)} disabled={busyId === row.id} className="rounded-lg border border-white/20 px-3 py-1 text-white disabled:opacity-50">Check duplicates</button>
                      {externalDuplicates.length ? (
                        <span className="text-amber-200">Possible duplicates in database: {externalDuplicates.length}</span>
                      ) : duplicates[row.id] ? (
                        <span className="text-emerald-200">No database duplicates found</span>
                      ) : (
                        <span className="text-white/55">Checks likely duplicates using brand + style number before approval.</span>
                      )}
                    </div>

                    {hasLocalDuplicates && (
                      <div className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-400/10 px-3 py-2 text-fuchsia-100">
                        Queue warning: {localGroup.length} review items currently share this brand + style number.
                      </div>
                    )}

                    {row.duplicateOfId && (
                      <div className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-rose-100">
                        Marked as duplicate of record <code>{row.duplicateOfId}</code>.
                      </div>
                    )}
                  </div>

                  {externalDuplicates.length ? (
                    <div className="rounded-xl border border-amber-300/20 bg-amber-400/8 p-3 text-sm text-amber-100 space-y-2">
                      {externalDuplicates.map((dup) => (
                        <div key={dup.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate">{dup.brand || "Unknown brand"} — {dup.productName || "No title"}</div>
                            <div className="text-xs text-amber-100/70">Style: {dup.styleNumber || "—"}</div>
                            {dup.matchReason && <div className="text-xs text-amber-100/70">Matched by {dup.matchReason}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => mergeAsVariant(row, dup.id)} disabled={busyId === row.id} className="rounded-lg border border-sky-300/40 bg-sky-400/10 px-2 py-1 text-xs text-sky-100 disabled:opacity-50">Merge variant</button>
                            <button onClick={() => markAsDuplicate(row, dup.id)} disabled={busyId === row.id} className="rounded-lg border border-amber-200/40 px-2 py-1 text-xs text-amber-50 disabled:opacity-50">Mark duplicate</button>
                            <Link href={`/tag/${dup.id}`} className="underline text-xs">Open</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <button onClick={() => saveDraft(row)} disabled={busyId === row.id} className="rounded-xl border border-white/20 px-4 py-2 text-white disabled:opacity-50">Save draft</button>
                    <button onClick={() => approve(row)} disabled={busyId === row.id || !!row.duplicateOfId} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black disabled:opacity-50">Approve + Next</button>
                    <button onClick={() => discard(row.id)} disabled={busyId === row.id} className="rounded-xl border border-rose-300/35 px-4 py-2 text-rose-200 disabled:opacity-50">Discard + Next</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {message && <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">{message}</div>}
    </main>
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

function QueueBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "subtle" }) {
  return <span className={`rounded-full border px-2 py-1 ${tone === "subtle" ? "border-white/10 text-white/65" : "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"}`}>{children}</span>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" /></label>;
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block space-y-2"><span className="text-sm text-white/80">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
