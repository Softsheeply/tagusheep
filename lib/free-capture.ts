import type { CaptureFields } from "@/lib/capture-policy";

export type FreeOcrInput = {
  role: string;
  rawText: string;
  rn?: string | null;
  styleNumber?: string | null;
  madeIn?: string | null;
  materials?: string | null;
};

const NON_BRAND_LINE = /\b(rn|style|size|made|care|wash|dry|iron|bleach|fabric|shell|lining|cotton|polyester|nylon|wool|viscose|elastane|spandex|exclusive|distributed|imported|www\.|\.com)\b/i;

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function brandCandidate(text: string) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[^\p{L}\p{N}&'. -]+/gu, " ").replace(/\s+/g, " ").trim();
    if (line.length < 2 || line.length > 40 || NON_BRAND_LINE.test(line)) continue;
    if (/^\d+$/.test(line) || (/\d/.test(line) && !/[a-z]/i.test(line))) continue;
    return line;
  }
  return null;
}

function extractSize(text: string) {
  return text.match(/\b(?:size|sz)\s*[:#-]?\s*([a-z0-9./-]{1,10})\b/i)?.[1]?.toUpperCase() || null;
}

export function extractFreeCapture(inputs: FreeOcrInput[]): CaptureFields {
  const labelledBrandInputs = inputs.filter((input) => input.role === "brand label");
  const brandSources = labelledBrandInputs.length ? labelledBrandInputs : inputs;
  const detectedBrands = unique(brandSources.map((input) => brandCandidate(input.rawText)));
  const detectedRns = unique(inputs.map((input) => input.rn));
  const detectedStyleNumbers = unique(inputs.map((input) => input.styleNumber));
  const madeInValues = unique(inputs.map((input) => input.madeIn));
  const materialsValues = unique(inputs.map((input) => input.materials));
  const allText = inputs.map((input) => input.rawText).join("\n");
  const careText = inputs
    .filter((input) => input.role === "materials/care tag")
    .map((input) => input.rawText.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000) || null;
  const mainImageIndex = inputs.findIndex((input) => input.role === "full garment");
  const brand = detectedBrands.length === 1 ? detectedBrands[0] : detectedBrands[0] || null;
  const brandConfidence = labelledBrandInputs.length > 0 && detectedBrands.length === 1 ? 0.82 : brand ? 0.62 : 0;
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
    confidence: brand && (rn || styleNumber) ? 0.78 : 0.5,
    brandConfidence,
    detectedBrands,
    detectedRns,
    detectedStyleNumbers,
    mainImageIndex: mainImageIndex >= 0 ? mainImageIndex : 0,
  };
}
