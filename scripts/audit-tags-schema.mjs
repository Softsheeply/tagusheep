// One-off audit: checks every document in the live `tags` collection
// against the same validTagData() schema enforced in firestore.rules for
// creates, to see whether it would also be safe to enforce on updates.
//
// Usage:
//   vercel env pull .env.local   (once, to get real Firebase config locally)
//   node --env-file=.env.local scripts/audit-tags-schema.mjs
//
// Uses the regular client SDK, not firebase-admin -- `tags` reads are
// public (allow read: if true), so no service account is needed.

import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error("Missing NEXT_PUBLIC_FB_* env vars. Run: vercel env pull .env.local");
  process.exit(1);
}

const VALID_KEYS = new Set([
  "brand", "productName", "rn", "styleNumber", "garmentType", "size", "availableSizes", "tags",
  "category", "subCategory", "gender", "year", "season", "madeIn", "materials", "careText", "color",
  "notes", "imageUrl", "thumbnailUrl", "extraImageUrls", "sourceUrl", "sourceName", "sourceType",
  "confidence", "verificationStatus", "searchText", "storagePath", "createdBy", "createdAt", "importedAt",
]);

const ALLOWED_SOURCE_TYPES = ["manual", "official", "marketplace", "archive", "resale", "unknown"];
const ALLOWED_VERIFICATION = ["draft", "needs_info", "pending", "reviewed", "verified", "rejected"];

function stringOrNull(value, maxLen, field, errors) {
  if (value == null) return;
  if (typeof value !== "string") { errors.push(`${field}: not a string`); return; }
  if (value.length > maxLen) errors.push(`${field}: length ${value.length} > ${maxLen}`);
}

function listOrNull(value, maxItems, field, errors) {
  if (value == null) return;
  if (!Array.isArray(value)) { errors.push(`${field}: not a list`); return; }
  if (value.length > maxItems) errors.push(`${field}: ${value.length} items > ${maxItems}`);
}

function validate(data) {
  const errors = [];

  const extraKeys = Object.keys(data).filter((k) => !VALID_KEYS.has(k));
  if (extraKeys.length > 0) errors.push(`unknown fields: ${extraKeys.join(", ")}`);

  stringOrNull(data.brand, 120, "brand", errors);
  stringOrNull(data.productName, 200, "productName", errors);
  stringOrNull(data.rn, 7, "rn", errors);
  stringOrNull(data.styleNumber, 120, "styleNumber", errors);
  stringOrNull(data.garmentType, 120, "garmentType", errors);
  stringOrNull(data.size, 60, "size", errors);
  listOrNull(data.availableSizes, 20, "availableSizes", errors);
  listOrNull(data.tags, 25, "tags", errors);
  stringOrNull(data.category, 120, "category", errors);
  stringOrNull(data.subCategory, 120, "subCategory", errors);
  stringOrNull(data.gender, 60, "gender", errors);
  stringOrNull(data.year, 40, "year", errors);
  stringOrNull(data.season, 80, "season", errors);
  stringOrNull(data.madeIn, 120, "madeIn", errors);
  stringOrNull(data.materials, 1000, "materials", errors);
  stringOrNull(data.careText, 4000, "careText", errors);
  stringOrNull(data.color, 120, "color", errors);
  stringOrNull(data.notes, 4000, "notes", errors);

  if (typeof data.imageUrl !== "string" || data.imageUrl.length === 0 || data.imageUrl.length > 2048) {
    errors.push(`imageUrl: invalid (${JSON.stringify(data.imageUrl)})`);
  }

  stringOrNull(data.thumbnailUrl, 2048, "thumbnailUrl", errors);
  listOrNull(data.extraImageUrls, 8, "extraImageUrls", errors);
  stringOrNull(data.sourceUrl, 2048, "sourceUrl", errors);
  stringOrNull(data.sourceName, 255, "sourceName", errors);

  if (data.sourceType != null && !ALLOWED_SOURCE_TYPES.includes(data.sourceType)) {
    errors.push(`sourceType: invalid value "${data.sourceType}"`);
  }
  if (data.verificationStatus != null && !ALLOWED_VERIFICATION.includes(data.verificationStatus)) {
    errors.push(`verificationStatus: invalid value "${data.verificationStatus}"`);
  }

  stringOrNull(data.searchText, 20000, "searchText", errors);
  stringOrNull(data.storagePath, 1024, "storagePath", errors);
  stringOrNull(data.createdBy, 128, "createdBy", errors);
  stringOrNull(data.importedAt, 80, "importedAt", errors);

  if (data.confidence != null) {
    if (typeof data.confidence !== "number" || data.confidence < 0 || data.confidence > 1) {
      errors.push(`confidence: invalid value ${data.confidence}`);
    }
  }

  return errors;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const snap = await getDocs(collection(db, "tags"));
console.log(`Checked ${snap.size} documents in tags.\n`);

let failCount = 0;
snap.forEach((doc) => {
  const errors = validate(doc.data());
  if (errors.length > 0) {
    failCount++;
    console.log(`FAIL ${doc.id}:`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
});

console.log(`\n${snap.size - failCount} / ${snap.size} documents would pass validTagData().`);
if (failCount === 0) {
  console.log("Safe to enable validTagData() on update -- every existing document already conforms.");
} else {
  console.log(`${failCount} document(s) would need fixing (or the rule loosened) before enabling update validation.`);
}
