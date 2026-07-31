import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BRAND_PLACEHOLDER_VALUES = new Set(["not in the list", "no brand", "unbranded", "n/a", "unknown"]);
const FIELD_ALIASES = {
  brand: ["brandtext", "brand", "brand_name", "brandname", "marke"],
  color: ["colour", "color", "colours", "colors"],
  materials: ["material", "materials", "composition", "fabric"],
  garmentType: ["type", "category", "garment_type", "garmenttype", "clothing_type", "product_type"],
  size: ["size", "garment_size"],
};

async function walk(dir, out = { json: [], images: [] }, depth = 0) {
  if (depth > 8) return out;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue;
      await walk(full, out, depth + 1);
    } else if (entry.name.toLowerCase().endsWith(".json")) {
      if (entry.name.startsWith(".")) continue;
      out.json.push(full);
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      out.images.push(full);
    }
  }
  return out;
}

function classifyImage(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (/brand|label|tag|marke/.test(name)) return "brand";
  if (/front|_f\b|-f\./.test(name)) return "front";
  if (/back|_b\b|-b\./.test(name)) return "back";
  return "unknown";
}

function pick(obj, aliases) {
  if (!obj || typeof obj !== "object") return null;
  const lowerKeys = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const alias of aliases) {
    const realKey = lowerKeys.get(alias.toLowerCase());
    if (realKey === undefined) continue;
    const value = obj[realKey];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const joined = value.filter((v) => typeof v === "string" && v.trim()).join(", ");
      if (joined) return joined;
      continue;
    }
    if (typeof value === "object") continue;
    const str = String(value).trim();
    if (str && str.toLowerCase() !== "none" && str.toLowerCase() !== "null") return str;
  }
  return null;
}

function pickBrand(annotations) {
  const value = pick(annotations, FIELD_ALIASES.brand);
  if (!value) return null;
  return BRAND_PLACEHOLDER_VALUES.has(value.toLowerCase()) ? null : value;
}

function groupItems(found) {
  const items = new Map();
  const timestampKey = (filePath) => {
    const timestamp = path.basename(filePath).match(/\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}/)?.[0];
    return timestamp ? `${path.dirname(filePath)}\0${timestamp}` : null;
  };
  for (const jsonPath of found.json) {
    const dir = path.dirname(jsonPath);
    const stem = path.basename(jsonPath, ".json");
    const id = `${path.basename(dir)}/${stem}`;
    const item = { id, jsonPath, dir, stem, images: {} };
    items.set(timestampKey(jsonPath) || `${dir}\0${stem}`, item);
  }
  for (const imagePath of found.images) {
    const dir = path.dirname(imagePath);
    const kind = classifyImage(imagePath);
    const imageStem = path.basename(imagePath, path.extname(imagePath));
    const item = items.get(timestampKey(imagePath) || `${dir}\0${imageStem}`);
    if (item && (!item.images[kind] || kind === "brand")) item.images[kind] = imagePath;
  }
  return Array.from(items.values());
}

const datasetRoot = process.argv[2];
if (!datasetRoot) {
  console.log("Usage: node list-sample-items.mjs <path-to-dataset>");
  process.exit(1);
}

const found = await walk(datasetRoot);
const items = groupItems(found);

let shown = 0;
for (const item of items) {
  if (!item.images.brand) continue;
  let annotations = {};
  try {
    const raw = JSON.parse(await readFile(item.jsonPath, "utf8"));
    annotations = Array.isArray(raw) ? Object.assign({}, ...raw.filter((d) => d && typeof d === "object")) : raw;
  } catch {
    continue;
  }
  const brand = pickBrand(annotations);
  if (!brand) continue;

  shown++;
  console.log(`\n${shown}. Brand: ${brand}`);
  console.log(`   Garment type: ${pick(annotations, FIELD_ALIASES.garmentType) || "-"}`);
  console.log(`   Color: ${pick(annotations, FIELD_ALIASES.color) || "-"}`);
  console.log(`   Size: ${pick(annotations, FIELD_ALIASES.size) || "-"}`);
  console.log(`   Materials: ${pick(annotations, FIELD_ALIASES.materials) || "-"}`);
  console.log(`   Photo file: ${path.resolve(item.images.brand)}`);

  if (shown >= 10) break;
}

if (shown === 0) console.log("No qualifying items found.");
