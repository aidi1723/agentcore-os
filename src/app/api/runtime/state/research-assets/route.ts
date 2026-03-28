import { NextResponse } from "next/server";
import {
  listResearchAssetStoreSnapshot,
  upsertResearchAssetInStore,
  writeResearchAssetsToStore,
} from "@/lib/server/research-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { researchAssets, tombstones } = await listResearchAssetStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { researchAssets, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load research assets.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for research assets. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ researchAssets?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const researchAssets = await writeResearchAssetsToStore(body?.researchAssets ?? []);
    return NextResponse.json(
      { ok: true, data: { researchAssets } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist research assets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ researchAsset?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const { researchAsset, tombstone, accepted } = await upsertResearchAssetInStore(
      body?.researchAsset ?? null,
    );
    if (!researchAsset && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid research asset payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { researchAsset, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist research asset.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
