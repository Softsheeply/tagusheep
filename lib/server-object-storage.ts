import "server-only";

import {
  deleteCloudflareImage,
  isCloudflareImagesConfigured,
  putCloudflareImage,
} from "@/lib/cloudflare-images";

export type StoredImageProvider = "cloudflare" | "firebase";

export type StoredImage = {
  url: string;
  thumbnailUrl: string;
  storagePath: string;
  provider: StoredImageProvider;
};

function storageBucket() {
  const bucket = process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET?.trim();
  if (!bucket) {
    throw new Error("Firebase Storage is not configured (NEXT_PUBLIC_FB_STORAGE_BUCKET).");
  }
  return bucket;
}

function objectUrl(bucket: string, path: string, token?: string) {
  const encoded = encodeURIComponent(path);
  const base = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}

type FirebaseUploadResponse = {
  name?: string;
  downloadTokens?: string;
  error?: { message?: string };
};

async function putFirebaseStorageImage(
  path: string,
  body: Uint8Array,
  contentType: string,
  idToken: string
): Promise<StoredImage> {
  const bucket = storageBucket();
  const response = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: new Blob([Uint8Array.from(body)], { type: contentType || "application/octet-stream" }),
      cache: "no-store",
    }
  );
  const payload = (await response.json().catch(() => null)) as FirebaseUploadResponse | null;
  if (!response.ok || !payload?.name) {
    throw new Error(payload?.error?.message || `Firebase Storage upload failed (${response.status}).`);
  }
  const url = objectUrl(bucket, payload.name, payload.downloadTokens);
  return { url, thumbnailUrl: url, storagePath: path, provider: "firebase" };
}

async function deleteFirebaseStorageImage(path: string, idToken: string) {
  const bucket = storageBucket();
  const response = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    }
  );
  if (!response.ok && response.status !== 404) {
    const payload = (await response.json().catch(() => null)) as FirebaseUploadResponse | null;
    throw new Error(payload?.error?.message || `Firebase Storage delete failed (${response.status}).`);
  }
}

/**
 * Prefer Cloudflare Images when configured; fall back to Firebase Storage so
 * admin capture keeps working without CF env vars (same idea as community uploads).
 */
export async function putStoredImage(
  path: string,
  body: Uint8Array,
  contentType: string,
  idToken: string
): Promise<StoredImage> {
  if (isCloudflareImagesConfigured()) {
    try {
      const image = await putCloudflareImage(path, body, contentType);
      return { url: image.url, thumbnailUrl: image.thumbnailUrl, storagePath: path, provider: "cloudflare" };
    } catch (error) {
      console.warn("Cloudflare Images upload failed; falling back to Firebase Storage.", error);
    }
  }

  return putFirebaseStorageImage(path, body, contentType, idToken);
}

export async function deleteStoredImage(image: StoredImage, idToken: string) {
  if (image.provider === "cloudflare") {
    try {
      await deleteCloudflareImage(image.storagePath);
      return;
    } catch (error) {
      console.warn("Cloudflare Images delete failed:", error);
    }
  }

  try {
    await deleteFirebaseStorageImage(image.storagePath, idToken);
  } catch (error) {
    console.warn("Firebase Storage delete failed:", error);
  }
}
