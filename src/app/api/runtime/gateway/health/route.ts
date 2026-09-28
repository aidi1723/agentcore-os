import { NextResponse } from "next/server";

import { getRuntimeDoctorReport } from "@/lib/runtime-doctor";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  const report = getRuntimeDoctorReport();
  return NextResponse.json(
    {
      ok: report.checks.clawCode.ok,
      health: {
        service: "agentcore-claw-runtime",
        mode: "claw_code",
        clawCode: report.checks.clawCode,
        readiness: report.readiness,
        nextAction: report.nextAction,
      },
      error: report.checks.clawCode.ok ? undefined : report.checks.clawCode.error,
    },
    {
      status: report.checks.clawCode.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
