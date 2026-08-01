import { prepareRecord, suggestCategory, type SourceType, type TagRecord } from "@/lib/records";
import {
  decodeHtml,
  firstMatch,
  extractStyleNumber,
  extractRn,
  extractMadeIn,
  extractYear,
  extractCategory,
  extractMaterials,
} from "@/lib/tag-text-extract.mjs";

// Re-exported so existing callers can keep importing them from here. The
// implementations live in tag-text-extract.mjs so the standalone import
// scripts (plain .mjs, no path-alias resolution) can share them.
export {
  extractStyleNumber,
  extractRn,
  extractMadeIn,
  extractYear,
  extractCategory,
  extractMaterials,
};

type JsonObject = Record<string, unknown>;

type JsonLdNode = JsonObject & {
  "@type"?: string | string[];
  "@graph"?: unknown;
  image?: string | string[];
  images?: unknown;
  brand?: string | { name?: string };
  name?: string;
  description?: string;
  sku?: string;
};

type EmbeddedImage = {
  url?: string;
  imageUrl?: string;
  zoomUrl?: string;
  src?: string;
  link?: string;
};

function stripTags(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function flattenGraph(node: unknown): JsonLdNode[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(flattenGraph);
  if (!isJsonObject(node)) return [];
  if (Array.isArray(node["@graph"])) return flattenGraph(node["@graph"]);
  return [node as JsonLdNode];
}

function inferSourceType(hostname: string): SourceType {
  if (/gap|oldnavy|bananarepublic|athleta|aritzia|louisvuitton|gucci|prada|dior|chanel|versace|balenciaga|fendi/i.test(hostname)) return "official";
  if (/grailed|ebay|depop|poshmark|vestiaire|therealreal/i.test(hostname)) return "marketplace";
  if (/archive|museum|vintage/i.test(hostname)) return "archive";
  return "unknown";
}

function scoreImageCandidate(url: string) {
  const lower = url.toLowerCase();
  let score = 0;

  if (/webcontent\/.+\.(jpg|jpeg|png|webp)/i.test(lower)) score += 120;
  if (/product|pdp|catalog|media|images|photo|zoom|large|hero|main/i.test(lower)) score += 40;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(lower)) score += 30;
  if (/logo|icon|sprite|placeholder|favicon|badge|asset_archive/i.test(lower)) score -= 140;
  if (/\.svg(\?|$)/i.test(lower)) score -= 200;
  if (/\/logo\//i.test(lower)) score -= 180;

  return score;
}

function pickImages(jsonLdNodes: JsonLdNode[], html: string, fallbackImages: string[] = []) {
  const out = new Set<string>();

  for (const node of jsonLdNodes) {
    const image = node.image;
    if (typeof image === "string") out.add(image);
    if (Array.isArray(image)) image.filter((v): v is string => typeof v === "string").forEach((v) => out.add(v));
    if (Array.isArray(node.images)) node.images.filter((v): v is string => typeof v === "string").forEach((v) => out.add(v));
  }

  fallbackImages.forEach((img) => out.add(img));

  const og = firstMatch(html, [/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i]);
  if (og) out.add(og);

  const twitter = firstMatch(html, [/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i]);
  if (twitter) out.add(twitter);

  const imgMatches = [...html.matchAll(/<img[^>]+(?:src|data-src|data-zoom-image|data-image)=["']([^"']+)["'][^>]*>/gi)];
  for (const match of imgMatches) {
    const candidate = normalizeImage(match[1]);
    if (candidate) out.add(candidate);
  }

  return Array.from(out)
    .map((candidate) => normalizeImage(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a))
    .slice(0, 8);
}

function normalizeImage(url?: string | null) {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

function findEmbeddedState(html: string) {
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__DATA__\s*=\s*({[\s\S]*?});/i,
    /window\.__PDP_DATA__\s*=\s*({[\s\S]*?});/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const parsed = safeJsonParse<JsonObject>(match[1]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function deepFindFirst(obj: unknown, predicate: (value: unknown, key?: string) => boolean, seen = new Set<object>()): unknown {
  if (!isJsonObject(obj) || seen.has(obj)) return null;
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFindFirst(item, predicate, seen);
      if (found != null) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (predicate(value, key)) return value;
    const found = deepFindFirst(value, predicate, seen);
    if (found != null) return found;
  }
  return null;
}

function extractFromEmbeddedState(state: JsonObject | null) {
  if (!state) return {} as Partial<TagRecord>;

  const brand = deepFindFirst(state, (value, key) => /brand/i.test(String(key)) && typeof value === "string");
  const productName = deepFindFirst(state, (value, key) => /(productName|name|displayName|title)/i.test(String(key)) && typeof value === "string" && value.length > 3);
  const styleNumber = deepFindFirst(state, (value, key) => /(styleNumber|styleId|style|sku|productId|pid)/i.test(String(key)) && (typeof value === "string" || typeof value === "number"));
  const category = deepFindFirst(state, (value, key) => /(category|categoryName|subCategory)/i.test(String(key)) && typeof value === "string");
  const materials = deepFindFirst(state, (value, key) => /(fabric|material|materials|composition)/i.test(String(key)) && typeof value === "string");
  const careText = deepFindFirst(state, (value, key) => /(care|careInstructions|wash|washing)/i.test(String(key)) && typeof value === "string");
  const year = deepFindFirst(state, (value, key) => /(year|seasonYear)/i.test(String(key)) && (typeof value === "string" || typeof value === "number"));
  const images = deepFindFirst(state, (value, key) => /(images|media|alternateImages|productImages)/i.test(String(key)) && Array.isArray(value));

  const imageUrls = Array.isArray(images)
    ? images
        .map((item) => {
          if (typeof item === "string") return normalizeImage(item);
          if (!isJsonObject(item)) return null;
          const embeddedImage = item as EmbeddedImage;
          if (embeddedImage.url) return normalizeImage(embeddedImage.url);
          if (embeddedImage.imageUrl) return normalizeImage(embeddedImage.imageUrl);
          if (embeddedImage.zoomUrl) return normalizeImage(embeddedImage.zoomUrl);
          if (embeddedImage.src) return normalizeImage(embeddedImage.src);
          if (embeddedImage.link) return normalizeImage(embeddedImage.link);
          return null;
        })
        .filter((value): value is string => Boolean(value))
    : [];

  return {
    brand: typeof brand === "string" ? brand : null,
    productName: typeof productName === "string" ? productName : null,
    styleNumber: styleNumber != null ? String(styleNumber) : null,
    category: typeof category === "string" ? category : null,
    materials: typeof materials === "string" ? materials : null,
    careText: typeof careText === "string" ? careText : null,
    year: year != null ? String(year) : null,
    extraImageUrls: imageUrls,
  } satisfies Partial<TagRecord>;
}

export async function scrapeProductUrl(url: string): Promise<Partial<TagRecord>> {
  const response = await fetch(`/api/import?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`Import failed: ${response.status}`);
  return response.json();
}

export function extractRecordFromHtml(url: string, html: string): Partial<TagRecord> {
  const hostname = new URL(url).hostname;
  const jsonLdBlocks = findJsonLd(html).map((block) => safeJsonParse<JsonLdNode>(block)).filter((block): block is JsonLdNode => Boolean(block));
  const jsonLdNodes = jsonLdBlocks.flatMap(flattenGraph);
  const productNode = jsonLdNodes.find((node) => {
    const type = node["@type"];
    return type === "Product" || (Array.isArray(type) && type.includes("Product"));
  });

  const embeddedState = findEmbeddedState(html);
  const embedded = extractFromEmbeddedState(embeddedState);

  const title =
    embedded.productName ||
    productNode?.name ||
    firstMatch(html, [/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i, /<title>([^<]+)<\/title>/i]);

  const brand =
    embedded.brand ||
    (typeof productNode?.brand === "object" ? productNode.brand.name : productNode?.brand) ||
    firstMatch(html, [/<meta[^>]+property=["']product:brand["'][^>]+content=["']([^"']+)["']/i]);

  const description =
    productNode?.description ||
    firstMatch(html, [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i]);

  const bodyText = decodeHtml(stripTags(html));
  const styleNumber =
    embedded.styleNumber ||
    productNode?.sku ||
    extractStyleNumber(`${description || ""} ${bodyText} ${url}`);
  const rn = extractRn(`${description || ""} ${bodyText}`);
  const madeIn = embedded.madeIn || extractMadeIn(`${description || ""} ${bodyText}`);
  const year = embedded.year || extractYear(`${title || ""} ${description || ""} ${bodyText}`);
  // extractCategory actually returns a garment-type word (e.g. "hoodie",
  // "jeans"), not a real top-level category -- it's a reasonable guess at
  // garmentType, and its match plus the title/description feed suggestCategory
  // to guess the real bucket (e.g. a scraped "belt" suggests "Accessories").
  const garmentTypeGuess = extractCategory(`${title || ""} ${description || ""} ${bodyText}`);
  const category = embedded.category || suggestCategory(garmentTypeGuess, title, description);
  const materials = embedded.materials || extractMaterials(`${description || ""} ${bodyText}`);
  const careText = embedded.careText || null;
  const images = pickImages(jsonLdNodes, html, embedded.extraImageUrls || []);

  return prepareRecord({
    brand: brand || null,
    productName: title || null,
    styleNumber: styleNumber || null,
    rn: rn || null,
    garmentType: garmentTypeGuess || null,
    category: category || null,
    madeIn: madeIn || null,
    year: year || null,
    materials: materials || null,
    careText: careText || null,
    notes: description || null,
    imageUrl: images[0] || "",
    extraImageUrls: images.slice(1),
    sourceUrl: url,
    sourceName: hostname,
    sourceType: inferSourceType(hostname),
    confidence: productNode || embedded.productName ? 0.9 : 0.55,
    // Scraped straight from the retailer's own product page -- treat it as
    // "looks solid, from an official-looking source" rather than needing
    // manual triage. Still short of "verified": that's an admin judgement
    // call reserved for an actual human fact-check (see firestore.rules).
    verificationStatus: "reviewed",
  });
}
