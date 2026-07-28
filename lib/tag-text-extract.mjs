// Pure text-extraction helpers for pulling structured fields out of free
// text -- scraped product HTML in the app, and OCR'd tag photos in the
// standalone import scripts.
//
// Deliberately plain JS with no imports: lib/scrape.ts uses path aliases
// (`@/lib/records`) that only resolve inside the Next build, so a .mjs
// script can't import that file directly. Keeping these regexes here
// instead of duplicating them in scripts/ means an improvement to the RN
// or style-number pattern benefits both callers at once.

/**
 * @param {string} input
 * @returns {string}
 */
export function decodeHtml(input) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/**
 * @param {string} text
 * @param {RegExp[]} patterns
 * @returns {string | null}
 */
export function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return decodeHtml(m[1]).trim();
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractStyleNumber(text) {
  return firstMatch(text, [
    /style(?:\s+number|\s+no\.?|)\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /model(?:\s+code|\s+number|)\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /article(?:\s+code|\s+number|)\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /sku\s*[:#-]?\s*([A-Z0-9\-\/ ]{4,})/i,
    /product(?:\s+id|\s+number|)\s*[:#-]?\s*(\d{5,})/i,
    /style\s*#\s*([A-Z0-9\-\/ ]{4,})/i,
  ]);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractRn(text) {
  return firstMatch(text, [/\bRN\s*#?\s*(\d{3,8})\b/i]);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractMadeIn(text) {
  return firstMatch(text, [/made\s+in\s+([a-zA-Z ]{3,40})/i]);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractYear(text) {
  return firstMatch(text, [/\b(19\d{2}|20\d{2})\b/]);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractCategory(text) {
  return firstMatch(text, [
    /\b(t-?shirt|tee|hoodie|sweatshirt|dress|jeans|pants|shorts|jacket|coat|sweater|tank|legging|activewear|shirt|top)\b/i,
  ]);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractMaterials(text) {
  return firstMatch(text, [
    /((?:\d{1,3}%\s+[a-zA-Z]+(?:,\s*)?){1,6})/i,
    /(cotton[\s\S]{0,80}?polyester|polyester[\s\S]{0,80}?cotton|linen[\s\S]{0,80}?cotton|wool[\s\S]{0,80}?nylon)/i,
  ]);
}
