import test from "node:test";
import assert from "node:assert/strict";
import { extractFreeCapture } from "../lib/free-capture.ts";

test("free OCR mode extracts a labelled brand and identifiers without AI", () => {
  const result = extractFreeCapture([
    { role: "full garment", rawText: "" },
    { role: "brand label", rawText: "LEVI'S\nSINCE 1853" },
    { role: "RN/style tag", rawText: "RN 123456\nSTYLE PC9-00501", rn: "123456", styleNumber: "PC9-00501" },
    { role: "materials/care tag", rawText: "SIZE M\n100% COTTON\nMACHINE WASH", materials: "100% COTTON" },
  ]);
  assert.equal(result.brand, "LEVI'S");
  assert.equal(result.rn, "123456");
  assert.equal(result.styleNumber, "PC9-00501");
  assert.equal(result.size, "M");
  assert.equal(result.materials, "100% COTTON");
  assert.equal(result.mainImageIndex, 0);
  assert.ok((result.brandConfidence || 0) > 0.8);
});

test("free OCR mode exposes conflicting identifiers for review", () => {
  const result = extractFreeCapture([
    { role: "brand label", rawText: "ACME" },
    { role: "RN/style tag", rawText: "RN 111", rn: "111" },
    { role: "RN/style tag", rawText: "RN 222", rn: "222" },
  ]);
  assert.deepEqual(result.detectedRns, ["111", "222"]);
});

test("free OCR mode never invents garment details", () => {
  const result = extractFreeCapture([{ role: "brand label", rawText: "ACME" }]);
  assert.equal(result.productName, null);
  assert.equal(result.color, null);
  assert.equal(result.garmentType, null);
});
