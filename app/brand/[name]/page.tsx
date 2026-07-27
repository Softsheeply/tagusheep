import type { Metadata } from "next";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { serverDb } from "@/lib/firebase-server";
import { getSiteUrl } from "@/lib/site";
import BrandClient from "./BrandClient";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const brand = decodeURIComponent(name);
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/brand/${encodeURIComponent(brand)}`;

  let count: number | null = null;
  try {
    const agg = await getCountFromServer(query(collection(serverDb, "tags"), where("brand", "==", brand)));
    count = agg.data().count;
  } catch {
    count = null;
  }

  const title = `${brand} clothing tags & style numbers | Tagsheep`;
  const description = count != null
    ? `${count} ${brand} garment record${count === 1 ? "" : "s"} on Tagsheep — style numbers, RNs, and label details for ${brand}.`
    : `Browse ${brand} garment records on Tagsheep — style numbers, RNs, and label details.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function BrandPage() {
  return <BrandClient />;
}
