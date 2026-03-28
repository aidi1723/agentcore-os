"use client";

import { useEffect, useState } from "react";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import type { RecommendationResult } from "@/lib/recommendation-contract";

export type HeroRecommendationFamily = "sales" | "creator" | "support" | "research";
export type HeroRecommendationPhase = "loading" | "ready" | "error";

type HeroRecommendationSummaryPayload = {
  ok?: boolean;
  data?: {
    summary?: Partial<
      Record<HeroRecommendationFamily, { recommendation?: RecommendationResult | null } | null>
    >;
  };
};

type UseRuntimeHeroWorkflowSummaryOptions = {
  enabled?: boolean;
  refreshToken?: string | number;
  unavailableMessage: string;
};

export function useRuntimeHeroWorkflowSummary({
  enabled = true,
  refreshToken,
  unavailableMessage,
}: UseRuntimeHeroWorkflowSummaryOptions) {
  const [recommendations, setRecommendations] = useState<Record<HeroRecommendationFamily, RecommendationResult | null>>({
    sales: null,
    creator: null,
    support: null,
    research: null,
  });
  const [phase, setPhase] = useState<HeroRecommendationPhase>("loading");
  const [error, setError] = useState("");
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    setPhase("loading");
    setError("");

    void fetch(buildAgentCoreApiUrl("/api/runtime/recommendations/hero-workflows/summary"), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            typeof payload?.error === "string" && payload.error.trim()
              ? payload.error
              : unavailableMessage,
          );
        }
        const payload = (await response.json()) as HeroRecommendationSummaryPayload;
        if (!payload?.ok) {
          throw new Error(unavailableMessage);
        }
        return payload.data?.summary ?? null;
      })
      .then((summary) => {
        if (controller.signal.aborted || !summary) return;
        setRecommendations({
          sales: summary.sales?.recommendation ?? null,
          creator: summary.creator?.recommendation ?? null,
          support: summary.support?.recommendation ?? null,
          research: summary.research?.recommendation ?? null,
        });
        setPhase("ready");
        setSyncedAt(Date.now());
      })
      .catch((fetchError) => {
        if (controller.signal.aborted) return;
        setPhase("error");
        setError(
          fetchError instanceof Error && fetchError.message.trim()
            ? fetchError.message
            : unavailableMessage,
        );
      });

    return () => {
      controller.abort();
    };
  }, [enabled, refreshKey, refreshToken, unavailableMessage]);

  return {
    recommendations,
    phase,
    error,
    syncedAt,
    refresh: () => setRefreshKey((value) => value + 1),
    refreshKey,
  };
}
