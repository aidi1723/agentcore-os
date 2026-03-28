import { NextResponse } from "next/server";
import { removeKnowledgeAssetFromStore } from "@/lib/server/knowledge-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const DELETE_BODY_LIMIT = 8_192;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await params;
    const body = await readJsonBodyWithLimit<{ updatedAt?: number }>(req, DELETE_BODY_LIMIT);
    const result = await removeKnowledgeAssetFromStore(assetId, body?.updatedAt);
    return NextResponse.json(
      { ok: !result.conflict, data: result, error: result.conflict ? "conflict" : undefined },
      {
        status: result.conflict ? 409 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete knowledge asset.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
