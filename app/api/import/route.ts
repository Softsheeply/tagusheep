import { NextRequest, NextResponse } from "next/server";
import { extractRecordFromHtml } from "@/lib/scrape";

const IMPORT_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 1_500_000;
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^::1$/i,
  /^fc/i,
  /^fd/i,
];

function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
}

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

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (isBlockedHostname(parsed.hostname)) {
    return NextResponse.json({ error: "Blocked hostname" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TagsheepBot/1.0; +https://tagsheep.com)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      redirect: "follow",
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

    const record = extractRecordFromHtml(parsed.toString(), html);
    return NextResponse.json(record);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return NextResponse.json({ error: "Import timed out" }, { status: 504 });
    }
    return NextResponse.json({ error: error?.message || "Import failed" }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
