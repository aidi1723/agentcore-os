import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { getControlledExecutionRun } from "@/lib/server/controlled-execution-store";

export async function GET(
  req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const { runId } = await context.params;
  const run = await getControlledExecutionRun(runId);
  if (!run) {
    return NextResponse.json({ ok: false, error: "Controlled run not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { run } });
}
