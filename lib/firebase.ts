// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const storageBucket = process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET?.trim();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID!,
  storageBucket: storageBucket!, // e.g., tagusheep-72229.firebasestorage.app
  appId: process.env.NEXT_PUBLIC_FB_APP_ID!,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// App Check is opt-in via env var so this is a no-op until a reCAPTCHA v3
// site key exists (Firebase Console -> App Check -> register a web app) and
// enforcement is turned on there. Only runs in the browser, and only once
// per app instance (React strict mode / HMR would otherwise double-init).
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
if (typeof window !== "undefined" && recaptchaSiteKey && !(app as unknown as { _appCheckInitialized?: boolean })._appCheckInitialized) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  (app as unknown as { _appCheckInitialized?: boolean })._appCheckInitialized = true;
}

// Auth / DB
export const auth = getAuth(app);
export const google = new GoogleAuthProvider();
export const db = getFirestore(app);

// Storage — use the app's configured default bucket first
export const storage = getStorage(app);
