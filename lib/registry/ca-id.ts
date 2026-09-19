import "server-only";

import type { CaRegistryEntry } from "@/lib/registry/types";

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

function parseCaSearchHtml(html: string, ca: string): CaRegistryEntry | null {
  const linkMatch = html.match(
    new RegExp(`CA${ca}\\s+([^<]+)`, "i")
  );
  if (linkMatch?.[1]) {
    return {
      ca,
      legalName: stripHtml(linkMatch[1]),
      source: "ca_bureau",
      fetchedAt: new Date().toISOString(),
      hitCount: 0,
    };
  }
  return null;
}

function parseCaDetailHtml(html: string, ca: string): CaRegistryEntry | null {
  const legalName = stripHtml(
    html.match(/Company name:<\/div>\s*<div class="col-sm-8"\s*>\s*([^<]+)/i)?.[1] || ""
  );
  if (!legalName) return parseCaSearchHtml(html, ca);

  const addressBlock = html.match(/Address:<\/div>\s*<div class="col-sm-8">([\s\S]*?)<\/div>/i)?.[1] || "";
  const address = stripHtml(addressBlock.replace(/<br\s*\/?>/gi, ", "));
  const province = stripHtml(addressBlock.match(/>([^<]+)<\/span>\s*<br\/>\s*<span\s*>Ontario/i)?.[1] || "") || null;
  const dateIssued = stripHtml(html.match(/Date issued:<\/div>\s*<div class="col-sm-8"\s*>\s*([^<]+)/i)?.[1] || "") || null;

  return {
    ca,
    legalName,
    address: address || null,
    province,
    dateIssued,
    source: "ca_bureau",
    fetchedAt: new Date().toISOString(),
    hitCount: 0,
  };
}

export async function lookupCaId(ca: string): Promise<CaRegistryEntry | null> {
  const detailResponse = await fetch(
    `https://ised-isde.canada.ca/app/cb/can/public/cmpnyDtls.json?cano=${encodeURIComponent(ca)}`,
    {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json" },
      cache: "no-store",
    }
  );

  if (detailResponse.ok) {
    const detailHtml = await detailResponse.text();
    const parsed = parseCaDetailHtml(detailHtml, ca);
    if (parsed) return parsed;
  }

  const searchResponse = await fetch("https://ised-isde.canada.ca/app/cb/can/public/srchCmpny", {
    method: "POST",
    headers: {
      "user-agent": USER_AGENT,
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
    },
    body: new URLSearchParams({ cano: ca, page: "" }).toString(),
    cache: "no-store",
  });

  if (!searchResponse.ok) {
    throw new Error(`CA lookup failed (${searchResponse.status}).`);
  }

  return parseCaSearchHtml(await searchResponse.text(), ca);
}
