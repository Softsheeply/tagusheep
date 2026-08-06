"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import AuthPanel from "./AuthPanel";
import SmartImage from "./SmartImage";
import { auth, db } from "@/lib/firebase";

export default function TopNav() {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      setMenuOpen(false);
      if (!next) {
        setIsAdmin(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "admins", next.uid));
        setIsAdmin(snap.exists());
      } catch {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-white/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3" onClick={() => setMenuOpen(false)}>
          <SmartImage src="/badges/tagiconglass.png" alt="Tagsheep" width={56} height={56} loading="eager" className="h-11 w-11 object-contain sm:h-12 sm:w-12" />
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Tagsheep
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-2 text-sm md:flex">
          <NavLink href="/tags">Browse</NavLink>
          <NavLink href="/upload">Submit a tag</NavLink>
          {isAdmin && <NavLink href="/tools">Tools</NavLink>}
          {user && <NavLink href="/favorites">Favorites</NavLink>}
          {user && <NavLink href="/profile">Profile</NavLink>}
          <div className="ml-1">
            <AuthPanel compact />
          </div>
        </div>

        {/* Mobile: primary CTA + menu */}
        <div className="flex items-center gap-1 md:hidden">
          <Link
            href="/upload"
            className="rounded-lg bg-emerald-400/90 px-2.5 py-1.5 text-xs font-semibold text-black"
            onClick={() => setMenuOpen(false)}
          >
            Submit
          </Link>
          <div className="ml-0.5">
            <AuthPanel compact />
          </div>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-white/80 transition hover:bg-white/5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav-menu" className="border-t border-white/10 px-3 pb-3 md:hidden">
          <div className="flex flex-col gap-1 pt-2 text-sm">
            <MobileNavLink href="/tags" onClick={() => setMenuOpen(false)}>Browse</MobileNavLink>
            <MobileNavLink href="/upload" onClick={() => setMenuOpen(false)}>Submit a tag</MobileNavLink>
            {user && <MobileNavLink href="/favorites" onClick={() => setMenuOpen(false)}>Favorites</MobileNavLink>}
            {user && <MobileNavLink href="/profile" onClick={() => setMenuOpen(false)}>Profile</MobileNavLink>}
            {isAdmin && <MobileNavLink href="/tools" onClick={() => setMenuOpen(false)}>Tools</MobileNavLink>}
          </div>
        </div>
      )}
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

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-lg px-3 py-2.5 text-white/80 transition hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}
