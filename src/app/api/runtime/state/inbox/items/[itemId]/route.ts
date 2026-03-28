import { NextResponse } from "next/server";
import { removeInboxItemFromStore } from "@/lib/server/inbox-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const DELETE_BODY_LIMIT = 8_192;

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const body = await readJsonBodyWithLimit<{ updatedAt?: number }>(req, DELETE_BODY_LIMIT);
    const result = await removeInboxItemFromStore(itemId, body?.updatedAt);
    return NextResponse.json(
      { ok: !result.conflict, data: result, error: result.conflict ? "conflict" : undefined },
      {
        status: result.conflict ? 409 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete inbox item.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
