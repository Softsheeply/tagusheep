"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
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

const outfitSlots = [
  { title: "Pants", query: "pants" },
  { title: "Shirt", query: "shirt" },
  { title: "Hat", query: "hat" },
  { title: "Accessory", query: "accessory" },
];

type TagDoc = {
  id: string;
  brand?: string | null;
  productName?: string | null;
  garmentType?: string | null;
  tags?: string[];
  category?: string | null;
  imageUrl?: string | null;
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

  useEffect(() => {
    (async () => {
      try {
        const qRef = query(collection(db, "tags"), orderBy("createdAt", "desc"), limit(20));
        const snap = await getDocs(qRef);
        setLatest(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TagDoc, "id">) })));
      } catch {
        setLatest([]);
      }
    })();
  }, []);

  const searchHref = useMemo(() => {
    const q = search.trim();
    return q ? `/tags?q=${encodeURIComponent(q)}` : "/tags";
  }, [search]);

  const outfitCards = useMemo(() => {
    return outfitSlots.map((slot) => {
      const match = latest.find((item) => {
        const hay = `${item.productName || ""} ${item.garmentType || ""} ${(item.tags || []).join(" ")} ${item.category || ""}`.toLowerCase();
        return hay.includes(slot.query);
      });
      return { ...slot, match };
    });
  }, [latest]);

  const latestNews = useMemo(() => {
    return latest.slice(0, 3);
  }, [latest]);

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

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/82 sm:text-lg">
            Tagsheep is a community-built clothing tag database for thrifters, resellers, and vintage hunters.
          </p>

          <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-[0_20px_90px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
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
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Mobile upload</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Out thrifting? Use the quick phone upload.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Open Tagsheep on your phone, snap a shirt or tag, add the basics you know, and upload fast without the full desktop form.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/mobile" className="inline-flex items-center justify-center rounded-2xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300">
              Open quick upload
            </Link>
            <Link href="/upload" className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-white transition hover:border-white/30">
              Full upload form
            </Link>
          </div>
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

      <section className="mb-10 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/6 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/90">Outfit of the day</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Build an outfit from the database</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
            As records go in, this section starts using real images from the archive. If a slot has no matching record yet, it still gives you a place to start filling the database.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {outfitCards.map((slot) => (
              <Link key={slot.title} href={slot.match ? `/tag/${slot.match.id}` : `/tags?q=${encodeURIComponent(slot.query)}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-emerald-300/35">
                <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/35 text-sm">
                  {slot.match?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slot.match.imageUrl} alt={slot.match.productName || slot.title} className="h-full w-full object-contain bg-white" />
                  ) : (
                    <span>{slot.title} image here later</span>
                  )}
                </div>
                <div className="text-lg font-semibold text-white">{slot.title}</div>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  {slot.match ? `${slot.match.brand || "Unknown brand"} — ${slot.match.productName || "View record"}` : `Browse ${slot.title.toLowerCase()} records and start filling this slot.`}
                </p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/6 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200/90">Latest in Tagsheep</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Recent records</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/78">
            {latestNews.length ? latestNews.map((item) => (
              <Link key={item.id} href={`/tag/${item.id}`} className="block rounded-xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-emerald-300/35">
                <div className="font-semibold text-white">{item.brand || "Unknown brand"}</div>
                <div className="text-white/70">{item.productName || "Untitled record"}</div>
              </Link>
            )) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">No records yet — start uploading and importing to bring this section to life.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
