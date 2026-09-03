import test from "node:test";
import assert from "node:assert/strict";
import {
  extractMakerRegistrationNumbers,
  extractRn,
  extractStyleNumber,
  isMakerRegistrationNumber,
  makerIdKind,
} from "../lib/tag-text-extract.mjs";

test("extractRn still captures labeled US RN values", () => {
  assert.equal(extractRn("RN 66170\nMADE IN USA"), "66170");
  assert.equal(extractRn("RN#123456"), "123456");
});

test("extractRn captures Canadian CA dealer numbers into the rn field", () => {
  assert.equal(extractRn("CA 04025\n100% COTTON"), "04025");
  assert.equal(extractRn("CA#12345"), "12345");
  assert.equal(extractRn("Dealer No. CA 98765"), "98765");
});

test("extractRn prefers RN when both RN and CA appear", () => {
  assert.equal(extractRn("RN 66170\nCA 04025"), "66170");
});

test("extractMakerRegistrationNumbers returns both RN and CA digits", () => {
  assert.deepEqual(extractMakerRegistrationNumbers("RN 66170\nCA 04025\nSN ABC-123"), ["66170", "04025"]);
});

test("extractStyleNumber reads SN / S/N without treating CA as style", () => {
  assert.equal(extractStyleNumber("SN ABC-1234"), "ABC-1234");
  assert.equal(extractStyleNumber("S/N 0090-3068"), "0090-3068");
  assert.equal(extractStyleNumber("STYLE CA 04025"), null);
  assert.equal(extractStyleNumber("Style No.\nCA 04025\nSN PC9-00501"), "PC9-00501");
  assert.equal(extractStyleNumber("CA 04025\nSTYLE 0090-3068-0027"), "0090-3068-0027");
});

test("isMakerRegistrationNumber recognizes RN/CA tokens only", () => {
  assert.equal(isMakerRegistrationNumber("CA 04025"), true);
  assert.equal(isMakerRegistrationNumber("RN66170"), true);
  assert.equal(isMakerRegistrationNumber("SN ABC-123"), false);
  assert.equal(isMakerRegistrationNumber("0090-3068"), false);
});

test("makerIdKind labels CA vs RN for upload OCR messaging", () => {
  assert.equal(makerIdKind("CA 04025\nSN RT-1", "04025"), "CA");
  assert.equal(makerIdKind("RN 66170\nCA 04025", "66170"), "RN");
  assert.equal(makerIdKind("no maker id", "12345"), null);
});
