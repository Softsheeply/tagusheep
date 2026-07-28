import * as Sentry from "@sentry/nextjs";

// Opt-in and inert until NEXT_PUBLIC_SENTRY_DSN is set (same pattern as the
// App Check scaffold in lib/firebase.ts): no DSN means Sentry.init() runs
// but never has anywhere to send events, so this is a no-op in local dev
// and in CI's placeholder-env builds.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
