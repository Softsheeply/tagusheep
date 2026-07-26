import type { Metadata } from "next";
import { collection, getCountFromServer, getDocs, limit, query, where } from "firebase/firestore";
import { serverDb } from "@/lib/firebase-server";
import { getSiteUrl } from "@/lib/site";
import RnClient from "./RnClient";

export async function generateMetadata({ params }: { params: Promise<{ value: string }> }): Promise<Metadata> {
  const { value } = await params;
  const rn = decodeURIComponent(value);
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/rn/${encodeURIComponent(rn)}`;

  let count: number | null = null;
  let brands: string[] = [];
  try {
    const rnQuery = query(collection(serverDb, "tags"), where("rn", "==", rn));
    const [agg, snap] = await Promise.all([
      getCountFromServer(rnQuery),
      getDocs(query(rnQuery, limit(5))),
    ]);
    count = agg.data().count;
    brands = Array.from(new Set(snap.docs.map((d) => (d.data().brand as string | undefined) || "").filter(Boolean)));
  } catch {
    count = null;
  }

  const title = `RN ${rn}${brands[0] ? ` — ${brands[0]}` : ""} | Tagsheep`;
  const description = count != null
    ? `RN ${rn} is registered to ${brands.length > 0 ? brands.join(", ") : "a clothing company"}. ${count} record${count === 1 ? "" : "s"} on Tagsheep.`
    : `Look up RN ${rn} — registered company name, brand, and garment records on Tagsheep.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function RNPage() {
  return <RnClient />;
}
