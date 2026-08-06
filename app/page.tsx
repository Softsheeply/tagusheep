"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, getDocs, limit, orderBy, query } from "firebase/firestore";
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

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [browseTopics, setBrowseTopics] = useState<BrowseTopic[]>(allBrowseTopics.slice(0, 6));
  const [latest, setLatest] = useState<TagDoc[]>([]);
  const [totalTags, setTotalTags] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(20));
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

  const latestNews = useMemo(() => latest.slice(0, 5), [latest]);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="relative py-16 sm:py-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-20 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]"
        >
          <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>

        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/6 px-3 py-1 text-xs text-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Search clothing labels, style numbers, RN records, and brand details
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Tagsheep is the
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              {" "}
              clothing internet database
            </span>
            .
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Find any clothing tag by brand, RN number, or style number.
          </p>

          {totalTags !== null && totalTags > 0 && (
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 text-sm sm:text-base">
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-white/88">
                <span className="font-semibold text-white">{totalTags.toLocaleString()}</span> tags in the database
              </div>
            </div>
          )}

          <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-[0_20px_90px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                aria-label="Search Tagsheep"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Louis Vuitton, RN, style number, vintage hat, 1970s dress..."
                className="w-full rounded-2xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
              />
              <Link href={searchHref} className="inline-flex items-center justify-center rounded-2xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300">
                Search Tagsheep
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-left">
              <span className="text-xs uppercase tracking-[0.2em] text-white/45">Try:</span>
              {quickSearches.map((item) => (
                <button key={item} type="button" onClick={() => setSearch(item)} className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-sm text-white/76 transition hover:border-emerald-300/45 hover:text-white">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10 rounded-3xl border border-emerald-300/15 bg-emerald-400/8 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Contribute</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Found a tag? Submit it.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Photo, brand, and RN or style number is all you need. Works on your phone or desktop — submissions go live as pending tags right away.
            </p>
          </div>
          <Link href="/upload" className="inline-flex items-center justify-center rounded-2xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300">
            Submit a tag
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Browse by category</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Fresh categories each session</h2>
          </div>
          <button onClick={() => setBrowseTopics(shuffle(allBrowseTopics).slice(0, 6))} className="text-sm underline">
            Refresh categories
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {browseTopics.map((topic) => (
            <Link key={topic.title} href={topic.href} className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-300/35 hover:bg-white/7">
              <div className="text-lg font-semibold text-white">{topic.title}</div>
              <p className="mt-2 text-sm leading-6 text-white/70">{topic.note}</p>
            </Link>
          ))}
        </div>
      </section>

      {latestNews.length > 0 && (
        <section className="mb-10">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.22em] text-sky-200/80">Live activity</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Recent records</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latestNews.map((item) => {
              const photo = item.thumbnailUrl || item.imageUrl;
              return (
              <Link key={item.id} href={`/tag/${item.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-emerald-300/35 hover:bg-white/7">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={item.brand || "Tag"} className="mb-3 h-32 w-full rounded-xl object-contain bg-white/5" />
                )}
                <div className="font-semibold text-white">{item.brand || "Unknown brand"}</div>
                <div className="mt-0.5 text-sm text-white/55">{item.productName || item.garmentType || "View record"}</div>
              </Link>
              );
            })}
          </div>
          <div className="mt-4 text-center">
            <Link href="/tags" className="text-sm text-white/50 underline hover:text-white/80">Browse all records →</Link>
          </div>
        </section>
      )}
    </main>
  );
}
