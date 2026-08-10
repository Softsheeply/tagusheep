import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCapture, shouldInstantUpload, titleSimilarity } from "../lib/capture-policy.ts";

const highConfidence = {
  brand: "Levi's",
  brandConfidence: 0.98,
  styleNumber: "PC9-12345",
  productName: "501 Original Jeans",
  detectedBrands: ["Levi's"],
  detectedStyleNumbers: ["PC9-12345"],
};

test("high-confidence garment instant uploads", () => {
  assert.equal(shouldInstantUpload(highConfidence, { usableImageCount: 4 }), true);
});

test("one garment with several photos is evaluated as one capture", () => {
  assert.deepEqual(evaluateCapture(highConfidence, { usableImageCount: 5 }), []);
});

test("stops when no usable image exists", () => {
  assert.ok(evaluateCapture(highConfidence, { usableImageCount: 0 }).includes("no_usable_image"));
});

test("stops for low brand confidence", () => {
  assert.ok(evaluateCapture({ ...highConfidence, brandConfidence: 0.4 }, { usableImageCount: 2 }).includes("low_brand_confidence"));
});

test("stops when brand is missing", () => {
  assert.ok(evaluateCapture({ productName: "Blue wool cardigan", brandConfidence: 0 }, { usableImageCount: 2 }).includes("missing_brand"));
});

test("stops for conflicting brands", () => {
  const reasons = evaluateCapture({ ...highConfidence, detectedBrands: ["Nike", "Adidas"] }, { usableImageCount: 2 });
  assert.ok(reasons.includes("conflicting_brands"));
});

test("stops for conflicting style or RN values", () => {
  const reasons = evaluateCapture({ ...highConfidence, detectedRns: ["12345", "67890"] }, { usableImageCount: 2 });
  assert.ok(reasons.includes("conflicting_identifiers"));
});

test("stops without identifier or useful description", () => {
  const reasons = evaluateCapture({ brand: "Acme", brandConfidence: 0.99 }, { usableImageCount: 1 });
  assert.ok(reasons.includes("missing_identifier_or_description"));
});

test("a useful product description can replace an identifier", () => {
  assert.equal(shouldInstantUpload({ brand: "Acme", brandConfidence: 0.99, productName: "Blue wool cable-knit cardigan" }, { usableImageCount: 1 }), true);
});

test("stops for a probable duplicate", () => {
  assert.ok(evaluateCapture(highConfidence, { usableImageCount: 2, duplicateCount: 1 }).includes("duplicate"));
});

test("similar title score recognizes strong matches", () => {
  assert.ok(titleSimilarity("Levi's 501 Original Blue Jeans", "Levis 501 Original Jeans Blue") >= 0.8);
});
