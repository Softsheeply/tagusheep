// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const storageBucket = process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET?.trim();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID!,
  storageBucket: storageBucket!, // e.g., tagusheep-72229.appspot.com
  appId: process.env.NEXT_PUBLIC_FB_APP_ID!,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Auth / DB
export const auth = getAuth(app);
export const google = new GoogleAuthProvider();
export const db = getFirestore(app);

// Storage — use the app's configured default bucket first
export const storage = getStorage(app);
