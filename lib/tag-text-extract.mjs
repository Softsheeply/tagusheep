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
 * True when a captured token is a US RN or Canadian CA dealer number, not a
 * style / SN value. Tags often print both "STYLE …" and "CA #####" nearby;
 * naive style regexes otherwise swallow the CA number.
 *
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export function isMakerRegistrationNumber(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return false;
  if (/^(?:RN|CA)\s*[#:\-]?\s*\d{3,8}$/i.test(cleaned)) return true;
  if (/^(?:RN|CA)\d{3,8}$/i.test(cleaned)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string}
 */
function withoutMakerRegistrationNumbers(text) {
  // Remove labeled maker IDs so later style/SN matching cannot adopt them.
  return String(text || "").replace(/\b(?:RN|CA)\s*[#:\-]?\s*\d{3,8}\b/gi, " ");
}

/**
 * @param {string | null} value
 * @returns {string | null}
 */
function cleanStyleCandidate(value) {
  if (!value) return null;
  const cleaned = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (!cleaned || isMakerRegistrationNumber(cleaned)) return null;
  return cleaned;
}

/**
 * @param {string} text
 * @param {RegExp[]} patterns
 * @returns {string | null}
 */
function firstStyleMatch(text, patterns) {
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const global = new RegExp(pattern.source, flags);
    let match;
    while ((match = global.exec(text))) {
      const cleaned = cleanStyleCandidate(match[1]);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractStyleNumber(text) {
  // SN / S/N = style number. CA / RN = maker registration — never style.
  const searchable = withoutMakerRegistrationNumbers(text);
  return firstStyleMatch(searchable, [
    /\b(?:S\s*\/\s*N|S\.?\s*N\.?)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/ ]{2,})/i,
    /\bstyle(?:\s+(?:number|no\.?|#))?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/ ]{2,})/i,
    /\bmodel(?:\s+(?:code|number|no\.?))?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/ ]{2,})/i,
    /\barticle(?:\s+(?:code|number|no\.?))?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/ ]{2,})/i,
    /\bsku\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/ ]{2,})/i,
    /\bproduct(?:\s+(?:id|number|no\.?))?\s*[:#\-]?\s*(\d{5,})/i,
  ]);
}

/**
 * US RN or Canadian CA dealer / business number printed on the label.
 * Prefer an explicit RN when both appear; otherwise accept CA. Digits only
 * are returned so callers can store them in the existing `rn` field.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function extractRn(text) {
  return firstMatch(text, [
    /\bRN\s*[#:\-]?\s*(\d{3,8})\b/i,
    /\bCA\s*[#:\-]?\s*(\d{3,8})\b/i,
  ]);
}

/**
 * Every labeled RN/CA maker number on the tag (RN first, then CA).
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractMakerRegistrationNumbers(text) {
  const values = [];
  const seen = new Set();
  for (const pattern of [/\bRN\s*[#:\-]?\s*(\d{3,8})\b/gi, /\bCA\s*[#:\-]?\s*(\d{3,8})\b/gi]) {
    let match;
    while ((match = pattern.exec(String(text || "")))) {
      const digits = match[1];
      if (!digits || seen.has(digits)) continue;
      seen.add(digits);
      values.push(digits);
    }
  }
  return values;
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
