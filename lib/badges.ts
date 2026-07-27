import type { TagRecord, VerificationStatus } from "@/lib/records";

export type BadgeDef = {
  key: string;
  title: string;
  description: string;
  image: string;
  unlocked: (stats: ContributorStats) => boolean;
};

export type ContributorStats = {
  uploadCount: number;
  verifiedCount: number;
  highQualityCount: number;
};

export const BADGES: BadgeDef[] = [
  {
    key: "first-upload",
    title: "First Upload",
    description: "Uploaded your first Tagsheep record.",
    image: "/badges/firstupload.png",
    unlocked: (stats) => stats.uploadCount >= 1,
  },
  {
    key: "10-uploads",
    title: "10 Uploads",
    description: "Added 10 records to Tagsheep.",
    image: "/badges/10uploads.png",
    unlocked: (stats) => stats.uploadCount >= 10,
  },
  {
    key: "50-uploads",
    title: "50 Uploads",
    description: "Added 50 records to Tagsheep.",
    image: "/badges/50uploads.png",
    unlocked: (stats) => stats.uploadCount >= 50,
  },
  {
    key: "100-uploads",
    title: "100 Uploads",
    description: "Added 100 records to Tagsheep.",
    image: "/badges/100uploads.png",
    unlocked: (stats) => stats.uploadCount >= 100,
  },
  {
    key: "250-uploads",
    title: "250 Uploads",
    description: "Added 250 records to Tagsheep.",
    image: "/badges/250uploads.png",
    unlocked: (stats) => stats.uploadCount >= 250,
  },
  {
    key: "500-uploads",
    title: "500 Uploads",
    description: "Added 500 records to Tagsheep.",
    image: "/badges/500uploads.png",
    unlocked: (stats) => stats.uploadCount >= 500,
  },
  {
    key: "1000-uploads",
    title: "1000 Uploads",
    description: "Added 1000 records to Tagsheep.",
    image: "/badges/1000uploads.png",
    unlocked: (stats) => stats.uploadCount >= 1000,
  },
  {
    key: "5000-uploads",
    title: "5000 Uploads",
    description: "Added 5000 records to Tagsheep.",
    image: "/badges/5000uploads.png",
    unlocked: (stats) => stats.uploadCount >= 5000,
  },
  {
    key: "100-verified",
    title: "100 Verified Uploads",
    description: "Reached 100 reviewed or verified uploads.",
    image: "/badges/100verifiedup.png",
    unlocked: (stats) => stats.verifiedCount >= 100,
  },
  {
    key: "high-quality",
    title: "High Quality Uploads",
    description: "Built a strong set of high-quality records.",
    image: "/badges/highqualityuploads.png",
    unlocked: (stats) => stats.highQualityCount >= 25,
  },
];

export function buildContributorStats(records: Partial<TagRecord>[]): ContributorStats {
  const uploadCount = records.length;
  const verifiedCount = records.filter((record) => {
    const status = record.verificationStatus as VerificationStatus | undefined | null;
    return status === "reviewed" || status === "verified";
  }).length;
  const highQualityCount = records.filter((record) => {
    const hasStyle = !!record.styleNumber?.trim();
    const hasRn = !!record.rn?.trim();
    const hasImage = !!record.imageUrl?.trim();
    return hasStyle && hasRn && hasImage;
  }).length;

  return { uploadCount, verifiedCount, highQualityCount };
}

export function getUnlockedBadges(stats: ContributorStats) {
  return BADGES.filter((badge) => badge.unlocked(stats));
}
