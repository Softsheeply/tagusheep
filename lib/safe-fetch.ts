const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./, // link-local, incl. cloud metadata endpoints (169.254.169.254)
  /^0\./,
  /^::1$/i,
  /^fc/i,
  /^fd/i,
  /^fe80:/i,
];

export function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
}

export class BlockedUrlError extends Error {
  constructor(message = "Blocked hostname") {
    super(message);
    this.name = "BlockedUrlError";
  }
}

function assertPublicHttpUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new BlockedUrlError("Unsupported protocol");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new BlockedUrlError("Blocked hostname");
  }
}

/**
 * fetch() with redirect: "follow" never re-validates the hostname of a
 * redirect target, so a URL that passes an initial public-hostname check
 * could still redirect to an internal address (SSRF). This walks redirects
 * manually, re-checking every hop against the same blocklist.
 */
export async function safeFetch(url: string, init: RequestInit & { signal?: AbortSignal }, maxRedirects = 5): Promise<Response> {
  let current = new URL(url);
  assertPublicHttpUrl(current);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(current.toString(), { ...init, redirect: "manual" });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      const next = new URL(location, current);
      assertPublicHttpUrl(next);
      current = next;
      continue;
    }

    return response;
  }

  throw new BlockedUrlError("Too many redirects");
}
