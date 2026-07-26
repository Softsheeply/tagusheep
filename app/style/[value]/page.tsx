import type { Metadata } from "next";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { serverDb } from "@/lib/firebase-server";
import { getSiteUrl } from "@/lib/site";
import { normalizeStyleNumber } from "@/lib/records";
import StyleClient from "./StyleClient";

export async function generateMetadata({ params }: { params: Promise<{ value: string }> }): Promise<Metadata> {
  const { value } = await params;
  const styleValue = normalizeStyleNumber(decodeURIComponent(value)) || "";
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/style/${encodeURIComponent(styleValue)}`;

  let count: number | null = null;
  try {
    const agg = await getCountFromServer(query(collection(serverDb, "tags"), where("styleNumber", "==", styleValue)));
    count = agg.data().count;
  } catch {
    count = null;
  }

  const title = `Style number ${styleValue} | Tagsheep`;
  const description = count != null
    ? `${count} record${count === 1 ? "" : "s"} for style number ${styleValue} on Tagsheep.`
    : `Look up style number ${styleValue} — brand, RN, and garment details on Tagsheep.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function StylePage() {
  return <StyleClient />;
}
