import { NextResponse } from "next/server";
import {
  listSalesAssetStoreSnapshot,
  upsertSalesAssetInStore,
  writeSalesAssetsToStore,
} from "@/lib/server/sales-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { salesAssets, tombstones } = await listSalesAssetStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { salesAssets, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load sales assets.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for sales assets. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ salesAssets?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const salesAssets = await writeSalesAssetsToStore(body?.salesAssets ?? []);
    return NextResponse.json(
      { ok: true, data: { salesAssets } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist sales assets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ salesAsset?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const { salesAsset, tombstone, accepted } = await upsertSalesAssetInStore(
      body?.salesAsset ?? null,
    );
    if (!salesAsset && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid sales asset payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { salesAsset, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist sales asset.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
