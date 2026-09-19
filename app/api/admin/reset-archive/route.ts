import { NextResponse } from "next/server";
import { deleteAllTagDocuments, listAllTagDocuments } from "@/lib/firestore-rest";
import { isFirebaseAdmin, verifyFirebaseBearer } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await verifyFirebaseBearer(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!(await isFirebaseAdmin(user.uid, user.idToken))) {
    return NextResponse.json({ error: "Access denied. TagSheep admin access is required." }, { status: 403 });
  }

  try {
    const backup = await listAllTagDocuments(user.idToken);
    const deleted = await deleteAllTagDocuments(user.idToken);
    return NextResponse.json({
      deleted,
      backupCount: backup.length,
      backupFilename: `tagsheep-backup-${new Date().toISOString().slice(0, 10)}.json`,
      backup,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reset failed." }, { status: 502 });
  }
}
