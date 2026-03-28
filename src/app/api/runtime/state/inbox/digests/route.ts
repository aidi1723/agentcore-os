import { NextResponse } from "next/server";
import {
  listInboxDigestStoreSnapshot,
  upsertInboxDigestInStore,
  writeInboxDigestsToStore,
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
    const { digests, tombstones } = await listInboxDigestStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { digests, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load inbox digests.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for inbox digests. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ digests?: unknown }>(req, STATE_BODY_LIMIT);
    const digests = await writeInboxDigestsToStore(body?.digests ?? []);
    return NextResponse.json(
      { ok: true, data: { digests } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist inbox digests.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ digest?: unknown }>(req, STATE_BODY_LIMIT);
    const { digest, tombstone, accepted } = await upsertInboxDigestInStore(body?.digest ?? null);
    if (!digest && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid inbox digest payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { digest, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist inbox digest.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
