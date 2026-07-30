"use client";

import { auth } from "@/lib/firebase";

type UploadResult = { url: string; storagePath: string; provider: "r2" };

async function authorizationHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export async function uploadImageObject(file: File, storagePath: string): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  body.set("path", storagePath);
  const response = await fetch("/api/storage", {
    method: "POST",
    headers: await authorizationHeader(),
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error || "Image upload failed");
  return result as UploadResult;
}

export async function deleteImageObject(storagePath: string) {
  const response = await fetch("/api/storage", {
    method: "DELETE",
    headers: { ...(await authorizationHeader()), "content-type": "application/json" },
    body: JSON.stringify({ path: storagePath }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Image deletion failed");
  }
}
