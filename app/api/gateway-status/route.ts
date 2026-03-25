import { NextResponse } from "next/server";
import { getGatewayStatusText } from "@/lib/openclawCli";

export const runtime = "nodejs";

export async function GET() {
  try {
    const out = await getGatewayStatusText();
    return NextResponse.json({ ok: true, raw: out });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
