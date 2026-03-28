"use client";

import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import type { RecommendationResult } from "@/lib/recommendation-contract";

type HeroWorkflowRecommendationCardProps = {
  recommendation: RecommendationResult;
  tone?: "amber" | "emerald";
};

function getToneClasses(tone: HeroWorkflowRecommendationCardProps["tone"]) {
  if (tone === "emerald") {
    return {
      shell: "border-emerald-200 bg-emerald-50/70",
      eyebrow: "text-emerald-700",
      actionButton: "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100",
      sectionCard: "border-emerald-100 bg-white/85",
      metadata: "border-emerald-100 bg-emerald-50 text-emerald-900/75",
      openButton: "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100",
      empty: "border-emerald-100 bg-white/75 text-emerald-900/60",
    };
  }
  return {
    shell: "border-amber-200 bg-amber-50/60",
    eyebrow: "text-amber-700",
    actionButton: "border-amber-200 bg-white text-amber-800 hover:bg-amber-100",
    sectionCard: "border-amber-100 bg-white/85",
    metadata: "border-amber-100 bg-amber-50 text-amber-900/75",
    openButton: "border-amber-200 bg-white text-amber-800 hover:bg-amber-100",
    empty: "border-amber-100 bg-white/75 text-amber-900/60",
  };
}

export function HeroWorkflowRecommendationCard({
  recommendation,
  tone = "amber",
}: HeroWorkflowRecommendationCardProps) {
  return (
    <div className={["mt-4 rounded-[24px] border p-4", getToneClasses(tone).shell].join(" ")}>
      <RecommendationResultBody recommendation={recommendation} tone={tone} />
    </div>
  );
}
