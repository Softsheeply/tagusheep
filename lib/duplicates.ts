import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeBrand, normalizeRn, normalizeStyleNumber, type TagRecord } from "@/lib/records";

export type DuplicateCandidate = Pick<TagRecord, "brand" | "productName" | "styleNumber" | "thumbnailUrl" | "imageUrl" | "rn"> & {
  id: string;
  matchReason?: string;
};

function dedupeCandidates(items: DuplicateCandidate[]) {
  const seen = new Map<string, DuplicateCandidate>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values()).slice(0, 12);
}

export async function findPotentialDuplicates(
  brand?: string | null,
  styleNumber?: string | null,
  rn?: string | null
): Promise<DuplicateCandidate[]> {
  const normalizedBrand = normalizeBrand(brand);
  const normalizedStyle = normalizeStyleNumber(styleNumber);
  const cleanRn = normalizeRn(rn);

  const checks: Array<Promise<DuplicateCandidate[]>> = [];

  if (normalizedBrand && normalizedStyle) {
    checks.push(
      getDocs(
        query(
          collection(db, "tags"),
          where("brand", "==", normalizedBrand),
          where("styleNumber", "==", normalizedStyle),
          limit(10)
        )
      ).then((snap) =>
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Partial<TagRecord>),
          matchReason: "brand + style number",
        })) as DuplicateCandidate[]
      )
    );
  }

  if (cleanRn) {
    checks.push(
      getDocs(query(collection(db, "tags"), where("rn", "==", cleanRn), limit(10))).then((snap) =>
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Partial<TagRecord>),
          matchReason: "RN",
        })) as DuplicateCandidate[]
      )
    );
  }

  if (normalizedBrand && cleanRn) {
    checks.push(
      getDocs(
        query(
          collection(db, "tags"),
          where("brand", "==", normalizedBrand),
          where("rn", "==", cleanRn),
          limit(10)
        )
      ).then((snap) =>
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Partial<TagRecord>),
          matchReason: "brand + RN",
        })) as DuplicateCandidate[]
      )
    );
  }

  if (checks.length === 0) return [];

  const results = await Promise.all(checks);
  return dedupeCandidates(results.flat());
}
