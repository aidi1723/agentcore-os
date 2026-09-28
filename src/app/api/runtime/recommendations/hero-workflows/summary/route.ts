import { NextResponse } from "next/server";

import { buildRuntimeHeroWorkflowRecommendationSummary } from "@/lib/server/hero-workflow-recommendation";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  try {
    const summary = await buildRuntimeHeroWorkflowRecommendationSummary();
    return NextResponse.json(
      {
        ok: true,
        data: {
          summary,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load hero workflow recommendation summary.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
