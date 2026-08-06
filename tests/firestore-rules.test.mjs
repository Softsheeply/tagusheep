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

// Guards scripts/import-secondhand-dataset.mjs: it writes a much wider
// document than the upload form does (archive source fields, OCR-recovered
// identifiers, storage paths), and a single non-allowlisted key or an
// over-length value would reject every write in the run.
test("tags: the dataset importer's full payload shape is accepted", async () => {
  await assertSucceeds(
    addDoc(collection(ctxFor(OWNER_UID), "tags"), {
      imageUrl: "https://example.com/label.jpg",
      thumbnailUrl: "https://example.com/label.jpg",
      storagePath: `tagusheep/imports/${OWNER_UID}/1700000000_label_item.jpg`,
      extraImageUrls: ["https://example.com/front.jpg", "https://example.com/back.jpg"],
      brand: "Acme Denim",
      garmentType: "Jeans",
      color: "Blue",
      size: "M",
      materials: "Cotton",
      rn: "6617012", // 7 chars exactly -- the rules cap
      styleNumber: "ABC-1234",
      madeIn: "USA",
      notes: "Imported from the Clothing Dataset for Second-Hand Fashion, licensed CC-BY 4.0.",
      sourceType: "archive",
      sourceName: "Clothing Dataset for Second-Hand Fashion (CC-BY 4.0)",
      sourceUrl: "https://zenodo.org/records/13788681",
      verificationStatus: "pending",
      searchText: "acme denim 6617012 abc-1234 jeans blue cotton usa",
      createdBy: OWNER_UID,
      importedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    })
  );
});

test("tags: an 8-digit rn is rejected (importer must clamp to 7)", async () => {
  await assertFails(
    addDoc(collection(ctxFor(OWNER_UID), "tags"), validTagPayload({ rn: "12345678" }))
  );
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

// A self-submitter shouldn't be able to grant their own tag the "Tagsheep
// Verified" badge -- reviewed/verified/rejected are admin judgement calls.
test("tags: owner cannot create a tag pre-marked verified", async () => {
  await assertFails(
    addDoc(collection(ctxFor(OWNER_UID), "tags"), validTagPayload({ verificationStatus: "verified" }))
  );
});

test("tags: admin can create a tag pre-marked verified", async () => {
  await assertSucceeds(
    addDoc(collection(ctxFor(ADMIN_UID), "tags"), validTagPayload({ createdBy: ADMIN_UID, verificationStatus: "verified" }))
  );
});

test("tags: owner cannot update their own record to verified", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload({ verificationStatus: "pending" }));
    id = ref.id;
  });
  await assertFails(updateDoc(doc(ctxFor(OWNER_UID), "tags", id), { verificationStatus: "verified" }));
});

test("tags: owner can move their own record between draft/needs_info/pending", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload({ verificationStatus: "pending" }));
    id = ref.id;
  });
  await assertSucceeds(updateDoc(doc(ctxFor(OWNER_UID), "tags", id), { verificationStatus: "needs_info" }));
});

test("tags: owner editing other fields on an already-verified record doesn't need to touch verificationStatus down", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload({ verificationStatus: "verified" }));
    id = ref.id;
  });
  // Resubmitting the unchanged elevated status alongside an unrelated field
  // edit must still succeed -- only escalating *to* verified is blocked.
  await assertSucceeds(updateDoc(doc(ctxFor(OWNER_UID), "tags", id), { color: "Navy", verificationStatus: "verified" }));
});

test("tags: admin can update someone else's record to verified", async () => {
  let id;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(collection(ctx.firestore(), "tags"), validTagPayload({ verificationStatus: "pending" }));
    id = ref.id;
  });
  await assertSucceeds(updateDoc(doc(ctxFor(ADMIN_UID), "tags", id), { verificationStatus: "verified" }));
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

// --- favorites ---

function validFavoritePayload(tagId = "tag-fav-1") {
  return {
    tagId,
    brand: "Saved Brand",
    productName: null,
    rn: "12345",
    styleNumber: "ABC",
    imageUrl: "https://example.com/a.png",
    thumbnailUrl: null,
  };
}

test("favorites: owner can create and read their favorite", async () => {
  await assertSucceeds(setDoc(doc(ctxFor(OWNER_UID), "users", OWNER_UID, "favorites", "tag-fav-1"), validFavoritePayload()));
  await assertSucceeds(getDoc(doc(ctxFor(OWNER_UID), "users", OWNER_UID, "favorites", "tag-fav-1")));
});

test("favorites: another user cannot read someone else's favorites", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", OWNER_UID, "favorites", "tag-fav-2"), validFavoritePayload("tag-fav-2"));
  });
  await assertFails(getDoc(doc(ctxFor(OTHER_UID), "users", OWNER_UID, "favorites", "tag-fav-2")));
});

test("favorites: signed-out cannot write", async () => {
  await assertFails(setDoc(doc(anon(), "users", OWNER_UID, "favorites", "tag-fav-3"), validFavoritePayload("tag-fav-3")));
});

test("favorites: owner can delete their favorite", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", OWNER_UID, "favorites", "tag-fav-4"), validFavoritePayload("tag-fav-4"));
  });
  await assertSucceeds(deleteDoc(doc(ctxFor(OWNER_UID), "users", OWNER_UID, "favorites", "tag-fav-4")));
});

test("favorites: tagId must match document id", async () => {
  await assertFails(
    setDoc(doc(ctxFor(OWNER_UID), "users", OWNER_UID, "favorites", "tag-fav-5"), validFavoritePayload("mismatched-id"))
  );
});
