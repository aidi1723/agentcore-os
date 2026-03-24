import { NextResponse } from "next/server";
import {
  listSupportTicketStoreSnapshot,
  upsertSupportTicketInStore,
  writeSupportTicketsToStore,
} from "@/lib/server/support-ticket-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const STATE_BODY_LIMIT = 1_000_000;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export async function GET() {
  try {
    const { tickets, tombstones } = await listSupportTicketStoreSnapshot();
    return NextResponse.json(
      { ok: true, data: { tickets, tombstones } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load support tickets.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Full snapshot overwrite is disabled for support tickets. Use item-level POST/DELETE sync instead.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body = await readJsonBodyWithLimit<{ tickets?: unknown }>(req, STATE_BODY_LIMIT);
    const tickets = await writeSupportTicketsToStore(body?.tickets ?? []);
    return NextResponse.json(
      { ok: true, data: { tickets } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist support tickets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<{ ticket?: unknown }>(req, STATE_BODY_LIMIT);
    const { ticket, tombstone, accepted } = await upsertSupportTicketInStore(
      body?.ticket ?? null,
    );
    if (!ticket && !tombstone) {
      return NextResponse.json(
        { ok: false, error: "Invalid support ticket payload." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: true, data: { ticket, tombstone, accepted } },
      {
        status: accepted ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to persist support ticket.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
