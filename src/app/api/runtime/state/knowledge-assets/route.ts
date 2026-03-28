import { NextResponse } from "next/server";
import {
  listKnowledgeAssetStoreSnapshot,
  upsertKnowledgeAssetInStore,
  writeKnowledgeAssetsToStore,
} from "@/lib/server/knowledge-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { knowledgeAssets, tombstones } = await listKnowledgeAssetStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { knowledgeAssets, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load knowledge assets.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for knowledge assets. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ knowledgeAssets?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const knowledgeAssets = await writeKnowledgeAssetsToStore(
      body?.knowledgeAssets ?? [],
    );
    return NextResponse.json(
      { ok: true, data: { knowledgeAssets } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist knowledge assets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ knowledgeAsset?: unknown }>(
      req,
      STATE_BODY_LIMIT,
    );
    const { knowledgeAsset, tombstone, accepted } =
      await upsertKnowledgeAssetInStore(body?.knowledgeAsset ?? null);
    if (!knowledgeAsset && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid knowledge asset payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { knowledgeAsset, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist knowledge asset.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
