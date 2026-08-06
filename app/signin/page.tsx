"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, google } from "@/lib/firebase";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";

type Mode = "signin" | "signup" | "reset";
const EMAIL_AUTH_ENABLED = false;

function safeNextPath(raw: string | null) {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export default function SignInPageWrapper() {
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}

function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);

  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "success" | "info"; text: string | null }>({ kind: "idle", text: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser && nextPath) {
        router.replace(nextPath);
      }
    });
    return () => unsub();
  }, [nextPath, router]);

  async function loginWithGoogle() {
    try {
      setBusy(true);
      setStatus({ kind: "idle", text: null });
      await signInWithPopup(auth, google);
    } catch (e: unknown) {
      const authError = e instanceof Error ? (e as Error & { code?: string }) : null;
      if (authError?.code?.startsWith("auth/popup")) {
        await signInWithRedirect(auth, google);
        return;
      }
      setStatus({ kind: "error", text: friendlyAuthError(authError?.code, authError?.message) });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle", text: null });

    if (!email.trim()) {
      setStatus({ kind: "error", text: "Enter your email." });
      return;
    }

    if (mode === "reset") {
      try {
        setBusy(true);
        await sendPasswordResetEmail(auth, email.trim());
        setStatus({ kind: "success", text: "Password reset email sent." });
      } catch (e: unknown) {
        const authError = e instanceof Error ? (e as Error & { code?: string }) : null;
        setStatus({ kind: "error", text: friendlyAuthError(authError?.code, authError?.message) });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setStatus({ kind: "error", text: "Password must be at least 6 characters." });
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setStatus({ kind: "error", text: "Passwords do not match." });
      return;
    }

    try {
      setBusy(true);
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      setPassword("");
      setConfirmPassword("");
      setStatus({ kind: "idle", text: null });
    } catch (e: unknown) {
      const authError = e instanceof Error ? (e as Error & { code?: string }) : null;
      setStatus({ kind: "error", text: friendlyAuthError(authError?.code, authError?.message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Tagsheep account</p>
        <h1 className="text-3xl font-semibold">{user ? "You’re signed in" : "Sign in"}</h1>
        <p className="mt-2 text-white/70">
          Sign in to upload tags, save favorites, earn contributor badges, and help grow the archive.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0b1222] p-6 shadow-2xl">
        {user ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Signed in as <b>{user.displayName || user.email}</b>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={nextPath || "/favorites"} className="rounded-xl bg-emerald-400/90 px-4 py-2 font-semibold text-black">
                {nextPath ? "Continue" : "Your favorites"}
              </Link>
              <Link href="/upload" className="rounded-xl border border-white/15 px-4 py-2 text-white">Go to upload</Link>
              <Link href="/profile" className="rounded-xl border border-white/15 px-4 py-2 text-white">View profile</Link>
            </div>
          </div>
        ) : (
          <>
            {EMAIL_AUTH_ENABLED && (
              <div className="mb-4 flex gap-2 text-sm">
                <button onClick={() => setMode("signin")} className={tabClass(mode === "signin")}>Sign in</button>
                <button onClick={() => setMode("signup")} className={tabClass(mode === "signup")}>Create account</button>
                <button onClick={() => setMode("reset")} className={tabClass(mode === "reset")}>Reset</button>
              </div>
            )}

            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={busy}
              className="mb-4 w-full rounded-xl bg-emerald-400/90 px-4 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
            >
              Continue with Google
            </button>

            {EMAIL_AUTH_ENABLED && (
              <>
                <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/35">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <label className="block space-y-2">
                    <span className="text-sm text-white/80">Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
                  </label>

                  {mode !== "reset" && (
                    <label className="block space-y-2">
                      <span className="text-sm text-white/80">Password</span>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
                    </label>
                  )}

                  {mode === "signup" && (
                    <label className="block space-y-2">
                      <span className="text-sm text-white/80">Confirm password</span>
                      <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60" />
                    </label>
                  )}

                  <button type="submit" disabled={busy} className="w-full rounded-xl border border-white/15 px-4 py-3 font-semibold text-white transition hover:border-emerald-300/40 disabled:opacity-50">
                    {busy ? "Working…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Sign in"}
                  </button>
                </form>
              </>
            )}

            {status.text && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status.kind === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : status.kind === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5 text-white/80"}`}>
                {status.text}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function tabClass(active: boolean) {
  return `rounded-lg px-3 py-1.5 transition ${active ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`;
}

function friendlyAuthError(code?: string, fallback?: string) {
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed.";
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/network-request-failed":
      return "Network error — check your connection.";
    default:
      return fallback || "Sign-in failed.";
  }
}
