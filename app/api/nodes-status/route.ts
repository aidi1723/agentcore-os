import { NextResponse } from "next/server";
import { getNodesStatusText } from "@/lib/openclawCli";

export const runtime = "nodejs";

export async function GET() {
  try {
    const out = await getNodesStatusText();
    return NextResponse.json({ ok: true, raw: out });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
