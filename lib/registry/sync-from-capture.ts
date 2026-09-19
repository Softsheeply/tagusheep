import "server-only";

import { normalizeBrand, normalizeRn } from "@/lib/records";
import { upsertRegistryDocument } from "@/lib/firestore-rest";

type CaptureRegistryFields = {
  rn?: string | null;
  ca?: string | null;
  brand?: string | null;
};

function normalizeCa(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  return digits.length === 5 ? digits : null;
}

export async function syncRegistryFromCapture(fields: CaptureRegistryFields, idToken: string) {
  const rn = normalizeRn(fields.rn);
  const ca = normalizeCa(fields.ca);
  const brand = normalizeBrand(fields.brand);
  const now = new Date().toISOString();

  if (rn) {
    await upsertRegistryDocument(
      "rn_registry",
      rn,
      {
        rn,
        retailBrand: brand,
        source: "manual",
        fetchedAt: now,
        notes: "Confirmed via Capture upload.",
      },
      idToken,
    );
  }

  if (ca) {
    await upsertRegistryDocument(
      "ca_registry",
      ca,
      {
        ca,
        legalName: brand,
        source: "manual",
        fetchedAt: now,
      },
      idToken,
    );
  }

  if (rn && brand) {
    const aliasId = `${rn}::${brand.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`;
    await upsertRegistryDocument(
      "brand_aliases",
      aliasId,
      {
        id: aliasId,
        rn,
        ca,
        retailBrand: brand,
        confidence: "curated",
        confirmCount: 1,
        notes: "Mapped from Capture upload.",
      },
      idToken,
    );
  }
}
