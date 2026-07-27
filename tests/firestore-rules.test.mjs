// Firestore security rules test suite. Requires the Firestore emulator --
// run via `npm run test:rules`, which wraps this in `firebase emulators:exec`.
// Uses @firebase/rules-unit-testing, the official tool for this: it lets you
// issue reads/writes as a specific (real or fake) uid without needing the
// Auth emulator, and assertSucceeds/assertFails give a clear pass/fail per
// rule rather than requiring you to inspect error codes by hand.

import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const OWNER_UID = "owner-uid";
const OTHER_UID = "other-uid";
const ADMIN_UID = "admin-uid";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "tagusheep-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });

  // Seed the admins/{uid} doc that makes ADMIN_UID an admin, bypassing rules
  // to write it directly (the rules themselves forbid client writes to
  // /admins, which is exactly what we're testing works as expected below).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "admins", ADMIN_UID), { createdAt: Date.now() });
  });
});

after(async () => {
  await testEnv.cleanup();
});

function ctxFor(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function anon() {
  return testEnv.unauthenticatedContext().firestore();
}

function validTagPayload(overrides = {}) {
  return {
    brand: "Test Brand",
    imageUrl: "https://example.com/a.png",
    createdBy: OWNER_UID,
    ...overrides,
  };
}

// --- tags ---

test("tags: public read succeeds even signed out", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "tags", "seed-1"), validTagPayload());
  });
  await assertSucceeds(getDoc(doc(anon(), "tags", "seed-1")));
});

test("tags: signed-in create with a valid payload succeeds", async () => {
  await assertSucceeds(addDoc(collection(ctxFor(OWNER_UID), "tags"), validTagPayload()));
});

test("tags: unauthenticated create is rejected", async () => {
  await assertFails(addDoc(collection(anon(), "tags"), validTagPayload({ createdBy: "someone" })));
});

test("tags: create with a createdBy that doesn't match the caller is rejected", async () => {
  await assertFails(addDoc(collection(ctxFor(OWNER_UID), "tags"), validTagPayload({ createdBy: OTHER_UID })));
});

test("tags: create with an unknown field is rejected", async () => {
  await assertFails(
    addDoc(collection(ctxFor(OWNER_UID), "tags"), validTagPayload({ importStatus: "needs_review" }))
  );
});

test("tags: create with more than 25 tags is rejected", async () => {
  await assertFails(
    addDoc(
      collection(ctxFor(OWNER_UID), "tags"),
      validTagPayload({ tags: Array.from({ length: 26 }, (_, i) => `tag${i}`) })
    )
  );
});

test("tags: create missing imageUrl is rejected", async () => {
  await assertFails(addDoc(collection(ctxFor(OWNER_UID), "tags"), { brand: "Test", createdBy: OWNER_UID }));
});

test("tags: owner can update their own record even with a pre-validation shape", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload());
    id = ref.id;
  });
  await assertSucceeds(updateDoc(doc(ctxFor(OWNER_UID), "tags", id), { rn: "999999" }));
});

test("tags: non-owner, non-admin cannot update someone else's record", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload());
    id = ref.id;
  });
  await assertFails(updateDoc(doc(ctxFor(OTHER_UID), "tags", id), { rn: "111111" }));
});

test("tags: admin can update someone else's record", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload());
    id = ref.id;
  });
  await assertSucceeds(updateDoc(doc(ctxFor(ADMIN_UID), "tags", id), { rn: "222222" }));
});

test("tags: update cannot change createdBy", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload());
    id = ref.id;
  });
  await assertFails(updateDoc(doc(ctxFor(OWNER_UID), "tags", id), { createdBy: OTHER_UID }));
});

// --- trash ---

test("trash: admin-only read", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "trash", "t1"), { brand: "X" });
  });
  await assertFails(getDocs(collection(ctxFor(OWNER_UID), "trash")));
  await assertSucceeds(getDocs(collection(ctxFor(ADMIN_UID), "trash")));
});

test("trash: non-admin cannot create", async () => {
  await assertFails(setDoc(doc(ctxFor(OWNER_UID), "trash", "t2"), { brand: "X" }));
});

// --- search_misses ---

function validSearchMiss() {
  return {
    query: "nike 1234",
    normalizedQuery: "nike 1234",
    count: 1,
    firstSearchedAt: serverTimestamp(),
    lastSearchedAt: serverTimestamp(),
  };
}

test("search_misses: signed-in create succeeds", async () => {
  await assertSucceeds(setDoc(doc(ctxFor(OWNER_UID), "search_misses", "nike-1234"), validSearchMiss()));
});

test("search_misses: unauthenticated create is rejected", async () => {
  await assertFails(setDoc(doc(anon(), "search_misses", "nike-1234"), validSearchMiss()));
});

test("search_misses: non-admin cannot read", async () => {
  await assertFails(getDocs(collection(ctxFor(OWNER_UID), "search_misses")));
});

// --- imports_review ---

test("imports_review: owner can read their own submission", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "imports_review"), { brand: "X", createdBy: OWNER_UID });
    id = ref.id;
  });
  await assertSucceeds(getDoc(doc(ctxFor(OWNER_UID), "imports_review", id)));
});

test("imports_review: a different signed-in user cannot read someone else's submission", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "imports_review"), { brand: "X", createdBy: OWNER_UID });
    id = ref.id;
  });
  await assertFails(getDoc(doc(ctxFor(OTHER_UID), "imports_review", id)));
});

test("imports_review: admin can read any submission", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "imports_review"), { brand: "X", createdBy: OWNER_UID });
    id = ref.id;
  });
  await assertSucceeds(getDoc(doc(ctxFor(ADMIN_UID), "imports_review", id)));
});

// --- admins ---

test("admins: signed-in user can read", async () => {
  await assertSucceeds(getDoc(doc(ctxFor(OWNER_UID), "admins", ADMIN_UID)));
});

test("admins: signed-out user cannot read", async () => {
  await assertFails(getDoc(doc(anon(), "admins", ADMIN_UID)));
});

test("admins: no client, not even an admin, can write", async () => {
  await assertFails(setDoc(doc(ctxFor(ADMIN_UID), "admins", OTHER_UID), { createdAt: Date.now() }));
});

// --- submissions ---

test("submissions: signed-in create succeeds", async () => {
  await assertSucceeds(addDoc(collection(ctxFor(OWNER_UID), "submissions"), { productRef: "tag1", mode: "correction" }));
});

test("submissions: unauthenticated create is rejected", async () => {
  await assertFails(addDoc(collection(anon(), "submissions"), { productRef: "tag1" }));
});

test("submissions: only admins can read", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await addDoc(collection(ctx.firestore(), "submissions"), { productRef: "tag1" });
  });
  await assertFails(getDocs(collection(ctxFor(OWNER_UID), "submissions")));
  await assertSucceeds(getDocs(collection(ctxFor(ADMIN_UID), "submissions")));
});

test("submissions: owner (non-admin) cannot delete their own submission", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "submissions"), { productRef: "tag1" });
    id = ref.id;
  });
  await assertFails(deleteDoc(doc(ctxFor(OWNER_UID), "submissions", id)));
});
