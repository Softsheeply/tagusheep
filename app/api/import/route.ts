import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "URL import is disabled. Use Capture with your own photos." }, { status: 410 });
}
