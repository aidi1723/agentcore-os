import { NextResponse } from "next/server";
import {
  listDraftStoreSnapshot,
  upsertDraftInStore,
  writeDraftsToStore,
} from "@/lib/server/draft-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { drafts, tombstones } = await listDraftStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { drafts, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load drafts.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for drafts. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ drafts?: unknown }>(req, STATE_BODY_LIMIT);
    const drafts = await writeDraftsToStore(body?.drafts ?? []);
    return NextResponse.json(
      { ok: true, data: { drafts } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist drafts.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ draft?: unknown }>(req, STATE_BODY_LIMIT);
    const { draft, tombstone, accepted } = await upsertDraftInStore(body?.draft ?? null);
    if (!draft && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid draft payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { draft, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist draft.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
