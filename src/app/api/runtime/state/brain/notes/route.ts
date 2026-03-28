import { NextResponse } from "next/server";
import {
  listBrainNoteStoreSnapshot,
  upsertBrainNoteInStore,
  writeBrainNotesToStore,
} from "@/lib/server/brain-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { notes, tombstones } = await listBrainNoteStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { notes, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load brain notes.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for brain notes. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ notes?: unknown }>(req, STATE_BODY_LIMIT);
    const notes = await writeBrainNotesToStore(body?.notes ?? []);
    return NextResponse.json(
      { ok: true, data: { notes } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist brain notes.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ note?: unknown }>(req, STATE_BODY_LIMIT);
    const { note, tombstone, accepted } = await upsertBrainNoteInStore(body?.note ?? null);
    if (!note && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid brain note payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { note, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist brain note.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
