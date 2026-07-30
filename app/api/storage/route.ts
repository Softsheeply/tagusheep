import { NextResponse } from "next/server";
import { deleteR2Object, isR2Configured, putR2Object } from "@/lib/r2";
import { isFirebaseAdmin, verifyFirebaseBearer } from "@/lib/server-auth";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8_000_000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function validUserPath(path: string, uid: string) {
  return path.startsWith(`tagusheep/uploads/${uid}/`) || path.startsWith(`tagusheep/imports/${uid}/`);
}

// Any user's uploads/imports path -- admins can purge other users' objects
// (e.g. from /trash), matching storage.rules' isAdmin() delete escape hatch.
function anyUserPath(path: string) {
  return path.startsWith("tagusheep/uploads/") || path.startsWith("tagusheep/imports/");
}

export async function POST(request: Request) {
  if (!isR2Configured()) return NextResponse.json({ error: "R2 storage is not configured." }, { status: 503 });
  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const path = String(form.get("path") || "").replace(/^\/+/, "");
  if (!(file instanceof File) || !validUserPath(path, user.uid)) {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be JPEG, PNG, WebP, or AVIF and no larger than 8 MB." }, { status: 415 });
  }

  const url = await putR2Object(path, new Uint8Array(await file.arrayBuffer()), file.type);
  return NextResponse.json({ url, storagePath: path, provider: "r2" });
}

export async function DELETE(request: Request) {
  if (!isR2Configured()) return NextResponse.json({ error: "R2 storage is not configured." }, { status: 503 });
  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { path?: string } | null;
  const path = String(body?.path || "").replace(/^\/+/, "");
  const allowed = validUserPath(path, user.uid) || (anyUserPath(path) && (await isFirebaseAdmin(user.uid, user.idToken)));
  if (!allowed) return NextResponse.json({ error: "Invalid object path." }, { status: 403 });
  await deleteR2Object(path);
  return new NextResponse(null, { status: 204 });
}
