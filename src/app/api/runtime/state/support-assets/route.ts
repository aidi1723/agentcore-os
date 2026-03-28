import { NextResponse } from "next/server";
import {
  listSupportAssetStoreSnapshot,
  upsertSupportAssetInStore,
  writeSupportAssetsToStore,
} from "@/lib/server/support-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { supportAssets, tombstones } = await listSupportAssetStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { supportAssets, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load support assets.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for support assets. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ supportAssets?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const supportAssets = await writeSupportAssetsToStore(body?.supportAssets ?? []);
    return NextResponse.json(
      { ok: true, data: { supportAssets } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist support assets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ supportAsset?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const { supportAsset, tombstone, accepted } = await upsertSupportAssetInStore(
      body?.supportAsset ?? null,
    );
    if (!supportAsset && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid support asset payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { supportAsset, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist support asset.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
