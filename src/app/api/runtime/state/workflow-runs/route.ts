import { NextResponse } from "next/server";
import {
  listWorkflowRunStoreSnapshot,
  upsertWorkflowRunInStore,
  writeWorkflowRunsToStore,
} from "@/lib/server/workflow-run-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { workflowRuns, tombstones } = await listWorkflowRunStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { workflowRuns, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load workflow runs.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for workflow runs. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ workflowRuns?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const workflowRuns = await writeWorkflowRunsToStore(body?.workflowRuns ?? []);
    return NextResponse.json(
      { ok: true, data: { workflowRuns } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist workflow runs.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ workflowRun?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const { workflowRun, tombstone, accepted } = await upsertWorkflowRunInStore(
      body?.workflowRun ?? null,
    );
    if (!workflowRun && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid workflow run payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { workflowRun, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist workflow run.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
