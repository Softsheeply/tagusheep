"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, google } from "@/lib/firebase";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from "firebase/auth";

const quickSearches = [
  "Louis Vuitton",
  "RN 66170",
  "style tee",
  "care label made in italy",
];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const searchHref = useMemo(() => {
    const q = search.trim();
    return q ? `/tags?q=${encodeURIComponent(q)}` : "/tags";
  }, [search]);

  async function login() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, google);
    } catch (e: any) {
      if (e?.code?.startsWith("auth/popup")) {
        await signInWithRedirect(auth, google);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await signOut(auth);
  }

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
            Brand, RN, style number, and label-detail lookup
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            TaguSheep is building the
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              {" "}
              clothing internet database
            </span>
            .
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-7 text-white/82 sm:text-lg">
            Search fashion pieces by brand, RN, style number, and label details. TaguSheep is its own thing: a growing public database for identifying clothing through clean reference labels and searchable metadata.
          </p>

          <div className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/6 p-4 shadow-[0_20px_90px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Louis Vuitton, RN, style number, care label text..."
                className="w-full rounded-2xl border border-white/12 bg-[#09111f] px-4 py-3 text-white placeholder:text-white/40 outline-none transition focus:border-emerald-300/60"
              />
              <Link
                href={searchHref}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400/90 px-5 py-3 font-semibold text-black transition hover:bg-emerald-300"
              >
                Search TaguSheep
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-left">
              <span className="text-xs uppercase tracking-[0.2em] text-white/45">Try:</span>
              {quickSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSearch(item)}
                  className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-sm text-white/76 transition hover:border-emerald-300/45 hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            <ValuePill title="Search first" body="Look up labels, style numbers, RN codes, and brand markers before anything else." />
            <ValuePill title="Reference photos" body="Best uploads are clean label images on a plain white backdrop with neutral framing." />
            <ValuePill title="Built to grow" body="Every structured upload makes the database better for the next search." />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-white/85">
                  Signed in as <b>{user.displayName || user.email}</b>
                </span>
                <button
                  onClick={logout}
                  className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/90 transition hover:border-white/40"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={login}
                disabled={authBusy}
                className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black transition hover:bg-emerald-300"
              >
                {authBusy ? "Opening…" : "Sign in with Google"}
              </button>
            )}

            <Link
              href="/tags"
              className="rounded-xl bg-white/12 px-4 py-2 text-white transition hover:bg-white/18 border border-white/15"
            >
              Browse database
            </Link>
            <Link
              href="/upload"
              className="rounded-xl border border-white/15 px-4 py-2 text-white transition hover:border-emerald-300/50"
            >
              Add reference label
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 pb-16 md:grid-cols-3">
        <Card
          title="Searchable clothing records"
          body="Look through a growing database of labels, tags, and identifying metadata across brands and product lines."
          badge="Database"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              <path d="M10 18a8 8 0 115.3-2.7l4.7 4.7-1.4 1.4-4.7-4.7A8 8 0 0110 18z" fill="currentColor" />
            </svg>
          }
        />
        <Card
          title="Style number ready"
          body="Track style numbers alongside brand and RN so people can identify specific pieces instead of only generic labels."
          badge="Lookup"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              <path d="M7 4h10v2H7V4zm-2 4h14v2H5V8zm2 4h10v2H7v-2zm-2 4h14v2H5v-2z" fill="currentColor" />
            </svg>
          }
        />
        <Card
          title="Reference-grade uploads"
          body="Contributors help build the archive with clean, moderated-looking label photos designed for reliable browsing and verification."
          badge="Archive"
          icon={
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" fill="currentColor" />
            </svg>
          }
        />
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-2xl border border-white/10 bg-white/6 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/90">
            Product direction
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Clothing lookup over gallery vibes</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:text-base">
            If someone wants to identify a Louis Vuitton shirt, they should be able to search by style number, RN, brand tag, care label text, or visual label cues and land on a strong reference page. Uploads matter because they feed the database — but the experience should feel like lookup and discovery first.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/8 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/95">
            Photo guidance
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Keep images clean</h2>
          <p className="mt-3 text-sm leading-6 text-white/78">
            Prefer labels photographed on a plain white background. Avoid cluttered home scenes, people, mirrors, or anything explicit — the database should feel neutral, clean, and easy to trust.
          </p>
        </div>
      </section>

      <section className="mb-20">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/7 shadow-[0_30px_120px_rgba(0,0,0,0.25)]">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_240px_at_20%_0%,rgba(45,212,191,0.18),transparent)]" />
          <div className="relative flex flex-col items-start justify-between gap-4 px-6 py-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold text-white">Ready to grow TaguSheep?</h3>
              <p className="text-sm leading-6 text-white/78">
                Search what is already indexed, or add a clean white-backdrop label photo with brand, RN, and style details to improve future results.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/tags"
                className="rounded-xl bg-white/12 px-4 py-2 font-medium text-white transition hover:bg-white/18"
              >
                Search database
              </Link>
              <Link
                href="/upload"
                className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black transition hover:bg-emerald-300"
              >
                Add record
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ValuePill({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4 text-left shadow-[0_10px_40px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-white/76">{body}</p>
    </div>
  );
}

function Card({
  title,
  body,
  badge,
  icon,
}: {
  title: string;
  body: string;
  badge: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/6 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.18)] backdrop-blur-sm">
      <div className="absolute -inset-px rounded-2xl bg-[linear-gradient(120deg,rgba(16,185,129,0.22),rgba(99,102,241,0.2))] blur-xl opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-start gap-3">
        <div className="mt-1 text-emerald-300">{icon}</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{title}</h3>
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/85">
              {badge}
            </span>
          </div>
          <p className="text-sm leading-6 text-white/76">{body}</p>
        </div>
      </div>
    </div>
  );
}
