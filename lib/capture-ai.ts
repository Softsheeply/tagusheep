import "server-only";

import type { CaptureFields } from "@/lib/capture-policy";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["brand", "productName", "rn", "styleNumber", "size", "color", "category", "subCategory", "garmentType", "gender", "materials", "careText", "madeIn", "notes", "tags", "confidence", "brandConfidence", "detectedBrands", "detectedRns", "detectedStyleNumbers", "mainImageIndex"],
  properties: {
    brand: { type: ["string", "null"] },
    productName: { type: ["string", "null"] },
    rn: { type: ["string", "null"] },
    styleNumber: { type: ["string", "null"] },
    size: { type: ["string", "null"] },
    color: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    subCategory: { type: ["string", "null"] },
    garmentType: { type: ["string", "null"] },
    gender: { type: ["string", "null"] },
    materials: { type: ["string", "null"] },
    careText: { type: ["string", "null"] },
    madeIn: { type: ["string", "null"] },
    notes: { type: ["string", "null"], description: "Only visible design details, such as pattern, cut, closures, graphics, wash, and trim." },
    tags: { type: "array", items: { type: "string" }, maxItems: 25 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    brandConfidence: { type: "number", minimum: 0, maximum: 1 },
    detectedBrands: { type: "array", items: { type: "string" } },
    detectedRns: { type: "array", items: { type: "string" } },
    detectedStyleNumbers: { type: "array", items: { type: "string" } },
    mainImageIndex: { type: ["integer", "null"], minimum: 0 },
  },
} as const;

function outputText(payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

export async function analyzeGarmentImages(files: File[], ocrText: string[]): Promise<CaptureFields> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI analysis is not configured. Set OPENAI_API_KEY on the server.");

  const imageContent = await Promise.all(files.map(async (file) => ({
    type: "input_image" as const,
    detail: "high" as const,
    image_url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
  })));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_CAPTURE_MODEL?.trim() || "gpt-5-mini",
      instructions: "You extract conservative clothing records for TagSheep. Treat every image as one garment. Use visible evidence and supplied OCR only. Never guess or invent a missing field. Return null for unsupported fields. Preserve identifiers exactly except harmless whitespace. List every conflicting brand, RN, or style value detected. Pick the full-garment photo as mainImageIndex when one exists; otherwise choose the clearest useful photo. productName must be a concise searchable garment title, not marketing copy. notes contains only visible design details.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `OCR by image (may contain errors):\n${ocrText.map((text, index) => `Image ${index + 1}: ${text || "[none]"}`).join("\n\n")}` },
          ...imageContent,
        ],
      }],
      text: { format: { type: "json_schema", name: "tagsheep_garment", strict: true, schema } },
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `AI analysis failed (${response.status}).`);
  const text = outputText(payload || {});
  if (!text) throw new Error("AI analysis returned no garment data.");
  return JSON.parse(text) as CaptureFields;
}
