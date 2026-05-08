"use client";

import { useEffect, useState } from "react";
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
  signOut,
  type User,
} from "firebase/auth";

type Mode = "signin" | "signup" | "reset";
const EMAIL_AUTH_ENABLED = false;

export default function AuthPanel({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "error" | "success" | "info"; text: string | null }>({ kind: "idle", text: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  async function loginWithGoogle() {
    try {
      setBusy(true);
      setStatus({ kind: "idle", text: null });
      await signInWithPopup(auth, google);
      setOpen(false);
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
      setOpen(false);
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

  async function logout() {
    await signOut(auth);
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {!compact && <span className="hidden sm:inline text-white/70">Signed in as <b className="text-white">{user.displayName || user.email}</b></span>}
        <button onClick={logout} className="rounded-full border border-white/15 px-3 py-1 transition hover:border-emerald-300/50">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full border border-white/15 px-3 py-1 text-sm transition hover:border-emerald-300/50">
        Sign in
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="flex min-h-full items-start justify-center overflow-y-auto px-4 pb-6 pt-12 sm:items-center sm:pt-20">
            <div className="relative z-[201] my-auto w-full max-w-md min-h-fit rounded-3xl border border-white/10 bg-[#0b1222] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Tagsheep account</p>
                <h2 className="text-2xl font-semibold">
                  {mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "Sign in"}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/70 hover:border-white/30 hover:text-white">
                Close
              </button>
            </div>

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
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                />
              </label>

              {mode !== "reset" && (
                <label className="block space-y-2">
                  <span className="text-sm text-white/80">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                  />
                </label>
              )}

              {mode === "signup" && (
                <label className="block space-y-2">
                  <span className="text-sm text-white/80">Confirm password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-xl border border-white/12 bg-[#09111f] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl border border-white/15 px-4 py-3 font-medium text-white transition hover:border-emerald-300/50 disabled:opacity-50"
              >
                {busy ? "Working…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Sign in with email"}
              </button>
                </form>
              </>
            )}

            {!EMAIL_AUTH_ENABLED && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                Google sign-in is the only enabled sign-in method right now.
              </div>
            )}

            {status.text && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${status.kind === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"}`}>
                {status.text}
              </div>
            )}

            <p className="mt-4 text-xs text-white/45">
              {EMAIL_AUTH_ENABLED ? "If email sign-in fails, Email/Password may still need to be enabled in Firebase Auth." : "Email/password sign-in is currently hidden until it is explicitly enabled and tested."}
            </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function friendlyAuthError(code?: string, fallback?: string) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "That email already has an account.";
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/weak-password":
      return "Password is too weak.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a bit.";
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "Email sign-in is not enabled in Firebase yet.";
    default:
      return fallback || "Authentication failed.";
  }
}

function tabClass(active: boolean) {
  return `rounded-full px-3 py-1 transition ${active ? "bg-emerald-400/15 text-emerald-200 border border-emerald-300/30" : "border border-white/10 text-white/65 hover:border-white/25 hover:text-white"}`;
}
