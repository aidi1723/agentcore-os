import { NextResponse } from "next/server";
import {
  listDealStoreSnapshot,
  upsertDealInStore,
  writeDealsToStore,
} from "@/lib/server/deal-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { deals, tombstones } = await listDealStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { deals, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load deals.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for deals. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ deals?: unknown }>(req, STATE_BODY_LIMIT);
    const deals = await writeDealsToStore(body?.deals ?? []);
    return NextResponse.json(
      { ok: true, data: { deals } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist deals.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ deal?: unknown }>(req, STATE_BODY_LIMIT);
    const { deal, tombstone, accepted } = await upsertDealInStore(body?.deal ?? null);
    if (!deal && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid deal payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { deal, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist deal.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
