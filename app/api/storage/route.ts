import { NextResponse } from "next/server";
import {
  deleteCloudflareImage,
  isCloudflareImagesConfigured,
  putCloudflareImage,
} from "@/lib/cloudflare-images";
import { isFirebaseAdmin, verifyFirebaseBearer } from "@/lib/server-auth";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

function validUserPath(path: string, uid: string) {
  return path.startsWith(`tagusheep/uploads/${uid}/`) || path.startsWith(`tagusheep/imports/${uid}/`);
}

// Admins can purge other users' objects (e.g. from /trash), matching
// storage.rules' isAdmin() delete escape hatch.
function anyUserPath(path: string) {
  return path.startsWith("tagusheep/uploads/") || path.startsWith("tagusheep/imports/");
}

export async function POST(request: Request) {
  if (!isCloudflareImagesConfigured()) {
    return NextResponse.json({ error: "Cloudflare Images is not configured.", code: "cf_not_configured" }, { status: 503 });
  }

  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const path = String(form.get("path") || "").replace(/^\/+/, "");
  if (!(file instanceof File) || !validUserPath(path, user.uid)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image must be JPEG, PNG, WebP, AVIF, or GIF and no larger than 8 MB." },
      { status: 415 }
    );
  }

  try {
    const uploaded = await putCloudflareImage(path, new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json({
      url: uploaded.url,
      thumbnailUrl: uploaded.thumbnailUrl,
      storagePath: path,
      provider: "cloudflare",
      imageId: uploaded.id,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloudflare Images upload failed." },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isCloudflareImagesConfigured()) {
    return NextResponse.json({ error: "Cloudflare Images is not configured.", code: "cf_not_configured" }, { status: 503 });
  }

  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { path?: string } | null;
  const path = String(body?.path || "").replace(/^\/+/, "");
  const allowed = validUserPath(path, user.uid) || (anyUserPath(path) && (await isFirebaseAdmin(user.uid, user.idToken)));
  if (!allowed) return NextResponse.json({ error: "Invalid object path." }, { status: 403 });

  try {
    await deleteCloudflareImage(path);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloudflare Images delete failed." },
      { status: 502 }
    );
  }
}
