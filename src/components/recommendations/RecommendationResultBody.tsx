"use client";

import type { ReactNode } from "react";

import { jumpToAssetTarget } from "@/lib/asset-jumps";
import type { RecommendationResult } from "@/lib/recommendation-contract";

export type RecommendationTone = "amber" | "emerald" | "blue" | "slate";

type RecommendationResultBodyProps = {
  recommendation: RecommendationResult;
  tone?: RecommendationTone;
  actionTitle?: string;
  actionButtonLabel?: string;
  actionLeading?: ReactNode;
  maxHitsPerSection?: number;
  className?: string;
};

function getToneClasses(tone: RecommendationTone) {
  switch (tone) {
    case "emerald":
      return {
        eyebrow: "text-emerald-700",
        actionCard: "border-emerald-200 bg-white/80",
        actionButton: "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100",
        sectionCard: "border-emerald-100 bg-white/85",
        hitCard: "border-emerald-100 bg-white/90",
        metadata: "border-emerald-100 bg-emerald-50 text-emerald-900/75",
        empty: "border-emerald-100 bg-white/75 text-emerald-900/60",
        openButton: "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100",
        title: "text-emerald-950",
        body: "text-emerald-950/80",
        rationale: "text-emerald-900/70",
      };
    case "blue":
      return {
        eyebrow: "text-blue-700",
        actionCard: "border-blue-200 bg-white/80",
        actionButton: "border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200",
        sectionCard: "border-blue-100 bg-white/85",
        hitCard: "border-blue-100 bg-white/80",
        metadata: "border-blue-100 bg-blue-50 text-blue-900/70",
        empty: "border-blue-100 bg-white/70 text-blue-950/60",
        openButton: "border-blue-200 bg-white text-blue-800 hover:bg-blue-100",
        title: "text-blue-950",
        body: "text-blue-950/80",
        rationale: "text-blue-900/70",
      };
    case "slate":
      return {
        eyebrow: "text-gray-400",
        actionCard: "border-gray-200 bg-gray-50",
        actionButton: "border-gray-200 bg-white text-gray-800 hover:bg-gray-100",
        sectionCard: "border-gray-200 bg-gray-50",
        hitCard: "border-gray-200 bg-white",
        metadata: "border-gray-200 bg-gray-50 text-gray-600",
        empty: "border-gray-200 bg-white text-gray-500",
        openButton: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
        title: "text-gray-900",
        body: "text-gray-700",
        rationale: "text-gray-500",
      };
    case "amber":
    default:
      return {
        eyebrow: "text-amber-700",
        actionCard: "border-amber-200 bg-white/80",
        actionButton: "border-amber-200 bg-white text-amber-800 hover:bg-amber-100",
        sectionCard: "border-amber-100 bg-white/85",
        hitCard: "border-amber-100 bg-white/90",
        metadata: "border-amber-100 bg-amber-50 text-amber-900/75",
        empty: "border-amber-100 bg-white/75 text-amber-900/60",
        openButton: "border-amber-200 bg-white text-amber-800 hover:bg-amber-100",
        title: "text-slate-950",
        body: "text-slate-700",
        rationale: "text-slate-500",
      };
  }
}

export function RecommendationResultBody({
  recommendation,
  tone = "amber",
  actionTitle = "Recommended Move",
  actionButtonLabel = "执行推荐动作",
  actionLeading,
  maxHitsPerSection,
  className = "",
}: RecommendationResultBodyProps) {
  const classes = getToneClasses(tone);

  return (
    <div className={["space-y-4", className].filter(Boolean).join(" ")}>
      <div className={["rounded-2xl border p-4", classes.actionCard].join(" ")}>
        <div className={["text-xs font-semibold uppercase tracking-[0.18em]", classes.eyebrow].join(" ")}>
          {actionTitle}
        </div>
        <div className="mt-3 flex items-start gap-3">
          {actionLeading ? <div className="mt-0.5 shrink-0">{actionLeading}</div> : null}
          <div>
            <div className={["text-sm font-semibold", classes.title].join(" ")}>
              {recommendation.recommendedAction.label}
            </div>
            <div className={["mt-1 text-sm leading-6", classes.body].join(" ")}>
              {recommendation.recommendedAction.rationale}
            </div>
          </div>
        </div>
        {recommendation.recommendedAction.jumpTarget ? (
          <button
            type="button"
            onClick={() => jumpToAssetTarget(recommendation.recommendedAction.jumpTarget)}
            className={["mt-3 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors", classes.actionButton].join(" ")}
          >
            {actionButtonLabel}
          </button>
        ) : null}
      </div>

      {recommendation.sections.map((section) => {
        const hits = typeof maxHitsPerSection === "number" ? section.hits.slice(0, Math.max(0, maxHitsPerSection)) : section.hits;
        return (
          <div key={section.id} className={["rounded-2xl border p-3", classes.sectionCard].join(" ")}>
            <div className={["text-[11px] font-semibold uppercase tracking-[0.16em]", classes.eyebrow].join(" ")}>
              {section.label}
            </div>
            {hits.length === 0 ? (
              <div className={["mt-2 rounded-xl border px-3 py-3 text-xs leading-5", classes.empty].join(" ")}>
                当前暂无命中。
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {hits.map((item) => (
                  <div key={`${section.id}-${item.id}`} className={["rounded-xl border px-3 py-3", classes.hitCard].join(" ")}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className={["text-sm font-semibold", classes.title].join(" ")}>
                          {item.title}
                        </div>
                        <div className={["mt-1 text-sm leading-6", classes.body].join(" ")}>
                          {item.summary}
                        </div>
                        <div className={["mt-2 text-xs", classes.rationale].join(" ")}>
                          {item.rationale}
                        </div>
                        {item.metadata.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {item.metadata.map((meta) => (
                              <span key={`${item.id}-${meta}`} className={["rounded-full border px-2.5 py-1", classes.metadata].join(" ")}>
                                {meta}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {item.jumpTarget ? (
                        <button
                          type="button"
                          onClick={() => jumpToAssetTarget(item.jumpTarget)}
                          className={["shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors", classes.openButton].join(" ")}
                        >
                          打开
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
