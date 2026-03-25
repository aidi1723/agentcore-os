import { NextResponse } from "next/server";
import { getTaskboardSummary } from "@/lib/taskboardSummary";

export const runtime = "nodejs";

export async function GET() {
  try {
    const s = await getTaskboardSummary();
    return NextResponse.json(s);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
