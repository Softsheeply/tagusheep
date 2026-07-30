import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET_NAME?.trim();
const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim().replace(/\/+$/, "");

export function isR2Configured() {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl);
}

function config() {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and NEXT_PUBLIC_R2_PUBLIC_URL.");
  }
  return { accountId: accountId!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucket: bucket!, publicBaseUrl: publicBaseUrl! };
}

function client() {
  const value = config();
  return new S3Client({
    region: "auto",
    endpoint: `https://${value.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
    },
  });
}

export async function putR2Object(key: string, body: Uint8Array, contentType: string) {
  const value = config();
  await client().send(new PutObjectCommand({
    Bucket: value.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${value.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function deleteR2Object(key: string) {
  const value = config();
  await client().send(new DeleteObjectCommand({ Bucket: value.bucket, Key: key }));
}
