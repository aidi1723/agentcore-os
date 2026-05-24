import { NextResponse } from "next/server";

import { listRelevantExecutorInstincts } from "@/lib/server/executor-instinct-store";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? "";
    const profileId = url.searchParams.get("profileId") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "5");
    const instincts = await listRelevantExecutorInstincts({ scope, profileId, limit });
    return NextResponse.json(
      { ok: true, data: { instincts } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load executor instincts.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
