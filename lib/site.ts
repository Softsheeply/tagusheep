const FALLBACK_SITE_URL = "http://localhost:3000";

function asValidUrl(candidate: string | undefined): string | null {
  const trimmed = candidate?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withScheme);
    return withScheme;
  } catch {
    // A misconfigured env var shouldn't be able to crash every page via
    // metadataBase -- fall through to the next candidate instead.
    return null;
  }
}

export function getSiteUrl() {
  return (
    asValidUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    asValidUrl(process.env.VERCEL_URL) ||
    FALLBACK_SITE_URL
  );
}
