// Imports the "Clothing Dataset for Second-Hand Fashion" (CC-BY 4.0) into
// Tagsheep, running OCR over each garment's brand-label photo to recover the
// RN / style number / made-in / composition that the dataset's own
// annotations don't carry.
//
//   Dataset: https://zenodo.org/records/13788681
//   Licence: CC-BY 4.0 (commercial use permitted WITH attribution)
//   Source:  RISE Research Institutes of Sweden, Wargon Innovation AB,
//            Myrorna AB -- "AI for resource-efficient circular fashion"
//
// The licence obliges us to credit the source. Every record this writes
// carries sourceName/sourceUrl/notes attribution, and the records are
// tagged sourceType "archive" so they stay distinguishable from tags the
// community actually photographed.
//
// ---------------------------------------------------------------------
// USAGE
//
//   1. Download + unzip the dataset, then LOOK AT IT FIRST:
//        node scripts/import-secondhand-dataset.mjs --inspect --dataset ./clothing-dataset
//
//      This touches nothing. It reports the folder layout, which JSON keys
//      actually exist, and how often each is populated. The field mapping
//      below is written against the dataset's published documentation, not
//      against a copy I was able to open -- so confirm the reported keys
//      line up with FIELD_ALIASES before importing, and adjust if not.
//
//   2. Dry run (does everything except write to Firebase):
//        node --env-file=.env.local scripts/import-secondhand-dataset.mjs \
//          --dataset ./clothing-dataset --limit 20 --dry-run
//
//   3. Real import:
//        TAGSHEEP_IMPORT_EMAIL=you@example.com \
//        TAGSHEEP_IMPORT_PASSWORD=... \
//        node --env-file=.env.local scripts/import-secondhand-dataset.mjs \
//          --dataset ./clothing-dataset --limit 2000
//
// Get .env.local with `vercel env pull .env.local`. Sign-in uses the normal
// client SDK, so every write goes through the same Firestore/Storage rules
// a browser would -- no service account, no rule bypass.
//
// Progress is checkpointed to <dataset>/.tagsheep-import-progress.json, so
// re-running resumes rather than re-uploading. Safe to interrupt.
// ---------------------------------------------------------------------

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createWorker } from "tesseract.js";

import {
  extractMadeIn,
  extractMaterials,
  extractRn,
  extractStyleNumber,
} from "../lib/tag-text-extract.mjs";

const DATASET_NAME = "Clothing Dataset for Second-Hand Fashion (CC-BY 4.0)";
const DATASET_URL = "https://zenodo.org/records/13788681";
const ATTRIBUTION =
  "Imported from the Clothing Dataset for Second-Hand Fashion by RISE Research " +
  "Institutes of Sweden, Wargon Innovation AB and Myrorna AB, licensed CC-BY 4.0. " +
  `Source: ${DATASET_URL}`;

// Firestore rules cap these; exceeding one rejects the whole write.
const LIMITS = { brand: 120, styleNumber: 120, rn: 7, garmentType: 120, size: 60, color: 120, materials: 1000, notes: 4000, madeIn: 120, tags: 25 };

// The dataset's own docs name these fields; spellings are guesses in places
// (colour/color, type/category). Each entry is tried in order, matched
// case-insensitively, so an unexpected spelling is a one-line fix here
// rather than a rewrite. Run --inspect to see what the files really use.
const FIELD_ALIASES = {
  brand: ["brand", "brand_name", "brandname", "marke"],
  color: ["colour", "color", "colours", "colors"],
  materials: ["material", "materials", "composition", "fabric"],
  garmentType: ["type", "category", "garment_type", "garmenttype", "clothing_type", "product_type"],
  size: ["size", "garment_size"],
  pattern: ["pattern", "print"],
  condition: ["condition"],
  usage: ["usage", "destination"],
  trend: ["trend", "fashion_level", "style"],
};

function parseArgs(argv) {
  const args = {
    dataset: null,
    limit: Infinity,
    maxUploadMb: Infinity,
    concurrency: 3,
    inspect: false,
    plan: false,
    dryRun: false,
    withGarmentPhotos: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dataset") args.dataset = argv[++i];
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--max-upload-mb") args.maxUploadMb = Math.max(0, Number(argv[++i]));
    else if (arg === "--concurrency") args.concurrency = Math.max(1, Number(argv[++i]));
    else if (arg === "--inspect") args.inspect = true;
    else if (arg === "--plan") args.plan = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--with-garment-photos") args.withGarmentPhotos = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

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

// The three photos per item are front, back, and a brand-label close-up.
// Only the label shot is a "tag" in Tagsheep's sense, so it has to be
// identified rather than guessed at by position.
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

function clamp(value, max) {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : null;
}

// Groups loose files into items. Handles both plausible layouts: one folder
// per item, or a flat folder where the item id is the filename stem.
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

async function runInspect(datasetRoot) {
  console.log(`Inspecting ${datasetRoot}\n`);
  const found = await walk(datasetRoot);
  console.log(`JSON files found:  ${found.json.length}`);
  console.log(`Image files found: ${found.images.length}\n`);

  if (found.json.length === 0) {
    console.log("No JSON files found. Is --dataset pointing at the unzipped dataset root?");
    return;
  }

  const items = groupItems(found);
  console.log(`Grouped into ${items.length} items.\n`);

  console.log("Sample paths:");
  for (const item of items.slice(0, 3)) {
    console.log(`  ${path.relative(datasetRoot, item.jsonPath)}`);
    for (const [kind, p] of Object.entries(item.images)) {
      console.log(`      ${kind.padEnd(8)} ${path.relative(datasetRoot, p)}`);
    }
  }

  const imageKindCounts = {};
  for (const item of items) {
    for (const kind of Object.keys(item.images)) imageKindCounts[kind] = (imageKindCounts[kind] || 0) + 1;
  }
  console.log(`\nImage kinds detected across items:`, imageKindCounts);
  if (!imageKindCounts.brand) {
    console.log("  !! No brand-label images matched. classifyImage() needs adjusting for this naming.");
  }

  // Union of JSON keys with fill rates, so a wrong guess in FIELD_ALIASES
  // is obvious before anything gets written.
  const sample = items.slice(0, 400);
  const keyStats = new Map();
  const examples = new Map();
  let parsed = 0;
  for (const item of sample) {
    let data;
    try {
      data = JSON.parse(await readFile(item.jsonPath, "utf8"));
    } catch {
      continue;
    }
    parsed++;
    const flat = Array.isArray(data) ? Object.assign({}, ...data.filter((d) => d && typeof d === "object")) : data;
    for (const [key, value] of Object.entries(flat || {})) {
      const populated = value !== null && value !== undefined && String(value).trim() !== "";
      keyStats.set(key, (keyStats.get(key) || 0) + (populated ? 1 : 0));
      if (populated && !examples.has(key)) examples.set(key, JSON.stringify(value).slice(0, 70));
    }
  }

  console.log(`\nJSON keys across ${parsed} sampled items (populated count, example):`);
  for (const [key, count] of [...keyStats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(24)} ${String(count).padStart(4)}/${parsed}  ${examples.get(key) ?? ""}`);
  }

  console.log(`\nHow those map onto Tagsheep fields right now:`);
  for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
    const hit = aliases.find((a) => [...keyStats.keys()].some((k) => k.toLowerCase() === a.toLowerCase()));
    console.log(`  ${target.padEnd(14)} <- ${hit ?? "NO MATCH -- edit FIELD_ALIASES"}`);
  }
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.dataset) {
    console.log("Usage: node scripts/import-secondhand-dataset.mjs --dataset <path> [--inspect] [--plan] [--dry-run] [--limit N] [--max-upload-mb N] [--concurrency N] [--with-garment-photos]");
    process.exit(args.help ? 0 : 1);
  }

  const datasetRoot = path.resolve(args.dataset);
  if (!existsSync(datasetRoot)) {
    console.error(`Dataset path does not exist: ${datasetRoot}`);
    process.exit(1);
  }

  if (args.inspect) {
    await runInspect(datasetRoot);
    return;
  }

  const found = await walk(datasetRoot);
  const allItems = groupItems(found);
  if (allItems.length === 0) {
    console.error("No items found. Run with --inspect to see what's in there.");
    process.exit(1);
  }

  const progressPath = path.join(datasetRoot, ".tagsheep-import-progress.json");
  let done = new Set();
  if (existsSync(progressPath)) {
    try {
      done = new Set(JSON.parse(await readFile(progressPath, "utf8")).imported || []);
      console.log(`Resuming: ${done.size} items already imported.`);
    } catch {}
  }

  // Only items with a brand-label photo are importable -- that photo is the
  // record's required imageUrl, and it's the one OCR reads.
  const candidates = allItems.filter((item) => item.images.brand && !done.has(item.id)).slice(0, args.limit);
  const maxUploadBytes = Number.isFinite(args.maxUploadMb) ? args.maxUploadMb * 1024 * 1024 : Infinity;
  const queue = [];
  let plannedUploadBytes = 0;
  for (const item of candidates) {
    const imagePaths = [item.images.brand];
    if (args.withGarmentPhotos) {
      for (const kind of ["front", "back"]) {
        if (item.images[kind]) imagePaths.push(item.images[kind]);
      }
    }
    let itemBytes = 0;
    for (const imagePath of imagePaths) itemBytes += (await stat(imagePath)).size;
    if (queue.length > 0 && plannedUploadBytes + itemBytes > maxUploadBytes) break;
    queue.push(item);
    plannedUploadBytes += itemBytes;
  }
  const skippedNoLabel = allItems.filter((item) => !item.images.brand).length;

  console.log(`${allItems.length} items total, ${skippedNoLabel} without a brand-label photo (skipped).`);
  console.log(`Planned image upload: ${(plannedUploadBytes / 1024 / 1024).toFixed(1)} MB.`);
  if (args.plan) {
    console.log(`Plan only: ${queue.length} complete items selected; nothing uploaded or written.`);
    return;
  }
  console.log(`Importing ${queue.length} items with concurrency ${args.concurrency}${args.dryRun ? " (DRY RUN)" : ""}.\n`);
  if (queue.length === 0) return;

  let db = null;
  let objectStorage = null;
  let r2Bucket = null;
  let r2PublicUrl = null;
  let uid = "dry-run-uid";

  if (!args.dryRun) {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FB_APP_ID,
    };
    if (!firebaseConfig.projectId) {
      console.error("Missing NEXT_PUBLIC_FB_* env vars. Run: vercel env pull .env.local, then pass --env-file=.env.local");
      process.exit(1);
    }
    const email = process.env.TAGSHEEP_IMPORT_EMAIL;
    const password = process.env.TAGSHEEP_IMPORT_PASSWORD;
    if (!email || !password) {
      console.error("Set TAGSHEEP_IMPORT_EMAIL and TAGSHEEP_IMPORT_PASSWORD (an account that can write to Firestore).");
      process.exit(1);
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    uid = credential.user.uid;
    db = getFirestore(app);
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    r2Bucket = process.env.R2_BUCKET_NAME;
    r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/+$/, "");
    if (!accountId || !accessKeyId || !secretAccessKey || !r2Bucket || !r2PublicUrl) {
      console.error("Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and NEXT_PUBLIC_R2_PUBLIC_URL.");
      process.exit(1);
    }
    objectStorage = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    console.log(`Signed in as ${email} (${uid}).\n`);
  }

  const stats = { imported: 0, failed: 0, ocrHits: { rn: 0, styleNumber: 0, madeIn: 0, materials: 0 } };
  const importedIds = [];

  async function saveProgress() {
    await writeFile(progressPath, JSON.stringify({ imported: [...done, ...importedIds] }, null, 2));
  }

  async function uploadImage(filePath, suffix) {
    const bytes = await readFile(filePath);
    const storagePath = `tagusheep/imports/${uid}/${Date.now()}_${suffix}_${path.basename(filePath)}`;
    await objectStorage.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: storagePath,
      Body: bytes,
      ContentType: contentTypeFor(filePath),
      CacheControl: "public, max-age=31536000, immutable",
    }));
    const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
    return { url: `${r2PublicUrl}/${encodedPath}`, storagePath };
  }

  // One Tesseract worker per lane: a worker can't safely run concurrent
  // recognize() calls, but booting one per photo would dominate runtime.
  async function runLane(laneItems, laneIndex) {
    const worker = await createWorker("eng", 1, {
      corePath: path.resolve("./public/tesseract/core"),
      langPath: path.resolve("./public/tesseract/lang"),
    });

    try {
      for (const item of laneItems) {
        try {
          let annotations = {};
          try {
            const raw = JSON.parse(await readFile(item.jsonPath, "utf8"));
            annotations = Array.isArray(raw) ? Object.assign({}, ...raw.filter((d) => d && typeof d === "object")) : raw;
          } catch {
            // An unreadable annotation file isn't fatal: the label photo
            // plus OCR still yields a usable record.
          }

          const { data } = await worker.recognize(item.images.brand);
          const ocrText = data.text || "";

          const ocrRn = extractRn(ocrText);
          const ocrStyle = extractStyleNumber(ocrText);
          const ocrMadeIn = extractMadeIn(ocrText);
          const ocrMaterials = extractMaterials(ocrText);

          if (ocrRn) stats.ocrHits.rn++;
          if (ocrStyle) stats.ocrHits.styleNumber++;
          if (ocrMadeIn) stats.ocrHits.madeIn++;
          if (ocrMaterials) stats.ocrHits.materials++;

          const brand = clamp(pick(annotations, FIELD_ALIASES.brand), LIMITS.brand);
          const condition = pick(annotations, FIELD_ALIASES.condition);
          const pattern = pick(annotations, FIELD_ALIASES.pattern);
          const noteParts = [ATTRIBUTION];
          if (condition) noteParts.push(`Condition rating: ${condition}.`);
          if (pattern) noteParts.push(`Pattern: ${pattern}.`);

          // rn is capped at 7 chars by firestore.rules; extractRn can return
          // 8 digits, which would reject the whole document.
          const rnDigits = ocrRn ? ocrRn.replace(/\D+/g, "").slice(0, LIMITS.rn) : null;

          const record = {
            imageUrl: null,
            thumbnailUrl: null,
            storagePath: null,
            extraImageUrls: [],
            brand,
            garmentType: clamp(pick(annotations, FIELD_ALIASES.garmentType), LIMITS.garmentType),
            color: clamp(pick(annotations, FIELD_ALIASES.color), LIMITS.color),
            size: clamp(pick(annotations, FIELD_ALIASES.size), LIMITS.size),
            // Dataset material comes off an NIR scanner and is more reliable
            // than OCR of a worn care label, so it wins where both exist.
            materials: clamp(pick(annotations, FIELD_ALIASES.materials) || ocrMaterials, LIMITS.materials),
            rn: rnDigits || null,
            styleNumber: clamp(ocrStyle, LIMITS.styleNumber),
            madeIn: clamp(ocrMadeIn, LIMITS.madeIn),
            notes: clamp(noteParts.join(" "), LIMITS.notes),
            sourceType: "archive",
            sourceName: clamp(DATASET_NAME, 255),
            sourceUrl: DATASET_URL,
            verificationStatus: "pending",
            createdBy: uid,
            importedAt: new Date().toISOString(),
          };

          if (args.dryRun) {
            console.log(
              `[dry] ${item.id} brand=${record.brand ?? "-"} rn=${record.rn ?? "-"} style=${record.styleNumber ?? "-"} ` +
                `madeIn=${record.madeIn ?? "-"} materials=${record.materials ? record.materials.slice(0, 30) : "-"}`
            );
            stats.imported++;
            continue;
          }

          const primary = await uploadImage(item.images.brand, "label");
          record.imageUrl = primary.url;
          record.thumbnailUrl = primary.url;
          record.storagePath = primary.storagePath;

          if (args.withGarmentPhotos) {
            for (const kind of ["front", "back"]) {
              if (!item.images[kind]) continue;
              const extra = await uploadImage(item.images[kind], kind);
              record.extraImageUrls.push(extra.url);
            }
          }

          record.searchText = [record.brand, record.rn, record.styleNumber, record.garmentType, record.color, record.materials, record.madeIn]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .slice(0, 20000);

          // Firestore rejects a document with an unexpected key, so strip
          // anything that ended up null/empty rather than sending it.
          const payload = Object.fromEntries(
            Object.entries(record).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
          );
          payload.createdAt = serverTimestamp();

          await addDoc(collection(db, "tags"), payload);
          importedIds.push(item.id);
          stats.imported++;

          if (stats.imported % 25 === 0) {
            console.log(`  ${stats.imported}/${queue.length} imported (lane ${laneIndex})`);
            await saveProgress();
          }
        } catch (error) {
          stats.failed++;
          console.error(`  FAILED ${item.id}: ${error instanceof Error ? error.message : error}`);
        }
      }
    } finally {
      await worker.terminate();
    }
  }

  const lanes = Array.from({ length: args.concurrency }, () => []);
  queue.forEach((item, index) => lanes[index % args.concurrency].push(item));
  await Promise.all(lanes.map((laneItems, index) => runLane(laneItems, index)));

  if (!args.dryRun) await saveProgress();

  console.log(`\nDone. Imported ${stats.imported}, failed ${stats.failed}.`);
  console.log(
    `OCR recovered: RN ${stats.ocrHits.rn}, style number ${stats.ocrHits.styleNumber}, ` +
      `made-in ${stats.ocrHits.madeIn}, composition ${stats.ocrHits.materials} (of ${queue.length} labels read).`
  );
  if (!args.dryRun) console.log(`Records are live as "pending" with ${DATASET_NAME} attribution.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
