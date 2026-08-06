import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type FavoriteRecord = {
  tagId: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: Timestamp | null;
};

export type FavoriteSnapshot = {
  tagId: string;
  brand?: string | null;
  productName?: string | null;
  rn?: string | null;
  styleNumber?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
};

function favoritesCol(uid: string) {
  return collection(db, "users", uid, "favorites");
}

export function favoriteDocPath(uid: string, tagId: string) {
  return doc(db, "users", uid, "favorites", tagId);
}

export async function isFavorite(uid: string, tagId: string) {
  const snap = await getDoc(favoriteDocPath(uid, tagId));
  return snap.exists();
}

export async function listFavorites(uid: string): Promise<FavoriteRecord[]> {
  const snap = await getDocs(query(favoritesCol(uid), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => {
    const data = d.data() as Omit<FavoriteRecord, "tagId">;
    return { tagId: d.id, ...data };
  });
}

export async function addFavorite(uid: string, snapshot: FavoriteSnapshot) {
  const tagId = snapshot.tagId.trim();
  if (!tagId) throw new Error("Missing tag id.");
  await setDoc(favoriteDocPath(uid, tagId), {
    tagId,
    brand: snapshot.brand || null,
    productName: snapshot.productName || null,
    rn: snapshot.rn || null,
    styleNumber: snapshot.styleNumber || null,
    imageUrl: snapshot.imageUrl || null,
    thumbnailUrl: snapshot.thumbnailUrl || null,
    createdAt: serverTimestamp(),
  });
}

export async function removeFavorite(uid: string, tagId: string) {
  await deleteDoc(favoriteDocPath(uid, tagId));
}

export async function toggleFavorite(snapshot: FavoriteSnapshot): Promise<"saved" | "removed"> {
  const user = auth.currentUser;
  if (!user) throw new Error("SIGN_IN_REQUIRED");
  const exists = await isFavorite(user.uid, snapshot.tagId);
  if (exists) {
    await removeFavorite(user.uid, snapshot.tagId);
    return "removed";
  }
  await addFavorite(user.uid, snapshot);
  return "saved";
}
