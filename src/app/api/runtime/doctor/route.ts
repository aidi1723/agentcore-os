import { NextResponse } from "next/server";

import { getRuntimeDoctorReport } from "@/lib/runtime-doctor";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  try {
    return NextResponse.json(
      {
        ok: true,
        report: getRuntimeDoctorReport(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to inspect local runtime.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
