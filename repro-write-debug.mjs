import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID,
};
console.log("Using projectId:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const credential = await signInWithEmailAndPassword(auth, process.env.TAGSHEEP_IMPORT_EMAIL, process.env.TAGSHEEP_IMPORT_PASSWORD);
console.log("Signed in as", credential.user.email, credential.user.uid);

const db = initializeFirestore(app, { experimentalForceLongPolling: true });

try {
  const ref = await addDoc(collection(db, "tags"), {
    brand: "DebugTest",
    imageUrl: "https://example.com/debug.jpg",
    sourceType: "archive",
    verificationStatus: "pending",
    createdBy: credential.user.uid,
  });
  console.log("SUCCESS, doc id:", ref.id);
} catch (err) {
  console.log("FULL ERROR DUMP:");
  console.log("name:", err.name);
  console.log("code:", err.code);
  console.log("message:", err.message);
  console.log("all own properties:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
}
process.exit(0);
