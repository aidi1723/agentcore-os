import { NextResponse } from "next/server";

import { buildControlledTraceArtifact } from "@/lib/executor/runtime/trace-governance";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { getControlledExecutionRun } from "@/lib/server/controlled-execution-store";

export const runtime = "nodejs";

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

  return NextResponse.json({
    ok: true,
    data: {
      artifact: buildControlledTraceArtifact(run),
    },
  });
}
