import { createWorker } from "tesseract.js";
import { extractMadeIn, extractMaterials, extractRn, extractStyleNumber } from "@/lib/scrape";

export type OcrSuggestions = {
  rawText: string;
  rn: string | null;
  styleNumber: string | null;
  madeIn: string | null;
  materials: string | null;
};

// Client-side OCR (no server, no per-request cost) as a best-effort assist,
// not an authoritative source -- garment tags are frequently curved,
// low-contrast, or stylized, so accuracy varies a lot. Callers should treat
// every field here as a suggestion the user reviews, never as data to save
// directly.
//
// The worker script, WASM core, and English training data are all
// self-hosted under public/tesseract (copied from tesseract.js@6.0.1,
// tesseract.js-core, and @tesseract.js-data/eng) rather than left on
// tesseract.js's jsDelivr CDN defaults -- jsDelivr is a common ad-blocker/
// privacy-extension blocklist target, which would silently break this
// feature for a meaningful share of users. Only the LSTM-engine core
// variants are included since createWorker() defaults to OEM.LSTM_ONLY.
export async function scanTagPhoto(file: File): Promise<OcrSuggestions> {
  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
  });
  try {
    const { data } = await worker.recognize(file);
    const text = data.text || "";
    return {
      rawText: text,
      rn: extractRn(text),
      styleNumber: extractStyleNumber(text),
      madeIn: extractMadeIn(text),
      materials: extractMaterials(text),
    };
  } finally {
    await worker.terminate();
  }
}
