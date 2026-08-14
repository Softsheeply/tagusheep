import type { CaptureFields } from "@/lib/capture-policy";
import { extractRn, extractStyleNumber } from "./tag-text-extract.mjs";

export type FreeOcrInput = {
  role: string;
  rawText: string;
  rn?: string | null;
  styleNumber?: string | null;
  madeIn?: string | null;
  materials?: string | null;
};

export type PhotoRole = "full garment" | "brand label" | "RN/style tag" | "materials/care tag" | "detail";

const NON_BRAND_LINE = /\b(rn|style|size|sz|made|care|wash|dry|iron|bleach|fabric|shell|lining|cotton|polyester|nylon|wool|viscose|elastane|spandex|exclusive|distributed|imported|www\.|\.com|machine|hand|tumble|cycle)\b/i;
const CARE_HINT = /\b(wash|care|bleach|iron|dry\s*clean|tumble|machine|hand\s*wash|do\s+not|%|cotton|polyester|nylon|elastane|spandex|acrylic|rayon|viscose)\b/i;
const SIZE_CODE = /\b((?:XX[SL]|X[SL]|[SML]|[0-9]{1,2})(?:\s*\/\s*[A-Z0-9]{1,3}){1,3})\b/i;

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function brandCandidate(text: string) {
  for (const rawLine of text.split(/\r?\n/)) {
    // Keep "/" so size codes like S/P/C stay recognizable.
    const line = rawLine.replace(/[^\p{L}\p{N}&'.\/ -]+/gu, " ").replace(/\s+/g, " ").trim();
    if (line.length < 2 || line.length > 40 || NON_BRAND_LINE.test(line)) continue;
    if (SIZE_CODE.test(line) || SIZE_CODE.test(line.replace(/\s+/g, ""))) continue;
    // Pure digit lines are not brands; digit+letter brands like "FOREVER 21" are OK.
    if (/^\d+$/.test(line)) continue;
    if (/\d/.test(line) && !/[a-z]/i.test(line)) continue;
    if (/^[A-Z](?:\s*\/\s*[A-Z0-9]){1,3}$/i.test(line)) continue;
    return line;
  }
  return null;
}

function extractSize(text: string) {
  return (
    text.match(/\b(?:size|sz)\s*[:#-]?\s*([a-z0-9./-]{1,12})\b/i)?.[1]?.toUpperCase() ||
    text.match(SIZE_CODE)?.[1]?.replace(/\s+/g, "")?.toUpperCase() ||
    null
  );
}

function styleFromText(text: string, provided?: string | null) {
  return provided || extractStyleNumber(text) || text.match(/\b(\d{4}[- ]\d{3,5}[- ]\d{3,5}[- ]\d{4,})\b/)?.[1]?.replace(/\s+/g, "-") || null;
}

function rnFromText(text: string, provided?: string | null) {
  return provided || extractRn(text);
}

function scoreRole(input: FreeOcrInput, role: PhotoRole) {
  const text = input.rawText || "";
  const hasRn = Boolean(rnFromText(text, input.rn));
  const hasStyle = Boolean(styleFromText(text, input.styleNumber));
  const hasBrand = Boolean(brandCandidate(text));
  const hasCare = CARE_HINT.test(text);
  const textLen = text.replace(/\s+/g, " ").trim().length;

  switch (role) {
    case "RN/style tag":
      return (hasRn ? 4 : 0) + (hasStyle ? 3 : 0) + (hasBrand ? 1 : 0) + (textLen > 8 ? 1 : 0);
    case "materials/care tag":
      return (hasCare ? 4 : 0) + (/%/.test(text) ? 2 : 0) + (hasRn || hasStyle ? -2 : 0);
    case "brand label":
      return (hasBrand && textLen < 80 ? 4 : 0) + (hasBrand ? 2 : 0) + (hasRn || hasStyle || hasCare || SIZE_CODE.test(text) ? -2 : 0);
    case "full garment":
      return (textLen < 12 ? 3 : 0) + (textLen === 0 ? 3 : 0) + (!hasRn && !hasStyle && !hasCare ? 2 : 0) + (hasRn || hasStyle ? -3 : 0) + (SIZE_CODE.test(text) ? -2 : 0);
    case "detail":
      return (SIZE_CODE.test(text) && !hasRn && !hasStyle ? 3 : 0) + (textLen < 20 ? 1 : 0);
    default:
      return 0;
  }
}

/**
 * When default photo order doesn't match what's in the frames (common on phone
 * capture), reassign roles from OCR hints so free extraction and website-image
 * filtering use the right photos.
 */
export function suggestPhotoRoles(inputs: FreeOcrInput[]): PhotoRole[] {
  const roles: PhotoRole[] = ["full garment", "brand label", "RN/style tag", "materials/care tag", "detail"];
  const assigned = new Array<PhotoRole | null>(inputs.length).fill(null);
  const remaining = new Set(roles);
  const textLen = (input: FreeOcrInput) => (input.rawText || "").replace(/\s+/g, " ").trim().length;

  // Strong identifier / care signals first.
  const priorityRoles: PhotoRole[] = ["RN/style tag", "materials/care tag", "brand label"];
  for (const role of priorityRoles) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < inputs.length; index++) {
      if (assigned[index]) continue;
      const score = scoreRole(inputs[index], role);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0 && bestScore > 0) {
      assigned[bestIndex] = role;
      remaining.delete(role);
    }
  }

  // Full garment: prefer the unused photo with the least printed text.
  if (remaining.has("full garment")) {
    let bestIndex = -1;
    let bestRank = Number.POSITIVE_INFINITY;
    for (let index = 0; index < inputs.length; index++) {
      if (assigned[index]) continue;
      const score = scoreRole(inputs[index], "full garment");
      if (score <= 0 && textLen(inputs[index]) > 40) continue;
      // Lower text length wins; tiny positive score breaks ties toward emptier frames.
      const rank = textLen(inputs[index]) - score * 0.01;
      if (rank < bestRank) {
        bestRank = rank;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) {
      assigned[bestIndex] = "full garment";
      remaining.delete("full garment");
    }
  }

  const leftovers = [...remaining];
  for (let index = 0; index < assigned.length; index++) {
    if (assigned[index]) continue;
    assigned[index] = leftovers.shift() || "detail";
  }

  return assigned as PhotoRole[];
}

function resolveBrands(inputs: FreeOcrInput[]) {
  const from = (roles: string[]) =>
    unique(inputs.filter((input) => roles.includes(input.role)).map((input) => brandCandidate(input.rawText)));
  const labelled = from(["brand label"]);
  const fromTags = from(["RN/style tag", "materials/care tag"]);
  const fromAll = unique(inputs.map((input) => brandCandidate(input.rawText)));

  // Prefer a single brand-label hit, but do not ignore brands on other photos when
  // the "brand label" slot was empty or pointed at the wrong image.
  if (labelled.length === 1) return { brands: labelled, confidence: 0.82 };
  if (labelled.length > 1) return { brands: labelled, confidence: 0.45 };
  if (fromTags.length === 1) return { brands: fromTags, confidence: 0.76 };
  if (fromAll.length === 1) return { brands: fromAll, confidence: 0.72 };
  if (fromAll.length > 1) return { brands: fromAll, confidence: 0.4 };
  return { brands: [] as string[], confidence: 0 };
}

export function extractFreeCapture(inputs: FreeOcrInput[]): CaptureFields {
  const suggestedRoles = suggestPhotoRoles(inputs);
  const normalized = inputs.map((input, index) => ({
    ...input,
    role: suggestedRoles[index] || input.role,
    rn: rnFromText(input.rawText, input.rn),
    styleNumber: styleFromText(input.rawText, input.styleNumber),
  }));

  const { brands: detectedBrands, confidence: brandConfidence } = resolveBrands(normalized);
  const detectedRns = unique(normalized.map((input) => input.rn));
  const detectedStyleNumbers = unique(normalized.map((input) => input.styleNumber));
  const madeInValues = unique(normalized.map((input) => input.madeIn));
  const materialsValues = unique(normalized.map((input) => input.materials));
  const allText = normalized.map((input) => input.rawText).join("\n");
  const careText =
    normalized
      .filter((input) => input.role === "materials/care tag")
      .map((input) => input.rawText.trim())
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000) || null;
  const mainImageIndex = normalized.findIndex((input) => input.role === "full garment");
  const brand = detectedBrands[0] || null;
  const rn = detectedRns.length === 1 ? detectedRns[0] : detectedRns[0] || null;
  const styleNumber = detectedStyleNumbers.length === 1 ? detectedStyleNumbers[0] : detectedStyleNumbers[0] || null;

  return {
    brand,
    productName: null,
    rn,
    styleNumber,
    size: extractSize(allText),
    color: null,
    category: null,
    subCategory: null,
    garmentType: null,
    gender: null,
    materials: materialsValues.join("; ") || null,
    careText,
    madeIn: madeInValues.length === 1 ? madeInValues[0] : madeInValues[0] || null,
    notes: null,
    tags: [],
    confidence: brand && (rn || styleNumber) ? 0.78 : brand ? 0.55 : 0.35,
    brandConfidence,
    detectedBrands,
    detectedRns,
    detectedStyleNumbers,
    mainImageIndex: mainImageIndex >= 0 ? mainImageIndex : 0,
  };
}
