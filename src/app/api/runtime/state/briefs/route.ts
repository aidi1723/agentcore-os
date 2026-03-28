import { NextResponse } from "next/server";
import {
  listBriefStoreSnapshot,
  upsertBriefInStore,
  writeBriefsToStore,
} from "@/lib/server/brief-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { briefs, tombstones } = await listBriefStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { briefs, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load briefs.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for briefs. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ briefs?: unknown }>(req, STATE_BODY_LIMIT);
    const briefs = await writeBriefsToStore(body?.briefs ?? []);
    return NextResponse.json(
      { ok: true, data: { briefs } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist briefs.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ brief?: unknown }>(req, STATE_BODY_LIMIT);
    const { brief, tombstone, accepted } = await upsertBriefInStore(body?.brief ?? null);
    if (!brief && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid brief payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { brief, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist brief.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
