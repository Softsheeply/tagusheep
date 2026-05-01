import { clampConfidence, safeTrim } from "@/lib/validation";

export type VerificationStatus = "draft" | "needs_info" | "pending" | "reviewed" | "verified" | "rejected";
export type SourceType = "manual" | "official" | "marketplace" | "archive" | "resale" | "unknown";

export type TagRecord = {
  id?: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  garmentType?: string | null;
  tags?: string[];
  category?: string | null;
  subCategory?: string | null;
  gender?: string | null;
  year?: string | null;
  season?: string | null;
  madeIn?: string | null;
  materials?: string | null;
  careText?: string | null;
  color?: string | null;
  notes?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  extraImageUrls?: string[];
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceType?: SourceType | null;
  confidence?: number | null;
  verificationStatus?: VerificationStatus | null;
  searchText?: string | null;
  storagePath?: string | null;
  createdBy?: string | null;
  createdAt?: any;
  importedAt?: string | null;
};

export function normalizeStyleNumber(value?: string | null) {
  const cleaned = safeTrim(value, 120)?.replace(/\s+/g, " ").toUpperCase();
  return cleaned || null;
}

export function normalizeBrand(value?: string | null) {
  const cleaned = safeTrim(value, 120)?.replace(/\s+/g, " ");
  return cleaned || null;
}

export function buildSearchText(record: Partial<TagRecord>) {
  const parts = [
    record.brand,
    record.productName,
    record.rn,
    record.styleNumber,
    record.garmentType,
    ...(record.tags || []),
    record.category,
    record.subCategory,
    record.gender,
    record.year,
    record.season,
    record.madeIn,
    record.materials,
    record.careText,
    record.color,
    record.notes,
    record.sourceName,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  return Array.from(new Set(parts)).join(" ");
}

export const CORE_VERIFICATION_FIELDS = [
  "brand",
  "productName",
  "rn",
  "styleNumber",
  "garmentType",
  "materials",
  "madeIn",
  "careText",
  "imageUrl",
  "sourceUrl",
] as const satisfies ReadonlyArray<keyof TagRecord>;

export type CoreVerificationField = (typeof CORE_VERIFICATION_FIELDS)[number];

export const CORE_VERIFICATION_FIELD_LABELS: Record<CoreVerificationField, string> = {
  brand: "Brand",
  productName: "Product name",
  rn: "RN",
  styleNumber: "Style number",
  garmentType: "Garment type",
  materials: "Materials",
  madeIn: "Made in",
  careText: "Care text",
  imageUrl: "Image",
  sourceUrl: "Source URL",
};

export function getVerificationPercent(record: Partial<TagRecord>) {
  let filled = 0;

  for (const field of CORE_VERIFICATION_FIELDS) {
    const value = record[field];
    if (Array.isArray(value)) {
      if (value.length > 0) filled += 1;
    } else if (typeof value === "string") {
      if (value.trim().length > 0) filled += 1;
    } else if (value != null) {
      filled += 1;
    }
  }

  return Math.round((filled / CORE_VERIFICATION_FIELDS.length) * 100);
}

export function prepareRecord(record: Partial<TagRecord>): Partial<TagRecord> {
  const brand = normalizeBrand(record.brand);
  const styleNumber = normalizeStyleNumber(record.styleNumber);
  const rn = record.rn?.replace(/\D+/g, "").slice(0, 7) || null;
  const productName = safeTrim(record.productName, 200);
  const garmentType = safeTrim(record.garmentType, 120);
  const tags = (record.tags || []).map((v) => safeTrim(v, 60)).filter(Boolean) as string[];
  const category = safeTrim(record.category, 120);
  const subCategory = safeTrim(record.subCategory, 120);
  const gender = safeTrim(record.gender, 60);
  const year = safeTrim(record.year, 40);
  const season = safeTrim(record.season, 80);
  const madeIn = safeTrim(record.madeIn, 120);
  const materials = safeTrim(record.materials, 1000);
  const careText = safeTrim(record.careText, 4000);
  const color = safeTrim(record.color, 120);
  const notes = safeTrim(record.notes, 4000);
  const sourceUrl = safeTrim(record.sourceUrl, 2048);
  const sourceName = safeTrim(record.sourceName, 255);

  const prepared: Partial<TagRecord> = {
    ...record,
    brand,
    rn,
    styleNumber,
    productName,
    garmentType,
    tags,
    category,
    subCategory,
    gender,
    year,
    season,
    madeIn,
    materials,
    careText,
    color,
    notes,
    sourceUrl,
    sourceName,
    thumbnailUrl: safeTrim(record.thumbnailUrl, 2048),
    verificationStatus: record.verificationStatus || "pending",
    sourceType: record.sourceType || (sourceUrl ? "unknown" : "manual"),
  };

  prepared.searchText = buildSearchText(prepared);
  prepared.confidence = clampConfidence(record.confidence ?? (getVerificationPercent(prepared) / 100));
  return prepared;
}
