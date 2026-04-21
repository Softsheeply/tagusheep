import { NextRequest, NextResponse } from "next/server";
import { extractRecordFromHtml } from "@/lib/scrape";

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

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TaguSheepBot/1.0; +https://tagusheep.example)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream returned ${response.status}` }, { status: 502 });
    }

    const html = await response.text();
    const record = extractRecordFromHtml(parsed.toString(), html);
    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Import failed" }, { status: 500 });
  }
}
