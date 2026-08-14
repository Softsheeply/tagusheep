import { NextResponse } from "next/server";
import { evaluateCapture, type CaptureFields } from "@/lib/capture-policy";
import { runCaptureTransaction } from "@/lib/capture-transaction";
import { createTagDocument, findServerDuplicates, getTagDocument, updateTagDocument } from "@/lib/firestore-rest";
import { prepareRecord, type TagRecord } from "@/lib/records";
import { deleteStoredImage, putStoredImage } from "@/lib/server-object-storage";
import { isFirebaseAdmin, verifyFirebaseBearer } from "@/lib/server-auth";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_IMAGE_BYTES = 8_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function cleanObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

const TAG_RECORD_KEYS = [
  "brand", "productName", "rn", "styleNumber", "garmentType", "size", "availableSizes", "tags", "category", "subCategory", "gender", "year", "season",
  "madeIn", "materials", "careText", "color", "notes", "imageUrl", "thumbnailUrl", "extraImageUrls", "sourceUrl", "sourceName", "sourceType",
  "confidence", "verificationStatus", "searchText", "storagePath", "createdBy", "importedAt",
] as const;

function tagRecordPayload(value: Partial<TagRecord>) {
  return cleanObject(Object.fromEntries(TAG_RECORD_KEYS.map((key) => [key, value[key]])));
}

export async function POST(request: Request) {
  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await isFirebaseAdmin(user.uid, user.idToken))) {
    return NextResponse.json({ error: "Access denied. TagSheep admin access is required." }, { status: 403 });
  }
  if (!process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET?.trim()) {
    return NextResponse.json({ error: "Image storage is not configured. No record was created." }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    const action = String(form.get("action") || "create") as "create" | "reviewed_create" | "create_separate" | "update_existing";
    const existingId = String(form.get("existingId") || "").trim();
    const extracted = JSON.parse(String(form.get("extracted") || "{}")) as CaptureFields;

    if (!files.length || files.length > MAX_FILES) throw new Error(`Add between 1 and ${MAX_FILES} usable photos.`);
    const invalid = files.find((file) => !ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES);
    if (invalid) throw new Error(`${invalid.name || "An image"} is unsupported or larger than 8 MB.`);

    const duplicates = await findServerDuplicates(extracted, user.idToken);
    const wasAdminReviewed = action !== "create";
    const reviewedFields = wasAdminReviewed ? {
      ...extracted,
      brandConfidence: 1,
      detectedBrands: extracted.brand ? [extracted.brand] : [],
      detectedRns: extracted.rn ? [extracted.rn] : [],
      detectedStyleNumbers: extracted.styleNumber ? [extracted.styleNumber] : [],
    } : extracted;
    const stopReasons = evaluateCapture(reviewedFields, { usableImageCount: files.length, duplicateCount: action === "create_separate" || action === "update_existing" ? 0 : duplicates.length });
    if (stopReasons.length) {
      return NextResponse.json({ error: "This capture needs review before upload.", stopReasons, duplicates }, { status: 409 });
    }
    if (action === "update_existing" && (!existingId || !duplicates.some((item) => item.id === existingId))) {
      return NextResponse.json({ error: "Select a matching existing record first." }, { status: 409 });
    }

    const result = await runCaptureTransaction({
      files,
      upload: async (file, index) => {
        const extension = file.type === "image/png" ? "png" : file.type === "image/avif" ? "avif" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `tagusheep/uploads/${user.uid}/capture-${Date.now()}-${crypto.randomUUID()}-${index}.${extension}`;
        return putStoredImage(path, new Uint8Array(await file.arrayBuffer()), file.type, user.idToken);
      },
      rollback: async (image) => deleteStoredImage(image, user.idToken),
      persist: async (uploaded) => {
        const requestedMainIndex = Number.isInteger(extracted.mainImageIndex) ? Number(extracted.mainImageIndex) : 0;
        const mainIndex = requestedMainIndex >= 0 && requestedMainIndex < uploaded.length ? requestedMainIndex : 0;
        const main = uploaded[mainIndex];
        const extraUrls = uploaded.filter((_, index) => index !== mainIndex).map((item) => item.url);
        const now = new Date().toISOString();

        if (action === "update_existing") {
          const existing = await getTagDocument(existingId, user.idToken);
          const merged = prepareRecord({
            ...extracted,
            ...Object.fromEntries(Object.entries(existing).filter(([, value]) => value != null && value !== "")),
            imageUrl: existing.imageUrl || main.url,
            thumbnailUrl: existing.thumbnailUrl || main.thumbnailUrl,
            storagePath: existing.storagePath || main.storagePath,
            extraImageUrls: [...(existing.extraImageUrls || []), ...(existing.imageUrl ? uploaded.map((item) => item.url) : extraUrls)].slice(0, 8),
            sourceType: "manual",
            verificationStatus: "reviewed",
            importedAt: now,
          });
          const update = { ...merged } as Partial<TagRecord> & { id?: string };
          delete update.id;
          delete update.createdAt;
          await updateTagDocument(existingId, tagRecordPayload(update), user.idToken);
          return { id: existingId, brand: merged.brand, identifier: merged.styleNumber || merged.rn || merged.productName, thumbnailUrl: merged.thumbnailUrl || merged.imageUrl, updatedExisting: true };
        }

        const prepared = prepareRecord({
          ...extracted,
          imageUrl: main.url,
          thumbnailUrl: main.thumbnailUrl,
          storagePath: main.storagePath,
          extraImageUrls: extraUrls,
          sourceType: "manual",
          verificationStatus: "reviewed",
          createdBy: user.uid,
          importedAt: now,
        });
        const id = await createTagDocument(tagRecordPayload(prepared), user.idToken);
        return { id, brand: prepared.brand, identifier: prepared.styleNumber || prepared.rn || prepared.productName, thumbnailUrl: prepared.thumbnailUrl || prepared.imageUrl };
      },
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed. No record was created." }, { status: 502 });
  }
}
