"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SmartImage from "@/app/components/SmartImage";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, limit, startAfter, getDocs, getDoc, doc, setDoc, deleteDoc, increment, serverTimestamp, where, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { getVerificationPercent, normalizeStyleNumber, type SourceType, type VerificationStatus } from "@/lib/records";

type TagDoc = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  garmentType?: string | null;
  size?: string | null;
  availableSizes?: string[];
  tags?: string[];
  category?: string | null;
  gender?: string | null;
  color?: string | null;
  materials?: string | null;
  year?: string | null;
  sourceName?: string | null;
  sourceType?: SourceType | null;
  verificationStatus?: VerificationStatus | null;
  notes?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  storagePath?: string | null;
  createdBy?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

type SearchIntent = {
  raw: string;
  normalizedText: string;
  normalizedStyle: string | null;
  normalizedRn: string | null;
  brandWords: string[];
  styleTokens: string[];
  exactIdentifierQuery: boolean;
};

function parseSearchIntent(input: string): SearchIntent {
  const raw = input.trim();
  const normalizedText = raw.toLowerCase();
  const normalizedRn = raw.replace(/\D+/g, "") || null;
  const normalizedStyle = normalizeStyleNumber(raw);
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const brandWords = words.filter((word) => !/^rn$/i.test(word) && !/^style$/i.test(word) && !/^#/.test(word) && !/^\d+$/.test(word) && !/^rn\d+$/i.test(word));
  const styleTokens = (normalizedStyle || "").split(/[^A-Z0-9]+/).filter(Boolean);
  const exactIdentifierQuery = !!raw && ((normalizedRn?.length ?? 0) >= 3 || styleTokens.some((token) => /\d/.test(token)));

  return {
    raw,
    normalizedText,
    normalizedStyle,
    normalizedRn,
    brandWords,
    styleTokens,
    exactIdentifierQuery,
  };
}

function rankDoc(doc: TagDoc, intent: SearchIntent) {
  if (!intent.raw) return 0;

  const brand = (doc.brand || "").toLowerCase();
  const productName = (doc.productName || "").toLowerCase();
  const garmentType = (doc.garmentType || "").toLowerCase();
  const category = (doc.category || "").toLowerCase();
  const notes = (doc.notes || "").toLowerCase();
  const tags = (doc.tags || []).join(" ").toLowerCase();
  const normalizedDocStyle = normalizeStyleNumber(doc.styleNumber);
  const normalizedDocRn = (doc.rn || "").replace(/\D+/g, "") || null;
  const haystack = [brand, productName, normalizedDocRn || "", normalizedDocStyle || "", garmentType, category, tags, notes].join(" ");

  let score = 0;

  const brandWordMatches = intent.brandWords.filter((word) => brand.includes(word));

  if (intent.normalizedStyle && normalizedDocStyle === intent.normalizedStyle) score += 1000;
  if (intent.normalizedRn && normalizedDocRn === intent.normalizedRn) score += 950;

  if (intent.brandWords.length && intent.normalizedStyle && normalizedDocStyle === intent.normalizedStyle && brandWordMatches.length > 0) {
    score += 1200 + brandWordMatches.length * 90;
  }

  if (intent.brandWords.length && intent.normalizedRn && normalizedDocRn === intent.normalizedRn && brandWordMatches.length > 0) {
    score += 1150 + brandWordMatches.length * 90;
  }

  if (intent.brandWords.length > 0 && intent.styleTokens.some((token) => /\d/.test(token)) && brandWordMatches.length > 0) {
    score += 260;
  }

  if (intent.normalizedText && productName === intent.normalizedText) score += 500;
  if (intent.normalizedText && brand === intent.normalizedText) score += 300;
  if (intent.normalizedText && haystack.includes(intent.normalizedText)) score += 120;

  for (const word of intent.brandWords) {
    if (brand.includes(word)) score += 80;
    if (productName.includes(word)) score += 40;
    if (category.includes(word)) score += 20;
  }

  for (const token of intent.styleTokens) {
    if (normalizedDocStyle?.includes(token)) score += 30;
  }

  return score;
}

export default function TagsClient() {
  return (
    <Suspense fallback={<TagsPageSkeleton />}>
      <TagsPageInner />
    </Suspense>
  );
}

function TagsPageInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";

  const [docs, setDocs] = useState<TagDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastSnap, setLastSnap] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [q, setQ] = useState(initialQ);
  const [onlyWithRN, setOnlyWithRN] = useState(false);
  const [onlyWithStyle, setOnlyWithStyle] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [garmentTypeFilter, setGarmentTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [minVerified, setMinVerified] = useState("0");
  const [admin, setAdmin] = useState(false);
  const [exactStyleHits, setExactStyleHits] = useState<TagDoc[]>([]);
  const [exactRnHits, setExactRnHits] = useState<TagDoc[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const me = auth.currentUser?.uid ?? null;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "admins", uid)).then((s) => setAdmin(s.exists()));
  }, []);

  useEffect(() => {
    const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(60));
    const off = onSnapshot(
      qRef,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) })));
        setLoading(false);
        setLoadError(false);
        setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
        setExhausted(snap.size < 60);
      },
      () => {
        setLoading(false);
        setLoadError(true);
      }
    );
    return () => off();
  }, []);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    const io = new IntersectionObserver(async (entries) => {
      const [e] = entries;
      if (!e.isIntersecting || loadingMore || exhausted || !lastSnap) return;
      setLoadingMore(true);
      const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), startAfter(lastSnap), limit(60));
      const snap = await getDocs(qRef);
      const more = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) }));
      setDocs((prev) => [...prev, ...more]);
      setLastSnap(snap.docs[snap.docs.length - 1] ?? null);
      setExhausted(snap.size < 60);
      setLoadingMore(false);
    }, { rootMargin: "500px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lastSnap, loadingMore, exhausted]);

  const garmentTypes = useMemo(() => Array.from(new Set(docs.map((d) => d.garmentType).filter(Boolean) as string[])).sort(), [docs]);
  const searchIntent = useMemo(() => parseSearchIntent(q), [q]);

  useEffect(() => {
    let cancelled = false;

    async function runLookups() {
      if (!searchIntent.exactIdentifierQuery) {
        setExactStyleHits([]);
        setExactRnHits([]);
        setLookupLoading(false);
        return;
      }

      setLookupLoading(true);
      try {
        const [styleSnap, rnSnap] = await Promise.all([
          searchIntent.normalizedStyle
            ? getDocs(query(collection(db, "tags"), where("styleNumber", "==", searchIntent.normalizedStyle), orderBy("createdAt", "desc"), limit(24)))
            : Promise.resolve(null),
          searchIntent.normalizedRn
            ? getDocs(query(collection(db, "tags"), where("rn", "==", searchIntent.normalizedRn), orderBy("createdAt", "desc"), limit(24)))
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setExactStyleHits(styleSnap ? styleSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) })) : []);
        setExactRnHits(rnSnap ? rnSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) })) : []);
      } catch {
        if (!cancelled) {
          setExactStyleHits([]);
          setExactRnHits([]);
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }

    runLookups();
    return () => {
      cancelled = true;
    };
  }, [searchIntent]);

  const filtered = useMemo(() => {
    const t = searchIntent.normalizedText;
    const minVerifiedNum = Number(minVerified || "0");

    const matched = docs.filter((d) => {
      const haystack = [
        d.brand ?? "",
        d.productName ?? "",
        d.rn ?? "",
        d.styleNumber ?? "",
        d.garmentType ?? "",
        d.size ?? "",
        ...(d.availableSizes || []),
        ...(d.tags || []),
        d.category ?? "",
        d.gender ?? "",
        d.color ?? "",
        d.materials ?? "",
        d.year ?? "",
        d.sourceName ?? "",
        d.notes ?? "",
      ].join(" ").toLowerCase();

      const normalizedDocStyle = normalizeStyleNumber(d.styleNumber) || "";
      const normalizedDocRn = (d.rn || "").replace(/\D+/g, "");
      const exactStyleMatch = !!searchIntent.normalizedStyle && normalizedDocStyle === searchIntent.normalizedStyle;
      const exactRnMatch = !!searchIntent.normalizedRn && normalizedDocRn === searchIntent.normalizedRn;
      const matchText = t ? haystack.includes(t) || exactStyleMatch || exactRnMatch : true;
      const matchRN = onlyWithRN ? !!d.rn && d.rn.trim().length > 0 : true;
      const matchStyle = onlyWithStyle ? !!d.styleNumber && d.styleNumber.trim().length > 0 : true;
      const matchVerified = verifiedOnly ? d.verificationStatus === "verified" || d.verificationStatus === "reviewed" : true;
      const matchGarmentType = garmentTypeFilter === "all" ? true : (d.garmentType || "").toLowerCase() === garmentTypeFilter.toLowerCase();
      const matchYear = yearFilter.trim() ? (d.year || "").toLowerCase().includes(yearFilter.trim().toLowerCase()) : true;
      const matchTag = tagFilter.trim() ? (d.tags || []).join(" ").toLowerCase().includes(tagFilter.trim().toLowerCase()) : true;
      const matchColor = colorFilter.trim() ? (d.color || "").toLowerCase().includes(colorFilter.trim().toLowerCase()) : true;
      const matchMaterial = materialFilter.trim() ? (d.materials || "").toLowerCase().includes(materialFilter.trim().toLowerCase()) : true;
      const matchGender = genderFilter.trim() ? (d.gender || "").toLowerCase().includes(genderFilter.trim().toLowerCase()) : true;
      const matchSize = sizeFilter.trim()
        ? ((d.size || "").toLowerCase().includes(sizeFilter.trim().toLowerCase()) || (d.availableSizes || []).join(" ").toLowerCase().includes(sizeFilter.trim().toLowerCase()))
        : true;
      const matchPercent = getVerificationPercent(d) >= minVerifiedNum;

      return matchText && matchRN && matchStyle && matchVerified && matchGarmentType && matchYear && matchTag && matchColor && matchMaterial && matchGender && matchSize && matchPercent;
    });

    return matched
      .map((doc) => ({ doc, score: rankDoc(doc, searchIntent) }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.doc);
  }, [docs, searchIntent, onlyWithRN, onlyWithStyle, verifiedOnly, garmentTypeFilter, yearFilter, tagFilter, colorFilter, materialFilter, genderFilter, sizeFilter, minVerified]);

  const exactStyleMatches = useMemo(() => {
    const map = new Map<string, TagDoc>();
    for (const d of exactStyleHits) map.set(d.id, d);
    for (const d of filtered) {
      if (searchIntent.normalizedStyle && normalizeStyleNumber(d.styleNumber) === searchIntent.normalizedStyle) {
        map.set(d.id, d);
      }
    }
    return Array.from(map.values()).sort((a, b) => rankDoc(b, searchIntent) - rankDoc(a, searchIntent));
  }, [exactStyleHits, filtered, searchIntent]);

  const exactRnMatches = useMemo(() => {
    const map = new Map<string, TagDoc>();
    for (const d of exactRnHits) map.set(d.id, d);
    for (const d of filtered) {
      if (searchIntent.normalizedRn && (d.rn || "").replace(/\D+/g, "") === searchIntent.normalizedRn) {
        map.set(d.id, d);
      }
    }
    return Array.from(map.values()).sort((a, b) => rankDoc(b, searchIntent) - rankDoc(a, searchIntent));
  }, [exactRnHits, filtered, searchIntent]);

  const highlightedIds = useMemo(() => new Set([...exactStyleMatches, ...exactRnMatches].map((d) => d.id)), [exactStyleMatches, exactRnMatches]);
  const generalResults = useMemo(() => filtered.filter((d) => !highlightedIds.has(d.id)), [filtered, highlightedIds]);

  const hasNoResults = exactStyleMatches.length === 0 && exactRnMatches.length === 0 && generalResults.length === 0;

  // Signed-in-only zero-result searches are a demand signal for what to source
  // next; debounced so we only log a query once the user settles on it.
  useEffect(() => {
    const trimmed = q.trim();
    if (loading || !hasNoResults || trimmed.length < 2 || !auth.currentUser) return;

    const timer = window.setTimeout(() => {
      const normalizedQuery = trimmed.toLowerCase().slice(0, 200);
      const missId = normalizedQuery.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 300) || "query";
      setDoc(
        doc(db, "search_misses", missId),
        {
          query: trimmed.slice(0, 200),
          normalizedQuery,
          count: increment(1),
          firstSearchedAt: serverTimestamp(),
          lastSearchedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [q, loading, hasNoResults]);

  async function moveToTrash(d: TagDoc) {
    if (busyId) return;
    if (!admin && me !== d.createdBy) return;
    if (!confirm("Move this record to Trash?")) return;

    try {
      setBusyId(d.id);
      const trashDoc = { ...d, originalId: d.id, trashedAt: new Date().toISOString(), trashedBy: me };
      await setDoc(doc(db, "trash", d.id), trashDoc);
      await deleteDoc(doc(db, "tags", d.id));
    } catch (e: unknown) {
      alert("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Tagsheep archive</p>
          <h1 className="text-2xl font-semibold">Browse clothing tags</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/import" className="underline opacity-80 hover:opacity-100">Import URL</Link>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.2)] space-y-4">
        <input type="search" aria-label="Search tags" className="w-full rounded-xl border border-white/12 bg-[#09111f] p-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60" placeholder="Search brand, product name, RN, style number, category, year, source..." value={q} onChange={(e) => setQ(e.target.value)} />

        {searchIntent.exactIdentifierQuery && (
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-100">
            <div className="font-medium">Identifier-first lookup is active</div>
            <div className="mt-1 text-emerald-100/75">
              Exact style number and RN matches are fetched directly from the database and shown first before broader text matches.
            </div>
            {lookupLoading && <div className="mt-2 text-xs text-emerald-100/65">Checking exact identifier matches…</div>}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4 text-sm text-white/78">
          <label className="block space-y-2">
            <span className="text-white/60">Garment type</span>
            <select value={garmentTypeFilter} onChange={(e) => setGarmentTypeFilter(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white">
              <option value="all">All</option>
              {garmentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Year / era</span>
            <input value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} placeholder="e.g. 1990, 70s" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white" />
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Tag</span>
            <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="#vintage, denim" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white" />
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Min verified %</span>
            <select value={minVerified} onChange={(e) => setMinVerified(e.target.value)} className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white">
              <option value="0">0%</option>
              <option value="20">20%</option>
              <option value="40">40%</option>
              <option value="60">60%</option>
              <option value="80">80%</option>
              <option value="100">100%</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Color</span>
            <input value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} placeholder="black, blue, red" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white" />
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Material</span>
            <input value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} placeholder="cotton, wool, denim" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white" />
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Gender / category</span>
            <input value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} placeholder="mens, womens, unisex" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white" />
          </label>

          <label className="block space-y-2">
            <span className="text-white/60">Size</span>
            <input value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} placeholder="M, 32, XL, one size" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-3 py-2 text-white" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-white/78">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={onlyWithRN} onChange={(e) => setOnlyWithRN(e.target.checked)} />Only with RN</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={onlyWithStyle} onChange={(e) => setOnlyWithStyle(e.target.checked)} />Only with style number</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />Reviewed / verified only</label>
          <span className="text-white/50">{filtered.length + [...highlightedIds].filter((id) => !filtered.some((doc) => doc.id === id)).length} surfaced result{filtered.length + [...highlightedIds].filter((id) => !filtered.some((doc) => doc.id === id)).length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {loading ? (
        <SkeletonMasonry />
      ) : loadError ? (
        <div className="mt-8 space-y-4 text-center">
          <p className="text-white/60">Couldn&apos;t load tags. Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
          >
            Retry
          </button>
        </div>
      ) : hasNoResults ? (
        <div className="mt-8 space-y-4 text-center">
          <p className="text-white/60">No records found for <b className="text-white">{q}</b>.</p>
          <p className="text-sm text-white/45">This tag isn&apos;t in the database yet.</p>
          <Link
            href={`/upload?${new URLSearchParams({ ...(searchIntent.normalizedRn ? { rn: searchIntent.normalizedRn } : {}), ...(searchIntent.normalizedStyle ? { styleNumber: searchIntent.normalizedStyle } : {}), ...(q && !searchIntent.normalizedRn && !searchIntent.normalizedStyle ? { brand: q } : {}) }).toString()}`}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
          >
            Be the first to submit this tag
          </Link>
        </div>
      ) : (
        <>
          {exactStyleMatches.length > 0 && (
            <ResultsSection title={`Exact style number matches${searchIntent.normalizedStyle ? `: ${searchIntent.normalizedStyle}` : ""}`} docs={exactStyleMatches} admin={admin} me={me} busyId={busyId} moveToTrash={moveToTrash} />
          )}

          {exactRnMatches.length > 0 && (
            <ResultsSection title={`Exact RN matches${searchIntent.normalizedRn ? `: ${searchIntent.normalizedRn}` : ""}`} docs={exactRnMatches.filter((d) => !exactStyleMatches.some((styleDoc) => styleDoc.id === d.id))} admin={admin} me={me} busyId={busyId} moveToTrash={moveToTrash} />
          )}

          {generalResults.length > 0 && (
            <ResultsSection title={highlightedIds.size > 0 ? "Broader matches" : "Results"} docs={generalResults} admin={admin} me={me} busyId={busyId} moveToTrash={moveToTrash} />
          )}

          <div ref={loadMoreRef} className="h-12 flex items-center justify-center">
            {loadingMore && <span className="text-sm text-white/70">Loading more…</span>}
            {exhausted && <span className="text-sm text-white/50">End of results</span>}
          </div>
        </>
      )}
    </main>
  );
}

function ResultsSection({ title, docs, admin, me, busyId, moveToTrash }: { title: string; docs: TagDoc[]; admin: boolean; me: string | null; busyId: string | null; moveToTrash: (doc: TagDoc) => Promise<void>; }) {
  if (!docs.length) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-xs uppercase tracking-wide text-white/45">{docs.length} match{docs.length === 1 ? "" : "es"}</span>
      </div>
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:balance]">
        {docs.map((d) => (
          <RecordCard key={d.id} d={d} admin={admin} me={me} busyId={busyId} moveToTrash={moveToTrash} />
        ))}
      </div>
    </section>
  );
}

function RecordCard({ d, admin, me, busyId, moveToTrash }: { d: TagDoc; admin: boolean; me: string | null; busyId: string | null; moveToTrash: (doc: TagDoc) => Promise<void>; }) {
  return (
    <div className="group relative mb-4 break-inside-avoid">
      <Link href={`/tag/${d.id}`} className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:shadow-md">
        <div className="relative aspect-[4/5] overflow-hidden">
          {d.thumbnailUrl || d.imageUrl ? (
            <SmartImage src={d.thumbnailUrl || d.imageUrl} alt={d.brand ?? "tag"} fill sizes="(min-width: 1024px) 25vw, 50vw" className="bg-white object-contain" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-white/[0.03] p-4 text-center">
              <svg className="h-8 w-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>
              <div>
                <div className="text-xs text-white/40">No photo yet</div>
                <div className="mt-1 text-[11px] font-medium text-emerald-400/80">Be the first to snap this tag →</div>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-1 p-3 text-sm">
          <div className="font-medium truncate text-white">{d.brand || "Unknown brand"}</div>
          <div className="truncate text-white/78">{d.productName || "—"}</div>
          <div className="text-white/70">RN: {d.rn || "—"}</div>
          <div className="text-white/70">Style: {d.styleNumber || "—"}</div>
          <div className="text-white/70">Type: {d.garmentType || "—"}</div>
          <div className="text-white/70">Size: {d.size || ((d.availableSizes || []).length ? d.availableSizes?.join(", ") : "—")}</div>
          <div className="flex flex-wrap gap-2 pt-1 text-[11px] uppercase tracking-wide">
            <VerificationBadge status={d.verificationStatus} />
            <Badge subtle>{getVerificationPercent(d)}% verified</Badge>
            {d.sourceType && <Badge subtle>{d.sourceType}</Badge>}
            {d.createdBy && <Badge subtle>community submitted</Badge>}
          </div>
        </div>
      </Link>

      {(admin || me === d.createdBy) && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Link href={`/tag/${d.id}`} className="rounded bg-emerald-500/90 px-2 py-1 text-xs text-black hover:bg-emerald-400">Edit</Link>
          <button disabled={busyId === d.id} onClick={() => moveToTrash(d)} className="rounded border border-amber-400 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10 disabled:opacity-50" title="Move to Trash">
            {busyId === d.id ? "…" : "Trash"}
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ children, subtle = false }: { children: React.ReactNode; subtle?: boolean }) {
  return <span className={`rounded-full border px-2 py-0.5 ${subtle ? "border-white/15 text-white/55" : "border-emerald-300/35 text-emerald-200"}`}>{children}</span>;
}

function VerificationBadge({ status }: { status?: string | null }) {
  if (status === "verified") return <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">✓ Tagsheep Verified</span>;
  if (status === "reviewed") return <span className="rounded-full border border-sky-300/35 bg-sky-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-200">Reviewed</span>;
  if (status === "rejected") return <span className="rounded-full border border-rose-300/35 bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-200">Rejected</span>;
  if (status === "needs_info") return <span className="rounded-full border border-fuchsia-300/35 bg-fuchsia-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-200">Needs Info</span>;
  return <span className="rounded-full border border-amber-300/35 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200">Pending</span>;
}

function TagsPageSkeleton() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Tagsheep database</p>
          <h1 className="text-2xl font-semibold">Search clothing records</h1>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
        <div className="h-12 animate-pulse rounded-xl bg-white/10" />
      </div>
      <SkeletonMasonry />
    </main>
  );
}

function SkeletonMasonry() {
  return (
    <div className="mt-6 columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="aspect-[4/5] animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/10" />
            <div className="h-3 w-1/4 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
