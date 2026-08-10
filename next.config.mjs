import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {
    root: import.meta.dirname,
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
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
    })
  : nextConfig;
