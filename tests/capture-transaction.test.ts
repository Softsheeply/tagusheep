import test from "node:test";
import assert from "node:assert/strict";
import { runCaptureTransaction } from "../lib/capture-transaction.ts";

test("several garment photos all upload and create exactly one record", async () => {
  const uploaded: string[] = [];
  let recordWrites = 0;
  const id = await runCaptureTransaction({
    files: ["full", "brand", "style", "care", "detail"],
    upload: async (file) => { uploaded.push(file); return `r2:${file}`; },
    persist: async (images) => { recordWrites += 1; assert.equal(images.length, 5); return "record-1"; },
    rollback: async () => {},
  });
  assert.equal(id, "record-1");
  assert.deepEqual(uploaded, ["full", "brand", "style", "care", "detail"]);
  assert.equal(recordWrites, 1);
});

test("storage failure creates no record and rolls back prior images", async () => {
  const rolledBack: string[] = [];
  let recordWrites = 0;
  await assert.rejects(runCaptureTransaction({
    files: ["full", "brand", "care"],
    upload: async (file) => {
      if (file === "care") throw new Error("R2 unavailable");
      return file;
    },
    persist: async () => { recordWrites += 1; },
    rollback: async (file) => { rolledBack.push(file); },
  }), /R2 unavailable/);
  assert.equal(recordWrites, 0);
  assert.deepEqual(rolledBack, ["brand", "full"]);
});

test("Firestore failure rolls back every uploaded image and creates no partial result", async () => {
  const rolledBack: string[] = [];
  let recordAttempts = 0;
  await assert.rejects(runCaptureTransaction({
    files: ["full", "tag", "detail"],
    upload: async (file) => file,
    persist: async () => { recordAttempts += 1; throw new Error("Firestore unavailable"); },
    rollback: async (file) => { rolledBack.push(file); },
  }), /Firestore unavailable/);
  assert.equal(recordAttempts, 1);
  assert.deepEqual(rolledBack, ["detail", "tag", "full"]);
});
