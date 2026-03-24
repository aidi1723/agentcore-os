import { NextResponse } from "next/server";
import { removeWorkflowRunFromStore } from "@/lib/server/workflow-run-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 100_000;

export async function DELETE(
  req: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;

  try {
    const body = await readJsonBodyWithLimit<{ updatedAt?: number }>(req, STATE_BODY_LIMIT);
    const result = await removeWorkflowRunFromStore(runId, body?.updatedAt);
    if (!result.workflowRun && !result.tombstone) {
      return NextResponse.json(
        { ok: false, error: "Workflow run not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        ok: !result.conflict,
        error: result.conflict ? "conflict" : undefined,
        data: {
          workflowRun: result.workflowRun,
          tombstone: result.tombstone,
          removed: result.removed,
          conflict: result.conflict,
        },
      },
      {
        status: result.conflict ? 409 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to remove workflow run.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
