import type { Metadata } from "next";
import { cache } from "react";
import { doc, getDoc } from "firebase/firestore";
import { serverDb } from "@/lib/firebase-server";
import { getSiteUrl } from "@/lib/site";
import TagDetailClient from "./TagDetailClient";

type TagMetaDoc = {
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  garmentType?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  notes?: string | null;
};

const getTagForMeta = cache(async (id: string) => {
  try {
    const snap = await getDoc(doc(serverDb, "tags", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as TagMetaDoc) };
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/tag/${id}`;
  const tag = await getTagForMeta(id);

  if (!tag) {
    return {
      title: "Tag not found | Tagsheep",
      alternates: { canonical: url },
      robots: { index: false, follow: true },
    };
  }

  const titleLead = [tag.brand, tag.productName].filter(Boolean).join(" ") || "Clothing tag";
  const identifiers = [tag.styleNumber ? `Style ${tag.styleNumber}` : null, tag.rn ? `RN ${tag.rn}` : null]
    .filter(Boolean)
    .join(" · ");
  const title = `${titleLead}${identifiers ? ` (${identifiers})` : ""} | Tagsheep`;

  const descriptionParts = [
    [tag.brand, tag.productName].filter(Boolean).join(" "),
    tag.garmentType,
    tag.color,
    tag.styleNumber ? `style number ${tag.styleNumber}` : null,
    tag.rn ? `RN ${tag.rn}` : null,
  ].filter(Boolean);
  const description = descriptionParts.length > 0
    ? `${descriptionParts.join(", ")} — clothing tag record on Tagsheep.`
    : "Clothing tag record on Tagsheep, the searchable garment identifier database.";

  const image = tag.imageUrl || tag.thumbnailUrl || undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TagDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteUrl = getSiteUrl();
  const tag = await getTagForMeta(id);

  const jsonLd = tag
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: [tag.brand, tag.productName].filter(Boolean).join(" ") || "Clothing item",
        ...(tag.brand ? { brand: { "@type": "Brand", name: tag.brand } } : {}),
        ...(tag.imageUrl || tag.thumbnailUrl ? { image: tag.imageUrl || tag.thumbnailUrl } : {}),
        ...(tag.notes ? { description: tag.notes } : {}),
        ...(tag.styleNumber ? { sku: tag.styleNumber } : {}),
        ...(tag.color ? { color: tag.color } : {}),
        url: `${siteUrl}/tag/${id}`,
        ...(tag.rn
          ? { additionalProperty: [{ "@type": "PropertyValue", name: "RN", value: tag.rn }] }
          : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // JSON.stringify escapes quotes but not "</script>"; guard against a
          // user-submitted field breaking out of the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <TagDetailClient />
    </>
  );
}
