import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";
import TagsClient from "./TagsClient";

const title = "Browse clothing tags, style numbers & RNs | Tagsheep";
const description =
  "Search Tagsheep's clothing tag database by brand, RN number, or style number to find real garment records with photos, materials, and source details.";

export const metadata: Metadata = {
  title,
  description,
  // Every ?q=... / filter combination is the same underlying page for search
  // engines -- canonicalize them all to the bare /tags URL so query-string
  // variants don't get indexed as separate thin-content pages.
  alternates: { canonical: `${getSiteUrl()}/tags` },
  openGraph: { title, description, url: `${getSiteUrl()}/tags`, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function TagsPage() {
  return <TagsClient />;
}
