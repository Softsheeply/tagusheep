const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
const email = process.env.TAGSHEEP_IMPORT_EMAIL;
const password = process.env.TAGSHEEP_IMPORT_PASSWORD;

console.log("projectId:", projectId);

const signInRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }
);
const signInData = await signInRes.json();
if (!signInRes.ok) {
  console.log("SIGN-IN FAILED:", JSON.stringify(signInData, null, 2));
  process.exit(1);
}
console.log("Signed in, uid:", signInData.localId);

const idToken = signInData.idToken;

const writeRes = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/tags`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      fields: {
        brand: { stringValue: "DebugTest" },
        imageUrl: { stringValue: "https://example.com/debug.jpg" },
        sourceType: { stringValue: "archive" },
        verificationStatus: { stringValue: "pending" },
        createdBy: { stringValue: signInData.localId },
      },
    }),
  }
);
const writeData = await writeRes.json();
console.log("Firestore REST write status:", writeRes.status);
console.log("Firestore REST response body:", JSON.stringify(writeData, null, 2));
