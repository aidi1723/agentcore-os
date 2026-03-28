"use client";

import { useEffect, useState } from "react";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import type { HeroWorkflowFamily } from "@/lib/hero-workflow-recommendation";
import type { RecommendationResult } from "@/lib/recommendation-contract";

type RecommendationPayload = {
  ok?: boolean;
  data?: {
    recommendation?: RecommendationResult | null;
  };
};

export function useRuntimeHeroRecommendation(params: {
  family: HeroWorkflowFamily;
  workflowRunId?: string;
  source?: string;
  nextStep?: string;
  fallback: RecommendationResult;
}) {
  const { family, workflowRunId, source, nextStep, fallback } = params;
  const [serverRecommendation, setServerRecommendation] = useState<RecommendationResult | null>(null);

  useEffect(() => {
    setServerRecommendation(null);

    if (!workflowRunId) return;

    const controller = new AbortController();

    void fetch(buildAgentCoreApiUrl("/api/runtime/recommendations/hero-workflow"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        family,
        workflowRunId,
        source,
        nextStep,
      }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as RecommendationPayload;
        return payload?.ok ? payload.data?.recommendation ?? null : null;
      })
      .then((recommendation) => {
        if (!controller.signal.aborted) {
          setServerRecommendation(recommendation);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setServerRecommendation(null);
        }
      });

    return () => {
      controller.abort();
    };
  }, [family, nextStep, source, workflowRunId]);

  return serverRecommendation ?? fallback;
}
