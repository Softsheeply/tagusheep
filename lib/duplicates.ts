import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normalizeBrand, normalizeStyleNumber, type TagRecord } from "@/lib/records";

export type DuplicateCandidate = Pick<TagRecord, "brand" | "productName" | "styleNumber" | "thumbnailUrl" | "imageUrl"> & { id: string };

export async function findPotentialDuplicates(brand?: string | null, styleNumber?: string | null): Promise<DuplicateCandidate[]> {
  const normalizedBrand = normalizeBrand(brand);
  const normalizedStyle = normalizeStyleNumber(styleNumber);

  if (!normalizedBrand || !normalizedStyle) return [];

  const qRef = query(
    collection(db, "tags"),
    where("brand", "==", normalizedBrand),
    where("styleNumber", "==", normalizedStyle),
    limit(10)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Partial<TagRecord>) })) as DuplicateCandidate[];
}
