import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// A malformed NEXT_PUBLIC_R2_PUBLIC_URL (missing protocol, typo, etc.) must
// not fail the entire build -- just skip optimizing R2 images.
function r2RemotePattern() {
  const url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!url) return null;
  try {
    return { protocol: "https" as const, hostname: new URL(url).hostname };
  } catch {
    return null;
  }
}

const r2Pattern = r2RemotePattern();

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    // Garment photos live in Firebase Storage/R2; this only allow-lists the
    // domain for next/image so it's ready to adopt -- no <img> tags use it
    // yet, since imported records can also reference arbitrary retailer
    // image URLs that this project doesn't control.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      ...(r2Pattern ? [r2Pattern] : []),
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
