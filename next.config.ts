import type { NextConfig } from "next";

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
    ],
  },
};

export default nextConfig;
