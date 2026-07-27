import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";
import LeaderboardClient from "./LeaderboardClient";

const title = "Top contributors | Tagsheep";
const description = "See who's added the most clothing tags, style numbers, and RN records to Tagsheep.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${getSiteUrl()}/leaderboard` },
  openGraph: { title, description, url: `${getSiteUrl()}/leaderboard`, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
