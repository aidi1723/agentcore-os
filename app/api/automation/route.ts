import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: unknown; automationId?: unknown };
    return NextResponse.json(
      {
        ok: false,
        error: "Automation execution is not implemented yet. This endpoint is mock-only for now.",
        action: typeof body?.action === "string" ? body.action : null,
        automationId: typeof body?.automationId === "string" ? body.automationId : null,
      },
      { status: 501 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Automation execution is not implemented yet. Send a JSON body once the contract is defined.",
      },
      { status: 501 },
    );
  }
}
