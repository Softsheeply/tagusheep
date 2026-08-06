import "server-only";

const accountId = process.env.CF_ACCOUNT_ID?.trim();
const apiToken = process.env.CF_IMAGES_API_TOKEN?.trim();
const accountHash = process.env.CF_IMAGES_ACCOUNT_HASH?.trim() || process.env.NEXT_PUBLIC_CF_IMAGES_HASH?.trim();

export function isCloudflareImagesConfigured() {
  return Boolean(accountId && apiToken && accountHash);
}

function config() {
  if (!isCloudflareImagesConfigured()) {
    throw new Error(
      "Cloudflare Images is not configured. Set CF_ACCOUNT_ID, CF_IMAGES_API_TOKEN, and CF_IMAGES_ACCOUNT_HASH (or NEXT_PUBLIC_CF_IMAGES_HASH)."
    );
  }
  return { accountId: accountId!, apiToken: apiToken!, accountHash: accountHash! };
}

export function cloudflareDeliveryUrl(imageId: string, variant = "public") {
  const { accountHash: hash } = config();
  // Custom IDs may contain slashes; encode each segment for the delivery URL.
  const encodedId = imageId
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `https://imagedelivery.net/${hash}/${encodedId}/${variant}`;
}

type CloudflareImageUploadResult = {
  id: string;
  url: string;
  thumbnailUrl: string;
};

type CloudflareApiResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: {
    id?: string;
    variants?: string[];
  };
};

export async function putCloudflareImage(
  imageId: string,
  body: Uint8Array,
  contentType: string
): Promise<CloudflareImageUploadResult> {
  const value = config();
  const form = new FormData();
  form.set("id", imageId);
  const fileBytes = new Uint8Array(body);
  form.set(
    "file",
    new Blob([fileBytes.buffer], { type: contentType }),
    imageId.split("/").pop() || "image.webp"
  );

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${value.accountId}/images/v1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${value.apiToken}` },
    body: form,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as CloudflareApiResponse | null;
  if (!response.ok || !payload?.success || !payload.result?.id) {
    const detail = payload?.errors?.[0]?.message || `Cloudflare Images upload failed (${response.status})`;
    throw new Error(detail);
  }

  const id = payload.result.id;
  // Prefer Cloudflare-returned variant URLs when present; otherwise build them.
  const variants = payload.result.variants || [];
  const publicVariant = variants.find((v) => v.endsWith("/public")) || cloudflareDeliveryUrl(id, "public");
  // Prefer a named thumbnail variant when the account has one; otherwise reuse
  // the public delivery URL (community uploads already treat thumb == full).
  const thumbnailVariant = variants.find((v) => v.endsWith("/thumbnail")) || publicVariant;

  return {
    id,
    url: publicVariant,
    thumbnailUrl: thumbnailVariant,
  };
}

export async function deleteCloudflareImage(imageId: string) {
  const value = config();
  const encodedId = encodeURIComponent(imageId);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${value.accountId}/images/v1/${encodedId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${value.apiToken}` },
      cache: "no-store",
    }
  );
  // 404 = already gone; treat as success so purge flows stay best-effort.
  if (response.status === 404) return;
  const payload = (await response.json().catch(() => null)) as CloudflareApiResponse | null;
  if (!response.ok || payload?.success === false) {
    const detail = payload?.errors?.[0]?.message || `Cloudflare Images delete failed (${response.status})`;
    throw new Error(detail);
  }
}
