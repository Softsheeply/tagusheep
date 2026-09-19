#!/usr/bin/env node
/**
 * Local CLI reset — deletes all Firestore `tags` documents.
 *
 *   vercel env pull .env.local
 *   node --env-file=.env.local scripts/reset-archive.mjs --confirm
 *
 * Requires TAGSHEEP_IMPORT_EMAIL + TAGSHEEP_IMPORT_PASSWORD (or Firebase auth env).
 */

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, getFirestore } from "firebase/firestore";

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional .env.local
  }
}

loadEnvFile(".env.local");

const confirm = process.argv.includes("--confirm");
const email = process.env.TAGSHEEP_IMPORT_EMAIL?.trim();
const password = process.env.TAGSHEEP_IMPORT_PASSWORD?.trim();
const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY?.trim();
const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID?.trim();

if (!confirm) {
  console.error("Refusing to run without --confirm");
  process.exit(1);
}
if (!email || !password || !apiKey || !projectId) {
  console.error("Missing TAGSHEEP_IMPORT_EMAIL, TAGSHEEP_IMPORT_PASSWORD, or Firebase public env.");
  process.exit(1);
}

const app = initializeApp({ apiKey, authDomain: `${projectId}.firebaseapp.com`, projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const { user } = await signInWithEmailAndPassword(auth, email, password);
console.log(`Signed in as ${user.email}`);

const snap = await getDocs(collection(db, "tags"));
console.log(`Found ${snap.size} tag records.`);

let deleted = 0;
for (const item of snap.docs) {
  await deleteDoc(doc(db, "tags", item.id));
  deleted += 1;
  if (deleted % 25 === 0) console.log(`Deleted ${deleted}/${snap.size}…`);
}

console.log(`Done. Deleted ${deleted} records.`);
