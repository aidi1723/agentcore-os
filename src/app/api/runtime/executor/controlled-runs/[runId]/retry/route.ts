import { NextResponse } from "next/server";

import { retryControlledExecutionRun } from "@/lib/executor/runtime/resume";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export async function POST(
  req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const { runId } = await context.params;
  const result = await retryControlledExecutionRun(runId);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        data: {
          runId,
          state: result.state,
          currentStepId: result.currentStepId,
        },
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      runId,
      state: result.run.state,
      retriedStepIds: result.retriedStepIds,
      run: result.run,
    },
  });
}
