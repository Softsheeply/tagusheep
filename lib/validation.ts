import type { SourceType, VerificationStatus } from "@/lib/records";

const SOURCE_TYPES: SourceType[] = ["manual", "official", "marketplace", "archive", "resale", "unknown"];
const VERIFICATION_STATUSES: VerificationStatus[] = ["draft", "needs_info", "pending", "reviewed", "verified", "rejected"];

export function safeTrim(value?: string | null, maxLength = 5000) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function safeHostnameFromUrl(value?: string | null) {
  const trimmed = safeTrim(value, 2048);
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname || null;
  } catch {
    return null;
  }
}

export function isValidSourceType(value: string): value is SourceType {
  return SOURCE_TYPES.includes(value as SourceType);
}

export function isValidVerificationStatus(value: string): value is VerificationStatus {
  return VERIFICATION_STATUSES.includes(value as VerificationStatus);
}

export function clampConfidence(value?: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(1, value));
}
