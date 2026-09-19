import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "URL image import is disabled. Use Capture with your own photos." }, { status: 410 });
}
