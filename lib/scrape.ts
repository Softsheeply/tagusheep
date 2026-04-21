import { prepareRecord, type SourceType, type TagRecord } from "@/lib/records";

function stripTags(input: string) {
  return input.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return decodeHtml(m[1]).trim();
  }
  return null;
}

function findJsonLd(html: string) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.map((m) => m[1]).filter(Boolean);
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function flattenGraph(node: any): any[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenGraph);
  if (node["@graph"]) return flattenGraph(node["@graph"]);
  return [node];
}

function inferSourceType(hostname: string): SourceType {
  if (/louisvuitton|gucci|prada|dior|chanel|versace|balenciaga|fendi/i.test(hostname)) return "official";
  if (/grailed|ebay|depop|poshmark|vestiaire|therealreal/i.test(hostname)) return "marketplace";
  if (/archive|museum|vintage/i.test(hostname)) return "archive";
  return "unknown";
}

function pickImages(jsonLdNodes: any[], html: string) {
  const out = new Set<string>();

  for (const node of jsonLdNodes) {
    const image = node?.image;
    if (typeof image === "string") out.add(image);
    if (Array.isArray(image)) image.filter((v) => typeof v === "string").forEach((v) => out.add(v));
    if (Array.isArray(node?.images)) node.images.filter((v: any) => typeof v === "string").forEach((v: string) => out.add(v));
  }

  const og = firstMatch(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]);
  if (og) out.add(og);

  return Array.from(out).slice(0, 8);
}

function extractStyleNumber(text: string) {
  return firstMatch(text, [
    /style(?:\s+number|\s+no\.?|)\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /model(?:\s+code|\s+number|)\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /article(?:\s+code|\s+number|)\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /sku\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
  ]);
}

function extractRn(text: string) {
  return firstMatch(text, [/\bRN\s*#?\s*(\d{3,8})\b/i]);
}

function extractMadeIn(text: string) {
  return firstMatch(text, [/made\s+in\s+([a-zA-Z ]{3,40})/i]);
}

function extractYear(text: string) {
  return firstMatch(text, [/\b(19\d{2}|20\d{2})\b/]);
}

export async function scrapeProductUrl(url: string): Promise<Partial<TagRecord>> {
  const response = await fetch(`/api/import?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`Import failed: ${response.status}`);
  return response.json();
}

export function extractRecordFromHtml(url: string, html: string): Partial<TagRecord> {
  const hostname = new URL(url).hostname;
  const jsonLdBlocks = findJsonLd(html).map((block) => safeJsonParse<any>(block)).filter(Boolean);
  const jsonLdNodes = jsonLdBlocks.flatMap(flattenGraph);
  const productNode = jsonLdNodes.find((node) => {
    const type = node?.["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });

  const title =
    productNode?.name ||
    firstMatch(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, /<title>([^<]+)<\/title>/i]);

  const brand =
    productNode?.brand?.name ||
    productNode?.brand ||
    firstMatch(html, [/<meta[^>]+property=["']product:brand["'][^>]+content=["']([^"']+)["']/i]);

  const description =
    productNode?.description ||
    firstMatch(html, [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i]);

  const bodyText = decodeHtml(stripTags(html));
  const styleNumber = productNode?.sku || extractStyleNumber(`${description || ""} ${bodyText}`);
  const rn = extractRn(`${description || ""} ${bodyText}`);
  const madeIn = extractMadeIn(`${description || ""} ${bodyText}`);
  const year = extractYear(`${title || ""} ${description || ""} ${bodyText}`);
  const images = pickImages(jsonLdNodes, html);

  return prepareRecord({
    brand: brand || null,
    productName: title || null,
    styleNumber: styleNumber || null,
    rn: rn || null,
    madeIn: madeIn || null,
    year: year || null,
    notes: description || null,
    imageUrl: images[0] || "",
    extraImageUrls: images.slice(1),
    sourceUrl: url,
    sourceName: hostname,
    sourceType: inferSourceType(hostname),
    confidence: productNode ? 0.9 : 0.55,
    verificationStatus: "pending",
  });
}
