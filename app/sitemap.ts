import type { MetadataRoute } from "next";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { serverDb } from "@/lib/firebase-server";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 3600;

// Sitemaps cap out at 50,000 URLs; this is a generous ceiling for the
// current dataset size. Once the collection grows past this, split into
// a sitemap index (per-brand or per-date sitemaps) instead of one file.
const MAX_TAG_DOCS = 5000;

type SitemapTagDoc = {
  brand?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/tags`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/leaderboard`, changeFrequency: "daily", priority: 0.4 },
    { url: `${siteUrl}/upload`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/upload-guide`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/submit-info`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const snap = await getDocs(
      query(collection(serverDb, "tags"), orderBy("createdAt", "desc"), limit(MAX_TAG_DOCS))
    );

    const tagEntries: MetadataRoute.Sitemap = [];
    const brands = new Set<string>();
    const rns = new Set<string>();
    const styles = new Set<string>();

    snap.docs.forEach((doc) => {
      const data = doc.data() as SitemapTagDoc;
      tagEntries.push({ url: `${siteUrl}/tag/${doc.id}`, changeFrequency: "monthly", priority: 0.7 });
      if (data.brand) brands.add(data.brand);
      if (data.rn) rns.add(data.rn);
      if (data.styleNumber) styles.add(data.styleNumber);
    });

    const brandEntries: MetadataRoute.Sitemap = Array.from(brands).map((brand) => ({
      url: `${siteUrl}/brand/${encodeURIComponent(brand)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
    const rnEntries: MetadataRoute.Sitemap = Array.from(rns).map((rn) => ({
      url: `${siteUrl}/rn/${encodeURIComponent(rn)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
    const styleEntries: MetadataRoute.Sitemap = Array.from(styles).map((style) => ({
      url: `${siteUrl}/style/${encodeURIComponent(style)}`,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...staticEntries, ...tagEntries, ...brandEntries, ...rnEntries, ...styleEntries];
  } catch {
    // If Firestore is unreachable at build time, still ship the static routes.
    return staticEntries;
  }
}
