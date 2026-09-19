import {
  extractCa,
  extractRn,
  extractStyleNumber,
  extractWpl,
} from "@/lib/tag-text-extract.mjs";

export type ExtractedIdentifiers = {
  rn: string | null;
  ca: string | null;
  wpl: string | null;
  styleNumber: string | null;
  brandFromTag: string | null;
};

function normalizeDigits(value: string | null | undefined, maxLen: number) {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  return digits ? digits.slice(0, maxLen) : null;
}

function brandFromOcr(text: string) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[^\p{L}\p{N}&'. -]+/gu, " ").replace(/\s+/g, " ").trim();
    if (line.length < 2 || line.length > 40) continue;
    if (/\b(rn|ca|wpl|style|size|made|care|wash|dry|iron|bleach|fabric|cotton|polyester|www\.)\b/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    return line;
  }
  return null;
}

export function extractIdentifiersFromText(text: string): ExtractedIdentifiers {
  const wpl = normalizeDigits(extractWpl(text), 7);
  const rn = normalizeDigits(extractRn(text), 7) || wpl;
  return {
    rn,
    ca: normalizeDigits(extractCa(text), 5),
    wpl,
    styleNumber: extractStyleNumber(text)?.replace(/\s+/g, " ").trim().slice(0, 120) || null,
    brandFromTag: brandFromOcr(text),
  };
}

export function mergeExtracted(parts: Array<Partial<ExtractedIdentifiers>>): ExtractedIdentifiers {
  const rn = parts.map((p) => p.rn).find(Boolean) || null;
  const ca = parts.map((p) => p.ca).find(Boolean) || null;
  const wpl = parts.map((p) => p.wpl).find(Boolean) || null;
  const styleNumber = parts.map((p) => p.styleNumber).find(Boolean) || null;
  const brandFromTag = parts.map((p) => p.brandFromTag).find(Boolean) || null;
  return { rn, ca, wpl, styleNumber, brandFromTag };
}
