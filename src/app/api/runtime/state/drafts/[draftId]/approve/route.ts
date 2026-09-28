import { NextResponse } from "next/server";

import { approveDraftInStore } from "@/lib/server/draft-store";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const { draftId } = await params;
  const result = await approveDraftInStore(draftId);
  if (!result.draft) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "草稿不存在" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!result.accepted) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "只有待复核草稿可以批准" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { ok: true, data: { draft: result.draft } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
