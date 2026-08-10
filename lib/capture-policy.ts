export type CaptureFields = {
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  size?: string | null;
  color?: string | null;
  category?: string | null;
  subCategory?: string | null;
  garmentType?: string | null;
  gender?: string | null;
  materials?: string | null;
  careText?: string | null;
  madeIn?: string | null;
  notes?: string | null;
  tags?: string[];
  confidence?: number | null;
  brandConfidence?: number | null;
  detectedBrands?: string[];
  detectedRns?: string[];
  detectedStyleNumbers?: string[];
  mainImageIndex?: number | null;
};

export type CaptureStopReason =
  | "no_usable_image"
  | "missing_brand"
  | "low_brand_confidence"
  | "conflicting_brands"
  | "conflicting_identifiers"
  | "missing_identifier_or_description"
  | "duplicate";

export function compactUnique(values?: Array<string | null | undefined>) {
  return Array.from(new Set((values || []).map((value) => value?.trim()).filter(Boolean) as string[]));
}

export function evaluateCapture(
  fields: CaptureFields,
  options: { usableImageCount: number; duplicateCount?: number; brandConfidenceThreshold?: number }
): CaptureStopReason[] {
  const reasons: CaptureStopReason[] = [];
  const brand = fields.brand?.trim();
  const hasDescription = Boolean(fields.productName?.trim() || fields.garmentType?.trim());
  const brands = compactUnique(fields.detectedBrands).map((value) => value.toLocaleLowerCase());
  const rns = compactUnique(fields.detectedRns);
  const styles = compactUnique(fields.detectedStyleNumbers).map((value) => value.toLocaleUpperCase());
  const threshold = options.brandConfidenceThreshold ?? 0.72;

  if (options.usableImageCount < 1) reasons.push("no_usable_image");
  if (!brand) reasons.push("missing_brand");
  if (brand && (fields.brandConfidence ?? 0) < threshold) reasons.push("low_brand_confidence");
  if (new Set(brands).size > 1) reasons.push("conflicting_brands");
  if (new Set(rns).size > 1 || new Set(styles).size > 1) reasons.push("conflicting_identifiers");
  if (!fields.rn?.trim() && !fields.styleNumber?.trim() && !hasDescription) {
    reasons.push("missing_identifier_or_description");
  }
  if ((options.duplicateCount || 0) > 0) reasons.push("duplicate");

  return reasons;
}

export function shouldInstantUpload(
  fields: CaptureFields,
  options: { usableImageCount: number; duplicateCount?: number; brandConfidenceThreshold?: number }
) {
  return evaluateCapture(fields, options).length === 0;
}

export function titleSimilarity(left?: string | null, right?: string | null) {
  const words = (value?: string | null) =>
    new Set(
      (value || "")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 1)
    );
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  const intersection = Array.from(a).filter((word) => b.has(word)).length;
  return intersection / Math.max(a.size, b.size);
}
