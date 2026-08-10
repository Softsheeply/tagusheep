import "server-only";

import { normalizeBrand, normalizeRn, normalizeStyleNumber, type TagRecord } from "@/lib/records";
import { titleSimilarity } from "@/lib/capture-policy";

type FirestoreValue = Record<string, unknown>;
type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue> };

function projectId() {
  const value = process.env.NEXT_PUBLIC_FB_PROJECT_ID?.trim();
  if (!value) throw new Error("Firebase project ID is not configured.");
  return value;
}

function databaseName() {
  return `projects/${projectId()}/databases/(default)`;
}

function root() {
  return `https://firestore.googleapis.com/v1/${databaseName()}`;
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  return { nullValue: null };
}

function encodeFields(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encodeValue(item)]));
}

function decodeValue(value?: FirestoreValue): unknown {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    const values = (value.arrayValue as { values?: FirestoreValue[] }).values || [];
    return values.map(decodeValue);
  }
  if ("mapValue" in value) return decodeFields((value.mapValue as { fields?: Record<string, FirestoreValue> }).fields || {});
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeDocument(document: FirestoreDocument) {
  return {
    id: document.name.split("/").pop() || "",
    ...(decodeFields(document.fields || {}) as Partial<TagRecord>),
  };
}

async function requestJson(url: string, idToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${idToken}`, "content-type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `Firestore request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

async function runEqualQuery(field: string, value: string, idToken: string, limit = 25) {
  const payload = await requestJson(`${root()}/documents:runQuery`, idToken, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "tags" }],
        where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: encodeValue(value) } },
        limit,
      },
    }),
  });
  return (payload as Array<{ document?: FirestoreDocument }>).flatMap((row) => row.document ? [decodeDocument(row.document)] : []);
}

export type ServerDuplicateCandidate = Partial<TagRecord> & { id: string; matchReason: string; score: number };

export async function findServerDuplicates(record: Partial<TagRecord>, idToken: string): Promise<ServerDuplicateCandidate[]> {
  const brand = normalizeBrand(record.brand);
  const style = normalizeStyleNumber(record.styleNumber);
  const rn = normalizeRn(record.rn);
  const productTitle = [brand, record.productName, record.garmentType, record.color].filter(Boolean).join(" ");
  const checks: Array<Promise<Array<Partial<TagRecord> & { id: string }>>> = [];

  if (rn) checks.push(runEqualQuery("rn", rn, idToken));
  if (style) checks.push(runEqualQuery("styleNumber", style, idToken));
  if (brand) checks.push(runEqualQuery("brand", brand, idToken, 60));
  if (!checks.length) return [];

  const rows = (await Promise.all(checks)).flat();
  const found = new Map<string, ServerDuplicateCandidate>();
  for (const candidate of rows) {
    const sameStyle = Boolean(brand && style && normalizeBrand(candidate.brand)?.toLocaleLowerCase() === brand.toLocaleLowerCase() && normalizeStyleNumber(candidate.styleNumber) === style);
    const sameRn = Boolean(rn && normalizeRn(candidate.rn) === rn);
    const candidateTitle = [candidate.brand, candidate.productName, candidate.garmentType, candidate.color].filter(Boolean).join(" ");
    const score = titleSimilarity(productTitle, candidateTitle);
    if (!sameStyle && !sameRn && score < 0.82) continue;
    const matchReason = sameStyle ? "brand + style number" : sameRn ? "RN" : "similar product title";
    found.set(candidate.id, { ...candidate, matchReason, score: sameStyle || sameRn ? 1 : score });
  }
  return Array.from(found.values()).sort((a, b) => b.score - a.score).slice(0, 8);
}

export async function getTagDocument(id: string, idToken: string) {
  const document = await requestJson(`${root()}/documents/tags/${encodeURIComponent(id)}`, idToken) as FirestoreDocument;
  return decodeDocument(document);
}

export async function createTagDocument(record: Record<string, unknown>, idToken: string) {
  const id = crypto.randomUUID();
  const name = `${databaseName()}/documents/tags/${id}`;
  await requestJson(`${root()}/documents:commit`, idToken, {
    method: "POST",
    body: JSON.stringify({
      writes: [{
        update: { name, fields: encodeFields(record) },
        updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
        currentDocument: { exists: false },
      }],
    }),
  });
  return id;
}

export async function updateTagDocument(id: string, record: Record<string, unknown>, idToken: string) {
  const fields = encodeFields(record);
  const fieldPaths = Object.keys(fields).map(encodeURIComponent).join("&updateMask.fieldPaths=");
  const url = `${root()}/documents/tags/${encodeURIComponent(id)}?updateMask.fieldPaths=${fieldPaths}`;
  await requestJson(url, idToken, { method: "PATCH", body: JSON.stringify({ fields }) });
}
