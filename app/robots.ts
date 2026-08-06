import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
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
          "/favorites",
          "/signin",
        ],
      },
      {
        // AdMob's app-ads.txt verification crawler needs an explicit
        // allow, or it gets caught by the general disallow rules above.
        userAgent: "Google-adstxt",
        allow: "/",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
