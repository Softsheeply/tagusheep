"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import AuthPanel from "./AuthPanel";
import { auth } from "@/lib/firebase";

export default function TopNav() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-white/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badges/tagiconglass.png" alt="Tagsheep icon" className="h-[44px] w-[44px] object-contain" />
          <span className="bg-gradient-to-r from-emerald-300 via-sky-300 to-white bg-clip-text text-lg font-semibold tracking-wide text-transparent">Tagsheep</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/tags" className="transition hover:text-emerald-300">Browse</Link>
          <Link href="/upload" className="transition hover:text-emerald-300">Upload</Link>
          {user && <Link href="/mobile" className="transition hover:text-emerald-300">Quick upload</Link>}
          {user && <Link href="/profile" className="transition hover:text-emerald-300">Profile</Link>}
          {user && <Link href="/import" className="transition hover:text-emerald-300">Import URL</Link>}
          {user && <Link href="/tools" className="transition hover:text-emerald-300">Tools</Link>}
          <AuthPanel compact />
        </div>
      </div>
    </nav>
  );
}
