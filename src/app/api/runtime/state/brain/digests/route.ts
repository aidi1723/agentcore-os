import { NextResponse } from "next/server";
import {
  listBrainDigestStoreSnapshot,
  upsertBrainDigestInStore,
  writeBrainDigestsToStore,
} from "@/lib/server/brain-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { digests, tombstones } = await listBrainDigestStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { digests, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load brain digests.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for brain digests. Use item-level POST sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ digests?: unknown }>(req, STATE_BODY_LIMIT);
    const digests = await writeBrainDigestsToStore(body?.digests ?? []);
    return NextResponse.json(
      { ok: true, data: { digests } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist brain digests.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ digest?: unknown }>(req, STATE_BODY_LIMIT);
    const { digest, tombstone, accepted } = await upsertBrainDigestInStore(body?.digest ?? null);
    if (!digest && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid brain digest payload." },
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
    const message = error instanceof Error ? error.message : "Unable to persist brain digest.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
