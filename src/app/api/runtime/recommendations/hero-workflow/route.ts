import { NextResponse } from "next/server";

import type { HeroWorkflowFamily } from "@/lib/hero-workflow-recommendation";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";
import { buildRuntimeHeroWorkflowRecommendation } from "@/lib/server/hero-workflow-recommendation";

export const runtime = "nodejs";

const BODY_LIMIT = 32_000;

type HeroWorkflowRecommendationBody = {
  family?: HeroWorkflowFamily;
  workflowRunId?: string;
  source?: string;
  nextStep?: string;
};

function normalizeBody(body: HeroWorkflowRecommendationBody | null) {
  return {
    family:
      body?.family === "sales" ||
      body?.family === "creator" ||
      body?.family === "support" ||
      body?.family === "research"
        ? body.family
        : null,
    workflowRunId:
      typeof body?.workflowRunId === "string" && body.workflowRunId.trim()
        ? body.workflowRunId.trim()
        : null,
    source: typeof body?.source === "string" ? body.source : undefined,
    nextStep: typeof body?.nextStep === "string" ? body.nextStep : undefined,
  };
}

export async function POST(req: Request) {
  try {
    const body = normalizeBody(
      await readJsonBodyWithLimit<HeroWorkflowRecommendationBody>(req, BODY_LIMIT),
    );

    if (!body.family) {
      return NextResponse.json(
        { ok: false, error: "Valid hero workflow family is required." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const family = body.family;
    const result = await buildRuntimeHeroWorkflowRecommendation({
      family,
      workflowRunId: body.workflowRunId,
      source: body.source,
      nextStep: body.nextStep,
    });
    return NextResponse.json(
      {
        ok: true,
        data: {
          family: result.family,
          workflowRunId: result.workflowRunId,
          recommendation: result.recommendation,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to build hero workflow recommendation.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
