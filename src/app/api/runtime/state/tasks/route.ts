import { NextResponse } from "next/server";
import {
  listTaskStoreSnapshot,
  upsertTaskInStore,
  writeTasksToStore,
} from "@/lib/server/task-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { tasks, tombstones } = await listTaskStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { tasks, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tasks.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for tasks. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ tasks?: unknown }>(req, STATE_BODY_LIMIT);
    const tasks = await writeTasksToStore(body?.tasks ?? []);
    return NextResponse.json(
      { ok: true, data: { tasks } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist tasks.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ task?: unknown }>(req, STATE_BODY_LIMIT);
    const { task, tombstone, accepted } = await upsertTaskInStore(body?.task ?? null);
    if (!task && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid task payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { task, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist task.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
