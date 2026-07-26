import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin-test",
        "/storage-test",
        "/export",
        "/import",
        "/import/",
        "/imports-review",
        "/submissions-review",
        "/tools",
        "/tools/",
        "/trash",
        "/profile",
        "/signin",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
