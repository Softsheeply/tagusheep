import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    // Garment photos live in Firebase Storage; this only allow-lists the
    // domain for next/image so it's ready to adopt -- no <img> tags use it
    // yet, since imported records can also reference arbitrary retailer
    // image URLs that this project doesn't control.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      ...(process.env.NEXT_PUBLIC_R2_PUBLIC_URL
        ? [{ protocol: "https" as const, hostname: new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname }]
        : []),
    ],
  },
};

// Safe to wrap unconditionally: without SENTRY_ORG/SENTRY_PROJECT/
// SENTRY_AUTH_TOKEN set, the plugin just skips sourcemap upload rather than
// failing the build -- same no-op-until-configured pattern as instrumentation
// .ts and instrumentation-client.ts.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
