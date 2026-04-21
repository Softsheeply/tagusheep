export type VerificationStatus = "draft" | "pending" | "reviewed" | "verified" | "rejected";
export type SourceType = "manual" | "official" | "marketplace" | "archive" | "resale" | "unknown";

export type TagRecord = {
  id?: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
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
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ").toUpperCase();
  return cleaned || null;
}

export function normalizeBrand(value?: string | null) {
  if (!value) return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned || null;
}

export function buildSearchText(record: Partial<TagRecord>) {
  const parts = [
    record.brand,
    record.productName,
    record.rn,
    record.styleNumber,
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

export function prepareRecord(record: Partial<TagRecord>): Partial<TagRecord> {
  const brand = normalizeBrand(record.brand);
  const styleNumber = normalizeStyleNumber(record.styleNumber);
  const rn = record.rn?.replace(/\D+/g, "") || null;
  const productName = record.productName?.trim() || null;
  const category = record.category?.trim() || null;
  const subCategory = record.subCategory?.trim() || null;
  const gender = record.gender?.trim() || null;
  const year = record.year?.trim() || null;
  const season = record.season?.trim() || null;
  const madeIn = record.madeIn?.trim() || null;
  const materials = record.materials?.trim() || null;
  const careText = record.careText?.trim() || null;
  const color = record.color?.trim() || null;
  const notes = record.notes?.trim() || null;
  const sourceUrl = record.sourceUrl?.trim() || null;
  const sourceName = record.sourceName?.trim() || null;

  const prepared: Partial<TagRecord> = {
    ...record,
    brand,
    rn,
    styleNumber,
    productName,
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
    verificationStatus: record.verificationStatus || "pending",
    sourceType: record.sourceType || (sourceUrl ? "unknown" : "manual"),
  };

  prepared.searchText = buildSearchText(prepared);
  return prepared;
}
