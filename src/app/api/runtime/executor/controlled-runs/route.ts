import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { listControlledExecutionRuns } from "@/lib/server/controlled-execution-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const runs = await listControlledExecutionRuns();
    return NextResponse.json(
      { ok: true, data: { runs } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load controlled runs.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
