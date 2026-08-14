"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from "firebase/firestore";
import SmartImage from "@/app/components/SmartImage";
import SaveButton from "@/app/components/SaveButton";
import { db } from "@/lib/firebase";

const quickSearches = ["Louis Vuitton", "RN 66170", "vintage hat", "1970s dress"];
const browseGroups = [
  { title: "Vintage", href: "/tags?q=vintage", note: "Older labels and era clues" },
  { title: "Denim", href: "/tags?q=jeans", note: "Jeans, jackets and maker marks" },
  { title: "Dresses", href: "/tags?q=dress", note: "Brand and care labels" },
  { title: "Luxury", href: "/tags?q=louis%20vuitton", note: "Designer references" },
  { title: "Hats", href: "/tags?q=hat", note: "Caps, beanies and maker marks" },
  { title: "Sportswear", href: "/tags?q=activewear", note: "Performance and season clues" },
];

type TagDoc = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  garmentType?: string | null;
  styleNumber?: string | null;
  rn?: string | null;
  tags?: string[];
  category?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  verificationStatus?: string | null;
};

function photoOf(tag: TagDoc) {
  return tag.thumbnailUrl || tag.imageUrl || null;
}

function recordDetail(tag: TagDoc) {
  if (tag.styleNumber) return `Style ${tag.styleNumber}`;
  if (tag.rn) return `RN ${tag.rn}`;
  return tag.productName || tag.garmentType || "Open record";
}

export default function HomePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [latest, setLatest] = useState<TagDoc[]>([]);
  const [totalTags, setTotalTags] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(48));
        const snap = await getDocs(qRef);
        setLatest(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) })));
        const countSnap = await getCountFromServer(collection(db, "tags"));
        setTotalTags(countSnap.data().count);
      } catch {
        setLatest([]);
        setTotalTags(null);
      }
    })();
  }, []);

  const records = useMemo(() => latest.filter((tag) => Boolean(photoOf(tag))), [latest]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const value = search.trim();
    router.push(value ? `/tags?q=${encodeURIComponent(value)}` : "/tags");
  }

  return (
    <main className="database-home">
      <section className="border-b border-white/10 bg-[#0b1423] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Community clothing archive</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Identify clothing from the label.
            </h1>
            <p className="mt-1 text-sm leading-5 text-white/60">
              Search brands, RN numbers and style codes—or add a label that is missing.
            </p>
          </div>

          <form onSubmit={onSearch} className="flex w-full max-w-3xl gap-2">
            <input
              type="search"
              aria-label="Search Tagsheep"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Brand, RN, style number, garment…"
              className="min-w-0 flex-1 border border-white/20 bg-[#060c16] px-4 py-3 text-base text-white outline-none placeholder:text-white/35 focus:border-emerald-300"
            />
            <button type="submit" className="shrink-0 bg-emerald-400 px-5 py-3 font-semibold text-black hover:bg-emerald-300">
              Search
            </button>
          </form>
        </div>
      </section>

      <nav aria-label="Archive shortcuts" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 bg-[#08101d] px-4 py-3 text-sm sm:px-6 lg:px-8">
        <span className="font-semibold text-white">
          {totalTags === null ? "Archive" : `${totalTags.toLocaleString()} records`}
        </span>
        <Link href="/tags" className="text-white/65 hover:text-white">Recently added</Link>
        <Link href="/wanted" className="text-white/65 hover:text-white">Most searched</Link>
        <Link href="/tags?q=pending" className="text-white/65 hover:text-white">Needs identification</Link>
        <Link href="/upload" className="font-semibold text-emerald-300 hover:text-emerald-200">+ Add a tag</Link>
      </nav>

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#0a1220] px-5 py-6 lg:block">
          <div className="sticky top-24 space-y-8">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Browse archive</h2>
              <div className="mt-3 space-y-1">
                {browseGroups.map((group) => (
                  <Link key={group.title} href={group.href} className="group block border-l border-white/10 py-1.5 pl-3 hover:border-emerald-300">
                    <span className="block text-sm font-medium text-white/85 group-hover:text-white">{group.title}</span>
                    <span className="block text-xs text-white/40">{group.note}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Try a search</h2>
              <div className="mt-3 flex flex-col items-start gap-2">
                {quickSearches.map((item) => (
                  <button key={item} type="button" onClick={() => router.push(`/tags?q=${encodeURIComponent(item)}`)} className="text-left text-sm text-white/60 underline decoration-white/15 underline-offset-4 hover:text-white">
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-emerald-300/20 bg-emerald-400/[0.06] p-4">
              <h2 className="font-semibold text-white">Have the label?</h2>
              <p className="mt-1 text-xs leading-5 text-white/55">Photograph it, add the identifiers and help the archive grow.</p>
              <Link href="/upload" className="mt-3 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200">Submit a tag →</Link>
            </div>
          </div>
        </aside>

        <section className="min-w-0 bg-[#070e19] px-3 py-5 sm:px-5 lg:px-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Recently added</h2>
              <p className="text-xs text-white/45">The newest records in the archive</p>
            </div>
            <Link href="/tags" className="shrink-0 text-sm text-emerald-300 hover:text-emerald-200">View all →</Link>
          </div>

          {records.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {records.map((tag, index) => (
                <article key={tag.id} className="group min-w-0 border border-white/10 bg-[#0c1524] hover:border-white/25">
                  <Link href={`/tag/${tag.id}`} className="relative block aspect-[4/5] overflow-hidden bg-white/5">
                    <SmartImage
                      src={photoOf(tag)!}
                      alt={tag.brand || "Clothing record"}
                      fill
                      sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.025]"
                      loading={index < 8 ? "eager" : "lazy"}
                    />
                    <span className="absolute bottom-2 left-2 border border-black/10 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                      {tag.verificationStatus || "Archive record"}
                    </span>
                  </Link>
                  <div className="flex min-h-24 items-start justify-between gap-2 p-3">
                    <Link href={`/tag/${tag.id}`} className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-white">{tag.brand || "Unknown brand"}</h3>
                      <p className="mt-0.5 truncate text-xs text-white/55">{recordDetail(tag)}</p>
                      {(tag.category || tag.garmentType) && <p className="mt-2 truncate text-[11px] uppercase tracking-wide text-white/35">{tag.category || tag.garmentType}</p>}
                    </Link>
                    <SaveButton
                      compact
                      tag={{ tagId: tag.id, brand: tag.brand, productName: tag.productName, rn: tag.rn, styleNumber: tag.styleNumber, imageUrl: tag.imageUrl, thumbnailUrl: tag.thumbnailUrl }}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-white/15 bg-white/[0.025] px-6 py-20 text-center">
              <h2 className="text-xl font-semibold text-white">No archive records loaded</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/55">Search the archive or contribute a clear photograph of a clothing label.</p>
              <div className="mt-5 flex justify-center gap-3">
                <Link href="/tags" className="border border-white/20 px-4 py-2 text-sm text-white hover:border-white/40">Browse</Link>
                <Link href="/upload" className="bg-emerald-400 px-4 py-2 text-sm font-semibold text-black">Add a tag</Link>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
            {browseGroups.map((group) => (
              <Link key={group.title} href={group.href} className="border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/65 hover:text-white">{group.title}</Link>
            ))}
          </div>

          <section className="mt-7 grid border border-white/10 bg-[#0b1422] md:grid-cols-[1fr_auto]">
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Contribute</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Add a label in under a minute.</h2>
              <p className="mt-1 max-w-2xl text-sm text-white/55">Photograph the tag, add its brand and identifiers, then publish it as a pending community record.</p>
            </div>
            <Link href="/upload" className="flex items-center justify-center border-t border-white/10 bg-emerald-400 px-7 py-4 font-semibold text-black hover:bg-emerald-300 md:border-l md:border-t-0">Submit a tag</Link>
          </section>
        </section>
      </div>
    </main>
  );
}
