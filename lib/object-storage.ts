"use client";

import { auth, storage } from "@/lib/firebase";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { IMAGE_POLICY } from "@/lib/images";

export type ImageProvider = "cloudflare" | "firebase";

export type UploadImageResult = {
  url: string;
  thumbnailUrl: string;
  storagePath: string;
  provider: ImageProvider;
};

async function authorizationHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

async function uploadToCloudflare(file: File, storagePath: string): Promise<UploadImageResult | null> {
  try {
    const body = new FormData();
    body.set("file", file);
    body.set("path", storagePath);
    const response = await fetch("/api/storage", {
      method: "POST",
      headers: await authorizationHeader(),
      body,
    });

    if (response.status === 503) {
      // Not configured in this environment -- caller should use Firebase.
      return null;
    }

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      // Prefer Firebase over failing the whole submit when CF is misconfigured
      // or briefly unavailable.
      console.warn("Cloudflare Images upload failed; falling back to Firebase Storage.", result?.error || response.status);
      return null;
    }

    return {
      url: result.url as string,
      thumbnailUrl: (result.thumbnailUrl as string) || (result.url as string),
      storagePath: (result.storagePath as string) || storagePath,
      provider: "cloudflare",
    };
  } catch (error) {
    console.warn("Cloudflare Images upload errored; falling back to Firebase Storage.", error);
    return null;
  }
}

async function uploadToFirebase(file: File, storagePath: string): Promise<UploadImageResult> {
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || IMAGE_POLICY.mimeType });
  const url = await getDownloadURL(storageRef);
  return { url, thumbnailUrl: url, storagePath, provider: "firebase" };
}

/**
 * Upload a garment photo. Prefers Cloudflare Images when configured;
 * falls back to Firebase Storage so invites keep working without CF creds.
 */
export async function uploadImageObject(file: File, storagePath: string): Promise<UploadImageResult> {
  const cloudflare = await uploadToCloudflare(file, storagePath);
  if (cloudflare) return cloudflare;
  return uploadToFirebase(file, storagePath);
}

/**
 * Best-effort delete: try Cloudflare Images, then Firebase Storage.
 * Either may 404 depending on which provider actually holds the object.
 */
export async function deleteImageObject(storagePath: string) {
  try {
    const response = await fetch("/api/storage", {
      method: "DELETE",
      headers: { ...(await authorizationHeader()), "content-type": "application/json" },
      body: JSON.stringify({ path: storagePath }),
    });
    if (!response.ok && response.status !== 503 && response.status !== 404) {
      const result = await response.json().catch(() => null);
      console.warn("Cloudflare Images delete failed:", result?.error || response.status);
    }
  } catch (error) {
    console.warn("Cloudflare Images delete errored:", error);
  }

  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // Ignore -- object may live only on Cloudflare, or already be gone.
  }
}
