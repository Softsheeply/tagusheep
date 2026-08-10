import { NextResponse } from "next/server";
import { analyzeGarmentImages } from "@/lib/capture-ai";
import { evaluateCapture } from "@/lib/capture-policy";
import { findServerDuplicates } from "@/lib/firestore-rest";
import { isFirebaseAdmin, verifyFirebaseBearer } from "@/lib/server-auth";
import { prepareRecord, suggestCategory } from "@/lib/records";

export const runtime = "nodejs";

const MAX_FILES = 8;
const MAX_IMAGE_BYTES = 8_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await isFirebaseAdmin(user.uid, user.idToken))) {
    return NextResponse.json({ error: "Access denied. TagSheep admin access is required." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    if (!files.length) return NextResponse.json({ error: "Add at least one garment photo." }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Add no more than ${MAX_FILES} photos per garment.` }, { status: 400 });
    const invalid = files.find((file) => !ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES);
    if (invalid) return NextResponse.json({ error: `${invalid.name || "An image"} is unsupported or larger than 8 MB.` }, { status: 415 });

    const mode = form.get("mode") === "free" ? "free" : "ai";
    const requestedWebsiteImageCount = Number(form.get("websiteImageCount"));
    const websiteImageCount = Number.isInteger(requestedWebsiteImageCount)
      ? Math.max(0, Math.min(files.length, requestedWebsiteImageCount))
      : files.length;
    const ocrText = form.getAll("ocrText").map((value) => String(value || "").slice(0, 20_000));
    while (ocrText.length < files.length) ocrText.push("");
    const raw = mode === "free"
      ? JSON.parse(String(form.get("freeExtracted") || "{}"))
      : await analyzeGarmentImages(files, ocrText);
    const prepared = prepareRecord({
      ...raw,
      category: raw.category || suggestCategory(raw.productName, raw.garmentType),
      sourceType: "manual",
      verificationStatus: "reviewed",
    });
    const extracted = { ...raw, ...prepared };
    const duplicates = await findServerDuplicates(extracted, user.idToken);
    const stopReasons = evaluateCapture(extracted, { usableImageCount: websiteImageCount, duplicateCount: duplicates.length });

    return NextResponse.json({ extracted, duplicates, stopReasons, instantUpload: stopReasons.length === 0, analysisMode: mode });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Garment analysis failed." }, { status: 502 });
  }
}
