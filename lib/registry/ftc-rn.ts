import "server-only";

import type { RnRegistryEntry } from "@/lib/registry/types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFtcSearchHtml(html: string, rn: string): RnRegistryEntry | null {
  const rowMatch = html.match(
    new RegExp(
      `<tr>[\\s\\S]*?views-field-field-rn-no[\\s\\S]*?${rn}[\\s\\S]*?</tr>`,
      "i"
    )
  );
  if (!rowMatch) return null;

  const row = rowMatch[0];
  const rnType = stripHtml(row.match(/views-field-field-rn-type[^>]*>([\s\S]*?)<\/td/i)?.[1] || "");
  const legalName = stripHtml(
    row.match(/views-field-field-legal-business-name[^>]*>(?:<a[^>]*>)?([\s\S]*?)<\/a/i)?.[1] ||
      row.match(/views-field-field-legal-business-name[^>]*>([\s\S]*?)<\/td/i)?.[1] ||
      ""
  );
  const detailHref = row.match(/href="(\/rn\/\d+)"/i)?.[1] || null;
  const productLines = [...row.matchAll(/<h3 class="term-title">([^<]+)<\/h3>/gi)].map((m) =>
    stripHtml(m[1] || "")
  ).filter(Boolean);

  if (!legalName) return null;

  return {
    rn,
    rnType: rnType || null,
    legalName,
    productLines,
    ftcDetailUrl: detailHref ? `https://www.ftc.gov${detailHref}` : null,
    source: "ftc",
    fetchedAt: new Date().toISOString(),
    hitCount: 0,
  };
}

export async function lookupFtcRn(rn: string): Promise<RnRegistryEntry | null> {
  const response = await fetch(`https://www.ftc.gov/rn-database/search?search=${encodeURIComponent(rn)}`, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`FTC lookup failed (${response.status}).`);
  }

  const html = await response.text();
  if (/abusive automated request/i.test(html)) {
    throw new Error("FTC temporarily blocked automated lookup. Cached data still works.");
  }

  return parseFtcSearchHtml(html, rn);
}
