import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    // Garment photos live in Firebase Storage and/or Cloudflare Images; this
    // only allow-lists those domains for next/image. Imported records can also
    // reference arbitrary retailer image URLs that this project doesn't control,
    // and SmartImage falls back to a plain <img> for those.
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "imagedelivery.net" },
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
