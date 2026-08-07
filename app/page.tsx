"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from "firebase/firestore";
import SmartImage from "@/app/components/SmartImage";
import SaveButton from "@/app/components/SaveButton";
import { db } from "@/lib/firebase";

const quickSearches = ["Louis Vuitton", "RN 66170", "vintage hat", "1970s dress"];
const allBrowseTopics = [
  { title: "Vintage", href: "/tags?q=vintage", note: "Older labels, era clues, archival pieces" },
  { title: "Hats", href: "/tags?q=hat", note: "Caps, beanies, label tags, maker marks" },
  { title: "Dresses", href: "/tags?q=dress", note: "Brand tags, care labels, structured lookups" },
  { title: "1970s", href: "/tags?q=1970", note: "Era-first browsing for older garments" },
  { title: "Luxury", href: "/tags?q=louis%20vuitton", note: "Designer style numbers and references" },
  { title: "Sportswear", href: "/tags?q=activewear", note: "Performance tags, RN numbers, season clues" },
  { title: "Denim", href: "/tags?q=jeans", note: "Jeans, jackets, vintage fades, maker marks" },
  { title: "Workwear", href: "/tags?q=workwear", note: "Utility labels, canvas pieces, heritage brands" },
  { title: "Accessories", href: "/tags?q=accessory", note: "Belts, scarves, tags, trims and add-ons" },
  { title: "Outerwear", href: "/tags?q=jacket", note: "Coats, shells, padded labels, seasonal clues" },
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

type BrowseTopic = (typeof allBrowseTopics)[number];

function shuffle<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function photoOf(tag: TagDoc) {
  return tag.thumbnailUrl || tag.imageUrl || null;
}

export default function HomePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [browseTopics, setBrowseTopics] = useState<BrowseTopic[]>(allBrowseTopics.slice(0, 6));
  const [latest, setLatest] = useState<TagDoc[]>([]);
  const [totalTags, setTotalTags] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(48));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) }));
        setLatest(rows);
        const countSnap = await getCountFromServer(collection(db, "tags"));
        setTotalTags(countSnap.data().count);
      } catch {
        setLatest([]);
        setTotalTags(null);
      }
    })();
  }, []);

  const searchHref = useMemo(() => {
    const q = search.trim();
    return q ? `/tags?q=${encodeURIComponent(q)}` : "/tags";
  }, [search]);

  const photographed = useMemo(
    () => latest.filter((tag) => Boolean(photoOf(tag))),
    [latest]
  );

  const heroPhotos = useMemo(() => {
    const base = photographed.slice(0, 36);
    if (base.length === 0) return [];
    // Repeat so the full-bleed columns stay dense even with a small archive.
    while (base.length < 28) base.push(...photographed.slice(0, Math.min(8, photographed.length)));
    return base.slice(0, 36);
  }, [photographed]);

  const archivePhotos = useMemo(() => photographed.slice(0, 12), [photographed]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(searchHref);
  }

  const columns = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, colIndex) =>
      heroPhotos.filter((_, i) => i % count === colIndex)
    );
  }, [heroPhotos]);

  return (
    <main>
      {/* Hybrid hero: real clothing plane at ~60vh, copy high and tight, archive next */}
      <section className="relative isolate min-h-[min(58vh,520px)] overflow-hidden sm:min-h-[min(64vh,600px)]">
        <div aria-hidden className="absolute inset-0">
          {heroPhotos.length > 0 ? (
            <div className="home-hero-drift grid h-[125%] w-full grid-cols-3 gap-0.5 sm:grid-cols-4 sm:gap-1 lg:grid-cols-5">
              {columns.map((column, colIndex) => (
                <div
                  key={colIndex}
                  className={`flex flex-col gap-0.5 sm:gap-1 ${
                    colIndex % 3 === 1 ? "home-hero-drift-slow" : colIndex % 3 === 2 ? "home-hero-drift-slower" : ""
                  } ${colIndex === 4 ? "hidden lg:flex" : colIndex === 3 ? "hidden sm:flex" : ""}`}
                >
                  {column.map((tag, rowIndex) => {
                    const src = photoOf(tag)!;
                    return (
                      <div
                        key={`${tag.id}-${colIndex}-${rowIndex}`}
                        className="relative aspect-[3/4] overflow-hidden bg-white/5"
                      >
                        <SmartImage
                          src={src}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 25vw, 33vw"
                          className="object-cover"
                          loading={rowIndex < 2 ? "eager" : "lazy"}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.18),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(56,189,248,0.12),transparent_40%),linear-gradient(180deg,#122038,#090f1c)]" />
          )}
          {/* Soft overall veil; denser only under the copy so garments stay loud up top */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#090f1c]/20 via-[#0b1222]/35 to-[#090f1c]/95" />
          <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#090f1c] via-[#090f1c]/75 to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[min(58vh,520px)] max-w-6xl flex-col justify-end px-4 pb-7 pt-16 sm:min-h-[min(64vh,600px)] sm:px-6 sm:pb-9 sm:pt-20">
          <div className="home-hero-copy max-w-2xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <SmartImage
                src="/badges/tagiconglass.png"
                alt=""
                width={96}
                height={96}
                loading="eager"
                className="h-12 w-12 object-contain sm:h-[4.5rem] sm:w-[4.5rem]"
              />
              <h1 className="font-[family-name:var(--font-display)] text-[2.75rem] font-semibold leading-none tracking-tight text-white sm:text-6xl">
                Tagsheep
              </h1>
            </div>
            <p className="font-[family-name:var(--font-display)] text-base leading-tight text-emerald-100/90 sm:text-xl">
              The clothing tag database.
            </p>
            <p className="max-w-lg text-sm leading-snug text-white/75 sm:text-[0.95rem] sm:leading-6">
              Look up garments by brand, RN, or style number — browse tags people are photographing into the archive.
            </p>

            <form onSubmit={onSearch} className="flex max-w-xl flex-col gap-2 pt-0.5 sm:flex-row sm:gap-2.5">
              <input
                type="search"
                aria-label="Search Tagsheep"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Brand, RN, style number…"
                className="w-full border border-white/15 bg-[#09111f]/92 px-3.5 py-2.5 text-white outline-none transition placeholder:text-white/40 focus:border-emerald-300/60 sm:py-3"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center bg-emerald-400/90 px-5 py-2.5 font-semibold text-black transition hover:bg-emerald-300 sm:py-3"
              >
                Search the archive
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm text-white/55">
              {totalTags !== null && totalTags > 0 && (
                <span>
                  <span className="font-medium text-white">{totalTags.toLocaleString()}</span> tags indexed
                </span>
              )}
              <Link href="/upload" className="underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white/60">
                Submit a tag
              </Link>
              <Link href="/tags" className="underline decoration-white/25 underline-offset-4 transition hover:text-white hover:decoration-white/60">
                Browse all
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Photo-first archive strip — what Tagsheep is about */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-6">
        <div className="mb-2.5 flex items-end justify-between gap-4 sm:mb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">From the archive</p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-white sm:text-3xl">
              Clothing, identified.
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-white/65 sm:leading-6">
              Every record starts with a tag photo. Scroll a few — this is the product.
            </p>
          </div>
          <Link href="/tags" className="hidden shrink-0 text-sm text-white/55 underline underline-offset-4 hover:text-white sm:inline">
            Open browse →
          </Link>
        </div>

        {archivePhotos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-3">
            {archivePhotos.map((tag, index) => {
              const src = photoOf(tag)!;
              return (
                <div key={tag.id} className="group relative">
                  <Link
                    href={`/tag/${tag.id}`}
                    className="relative block aspect-[3/4] overflow-hidden bg-white/5 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                  >
                    <SmartImage
                      src={src}
                      alt={tag.brand || "Clothing tag"}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading={index < 4 ? "eager" : "lazy"}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-16">
                      <div className="truncate text-sm font-medium text-white">{tag.brand || "Unknown brand"}</div>
                      <div className="truncate text-xs text-white/65">
                        {tag.styleNumber ? `Style ${tag.styleNumber}` : tag.rn ? `RN ${tag.rn}` : tag.productName || tag.garmentType || "View record"}
                      </div>
                    </div>
                  </Link>
                  <div className="absolute left-2 top-2 z-10">
                    <SaveButton
                      compact
                      tag={{
                        tagId: tag.id,
                        brand: tag.brand,
                        productName: tag.productName,
                        rn: tag.rn,
                        styleNumber: tag.styleNumber,
                        imageUrl: tag.imageUrl,
                        thumbnailUrl: tag.thumbnailUrl,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl text-white">The archive is waiting for its first photos.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
              Submit a clear tag photo with brand and an RN or style number — it goes live as pending right away.
            </p>
            <Link href="/upload" className="mt-6 inline-flex bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300">
              Submit the first tag
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 sm:hidden">
          <Link href="/tags" className="text-sm text-white/55 underline underline-offset-4">
            Open browse →
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <span className="self-center text-xs uppercase tracking-[0.18em] text-white/40">Try searching</span>
          {quickSearches.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => router.push(`/tags?q=${encodeURIComponent(item)}`)}
              className="border border-white/12 bg-white/[0.04] px-3 py-1.5 text-sm text-white/70 transition hover:border-emerald-300/40 hover:text-white"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="border-y border-emerald-300/10 bg-emerald-400/[0.06]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">How to contribute</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-white sm:text-3xl">
                Three things. Live as pending.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                No approval gate — your tag shows up in search right away so the archive grows with every photo.
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex shrink-0 items-center justify-center bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
            >
              Submit a tag
            </Link>
          </div>

          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { step: "1", title: "Photograph the tag", body: "Clear, bright, readable — brand label, care tag, or style sticker." },
              { step: "2", title: "Add brand + RN or style", body: "Those identifiers are what make Tagsheep searchable later." },
              { step: "3", title: "Hit submit", body: "It goes live as pending. Save favorites while you browse others." },
            ].map((item) => (
              <li key={item.step} className="border-t border-white/15 pt-4">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Step {item.step}</div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-lg text-white">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-white/60">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Browse by feel</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-white sm:text-3xl">
              Start somewhere familiar
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setBrowseTopics(shuffle(allBrowseTopics).slice(0, 6))}
            className="text-sm text-white/55 underline underline-offset-4 hover:text-white"
          >
            Shuffle
          </button>
        </div>

        <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {browseTopics.map((topic) => (
            <Link key={topic.title} href={topic.href} className="group block border-t border-white/10 pt-4 transition hover:border-emerald-300/40">
              <div className="font-[family-name:var(--font-display)] text-lg text-white transition group-hover:text-emerald-200">
                {topic.title}
              </div>
              <p className="mt-1 text-sm leading-6 text-white/60">{topic.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
