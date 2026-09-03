import test from "node:test";
import assert from "node:assert/strict";
import { extractFreeCapture, suggestPhotoRoles } from "../lib/free-capture.ts";

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

test("free OCR mode finds brand on RN/style photos when brand-label role is wrong", () => {
  // Matches the common phone capture order: size tag, garment, brand/style tag
  // with default roles full garment / brand label / RN/style tag.
  const result = extractFreeCapture([
    { role: "full garment", rawText: "S/P/C" },
    { role: "brand label", rawText: "" },
    {
      role: "RN/style tag",
      rawText: "FOREVER 21\nSTYLE 0090-3068-0027-109200\nMADE IN CHINA",
      styleNumber: "0090-3068-0027-109200",
      madeIn: "CHINA",
    },
  ]);
  assert.equal(result.brand, "FOREVER 21");
  assert.ok((result.brandConfidence || 0) >= 0.72);
  assert.equal(result.styleNumber, "0090-3068-0027-109200");
  assert.equal(result.size, "S/P/C");
  assert.ok(result.mainImageIndex === 1, "garment photo should become main image");
});

test("suggestPhotoRoles prefers garment photo with little text as full garment", () => {
  const roles = suggestPhotoRoles([
    { role: "full garment", rawText: "S/P/C" },
    { role: "brand label", rawText: "" },
    { role: "RN/style tag", rawText: "FOREVER 21\nSTYLE 0090-3068-0027-109200", styleNumber: "0090-3068-0027-109200" },
  ]);
  assert.equal(roles[1], "full garment");
  assert.equal(roles[2], "RN/style tag");
});

test("free OCR mode captures CA as rn and keeps SN out of rn", () => {
  const result = extractFreeCapture([
    { role: "brand label", rawText: "ROOTS" },
    {
      role: "RN/style tag",
      rawText: "CA 04025\nSN RT-77821\nMADE IN CANADA",
    },
  ]);
  assert.equal(result.rn, "04025");
  assert.equal(result.styleNumber, "RT-77821");
  assert.ok(!(result.styleNumber || "").toUpperCase().includes("CA"));
  assert.deepEqual(result.detectedRns, ["04025"]);
});

test("free OCR mode does not treat STYLE CA ##### as a style number", () => {
  const result = extractFreeCapture([
    { role: "brand label", rawText: "ARITZIA" },
    { role: "RN/style tag", rawText: "STYLE\nCA 12345" },
  ]);
  assert.equal(result.rn, "12345");
  assert.equal(result.styleNumber, null);
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
