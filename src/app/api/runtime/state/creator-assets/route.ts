import { NextResponse } from "next/server";
import {
  listCreatorAssetStoreSnapshot,
  upsertCreatorAssetInStore,
  writeCreatorAssetsToStore,
} from "@/lib/server/creator-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { creatorAssets, tombstones } = await listCreatorAssetStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { creatorAssets, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creator assets.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for creator assets. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ creatorAssets?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const creatorAssets = await writeCreatorAssetsToStore(body?.creatorAssets ?? []);
    return NextResponse.json(
      { ok: true, data: { creatorAssets } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist creator assets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ creatorAsset?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const { creatorAsset, tombstone, accepted } = await upsertCreatorAssetInStore(
      body?.creatorAsset ?? null,
    );
    if (!creatorAsset && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid creator asset payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { creatorAsset, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist creator asset.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
