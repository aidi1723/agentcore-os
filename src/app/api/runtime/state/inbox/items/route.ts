import { NextResponse } from "next/server";
import {
  listInboxItemStoreSnapshot,
  upsertInboxItemInStore,
  writeInboxItemsToStore,
} from "@/lib/server/inbox-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { items, tombstones } = await listInboxItemStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { items, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load inbox items.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for inbox items. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ items?: unknown }>(req, STATE_BODY_LIMIT);
    const items = await writeInboxItemsToStore(body?.items ?? []);
    return NextResponse.json(
      { ok: true, data: { items } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist inbox items.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ item?: unknown }>(req, STATE_BODY_LIMIT);
    const { item, tombstone, accepted } = await upsertInboxItemInStore(body?.item ?? null);
    if (!item && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid inbox item payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { item, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist inbox item.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
