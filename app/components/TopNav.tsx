"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import AuthPanel from "./AuthPanel";
import SmartImage from "./SmartImage";
import { auth } from "@/lib/firebase";

export default function TopNav() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-white/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
          <SmartImage src="/badges/tagiconglass.png" alt="Tagsheep" width={48} height={48} loading="eager" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
          <span className="hidden bg-gradient-to-r from-emerald-300 via-sky-300 to-white bg-clip-text text-xl font-semibold tracking-wide text-transparent sm:block">Tagsheep</span>
        </Link>

        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <NavLink href="/tags">Browse</NavLink>
          <NavLink href="/upload">Submit a tag</NavLink>
          {user && <NavLink href="/tools">Tools</NavLink>}
          {user && <NavLink href="/profile">Profile</NavLink>}
          <div className="ml-1">
            <AuthPanel compact />
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}
