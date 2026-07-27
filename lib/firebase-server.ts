import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};

// Separate named app (Firestore-only, no Auth/Storage) for server contexts
// like generateMetadata and sitemap.ts, so those routes never load the
// browser-oriented Auth SDK.
function getServerApp(): FirebaseApp {
  const existing = getApps().find((app) => app.name === "server");
  return existing ?? initializeApp(firebaseConfig, "server");
}

export const serverDb = getFirestore(getServerApp());
