import { NextRequest, NextResponse } from "next/server";
import { extractRecordFromHtml } from "@/lib/scrape";
import { BlockedUrlError, safeFetch } from "@/lib/safe-fetch";

const IMPORT_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 1_500_000;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

  try {
    const response = await safeFetch(parsed.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TagsheepBot/1.0; +https://tagsheep.com)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream returned ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return NextResponse.json({ error: "URL did not return HTML" }, { status: 415 });
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength && contentLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "HTML response too large" }, { status: 413 });
    }

    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "HTML response too large" }, { status: 413 });
    }

    const record = extractRecordFromHtml(response.url || parsed.toString(), html);
    return NextResponse.json(record);
  } catch (error: unknown) {
    if (error instanceof BlockedUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Import timed out" }, { status: 504 });
    }
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
