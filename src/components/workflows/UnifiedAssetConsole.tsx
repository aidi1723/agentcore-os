"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FolderKanban, LibraryBig, RefreshCw, Sparkles } from "lucide-react";

import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import {
  useRuntimeHeroWorkflowSummary,
  type HeroRecommendationFamily,
} from "@/components/workflows/useRuntimeHeroWorkflowSummary";
import { getDisplayLanguage } from "@/lib/app-display";
import {
  queryCreatorAssets,
  type CreatorAssetFilterId,
  type CreatorAssetSortId,
} from "@/lib/creator-asset-query";
import {
  getCreatorAssets,
  subscribeCreatorAssets,
  type CreatorAssetRecord,
} from "@/lib/creator-assets";
import type { PublishPlatformId } from "@/lib/publish";
import { getResearchAssets, subscribeResearchAssets, type ResearchAssetRecord } from "@/lib/research-assets";
import type { RecommendationResult } from "@/lib/recommendation-contract";
import { getSalesAssets, subscribeSalesAssets, type SalesAssetRecord } from "@/lib/sales-assets";
import type { InterfaceLanguage } from "@/lib/settings";
import { getSupportAssets, subscribeSupportAssets, type SupportAssetRecord } from "@/lib/support-assets";
import type { AssetJumpTarget } from "@/lib/asset-jumps";

type AssetFamily = "all" | "sales" | "creator" | "support" | "research";

type AssetConsoleMetaKey = "latestDraft" | "targets" | "publishFeedback";
type CreatorPlatformFilter = PublishPlatformId | "all";

type AssetConsoleEntry = {
  id: string;
  family: Exclude<AssetFamily, "all">;
  workflowLabel: string;
  title: string;
  detail: string;
  status: string;
  updatedAt: number;
  meta?: Array<{
    key: AssetConsoleMetaKey;
    value: string;
  }>;
  jumpTarget?: AssetJumpTarget;
};

function getCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "en") {
    return {
      eyebrow: "Asset Console",
      title: "Results should accumulate as an operating layer, not disappear as one-off tasks.",
      desc:
        "Every workflow run should leave behind reusable assets. Filter by chain, inspect what changed, and jump straight back to the exact execution node.",
      empty: "No assets yet. Run one hero workflow and the local asset layer will begin to fill.",
      open: "Open asset",
      updated: "Updated",
      filters: {
        all: "All assets",
        sales: "Sales",
        creator: "Creator",
        support: "Support",
        research: "Research",
      },
      metaLabels: {
        latestDraft: "Latest draft",
        targets: "Targets",
        publishFeedback: "Publish feedback",
      },
      creatorQuery: {
        title: "Creator retrieval slice",
        desc: "Filter creator assets by publish state and platform, then reorder by review or signal strength.",
        filters: {
          all: "All",
          in_flight: "In flight",
          successful: "Successful",
          retryable: "Retryable",
        },
        sorts: {
          updated: "Updated",
          reviewed: "Reviewed",
          success_signal: "Success signal",
          retry_priority: "Retry priority",
        },
        platforms: "Platforms",
        allPlatforms: "All platforms",
      },
      heroRecommendations: {
        title: "Hero recommendations",
        desc: "Pull the latest deterministic next move for sales, creator, support, and research from the runtime layer, then jump back into the right execution node.",
        refresh: "Refresh",
        loading: "Syncing",
        ready: "Synced",
        error: "Sync failed",
        lastSynced: "Last synced",
        empty: "The runtime layer has not returned a hero recommendation yet.",
        unavailable: "Unable to load hero recommendations right now.",
      },
    };
  }
  if (displayLanguage === "ja") {
    return {
      eyebrow: "Asset Console",
      title: "結果を単発タスクで終わらせず、運用資産として残します。",
      desc:
        "各 workflow run は再利用できる資産を残すべきです。チェーン別に絞り込み、何が更新されたかを見て、そのまま該当ノードへ戻れます。",
      empty: "まだ資産がありません。Hero Workflow を 1 回動かすとローカル資産層が埋まり始めます。",
      open: "資産を開く",
      updated: "更新",
      filters: {
        all: "すべて",
        sales: "Sales",
        creator: "Creator",
        support: "Support",
        research: "Research",
      },
      metaLabels: {
        latestDraft: "最新ドラフト",
        targets: "配信先",
        publishFeedback: "配信フィードバック",
      },
      creatorQuery: {
        title: "Creator retrieval slice",
        desc: "配信状態とプラットフォームで creator asset を絞り込み、レビュー順やシグナル強度で並べ替えます。",
        filters: {
          all: "すべて",
          in_flight: "進行中",
          successful: "成功あり",
          retryable: "再試行あり",
        },
        sorts: {
          updated: "更新順",
          reviewed: "レビュー順",
          success_signal: "成功シグナル順",
          retry_priority: "再試行優先",
        },
        platforms: "プラットフォーム",
        allPlatforms: "すべての配信先",
      },
      heroRecommendations: {
        title: "Hero recommendations",
        desc: "sales / creator / support / research の最新 next move を runtime 層から引き、適切な実行ノードへ戻せるようにします。",
        refresh: "更新",
        loading: "同期中",
        ready: "同期済み",
        error: "同期失敗",
        lastSynced: "最終同期",
        empty: "runtime 層からまだ hero recommendation が返っていません。",
        unavailable: "現在 hero recommendation を読み込めません。",
      },
    };
  }
  return {
    eyebrow: "Asset Console",
    title: "结果不该做完就消失，而要逐步沉淀成可复用的业务资产层。",
    desc:
      "每次 workflow run 都应该留下一份可调用资产。这里统一按业务链查看、筛选和回跳，不再让资产散落在各个 App 里。",
    empty: "还没有结果资产。先跑一次 Hero Workflow，本地资产层就会开始累积。",
    open: "打开资产",
    updated: "更新于",
    filters: {
      all: "全部资产",
      sales: "销售",
      creator: "内容",
      support: "客服",
      research: "研究",
    },
    metaLabels: {
      latestDraft: "最新稿件",
      targets: "目标平台",
      publishFeedback: "发布反馈",
    },
    creatorQuery: {
      title: "Creator retrieval slice",
      desc: "按发布状态和平台筛 creator asset，再按复盘时间或结果信号排序。",
      filters: {
        all: "全部",
        in_flight: "进行中",
        successful: "有成功回执",
        retryable: "需重试",
      },
      sorts: {
        updated: "按更新时间",
        reviewed: "按复盘时间",
        success_signal: "按成功信号",
        retry_priority: "按重试优先级",
      },
      platforms: "平台过滤",
      allPlatforms: "全部平台",
    },
    heroRecommendations: {
      title: "Hero recommendations",
      desc: "直接从 runtime 层拉销售、内容、客服、研究四条业务链的最新结构化建议，再回到正确的执行节点。",
      refresh: "刷新",
      loading: "同步中",
      ready: "已同步",
      error: "同步失败",
      lastSynced: "最近同步",
      empty: "runtime 层暂时还没有返回 hero recommendation。",
      unavailable: "当前无法加载 hero recommendations。",
    },
  };
}

function truncateText(value: string, maxLength = 140) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function extractCreatorReuseSignal(reuseNotes?: string) {
  if (!reuseNotes) return "";
  const lines = reuseNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const reuseHeaderIndex = lines.findIndex((line) => line === "【下一轮可复用】");
  const scanLines = reuseHeaderIndex >= 0 ? lines.slice(reuseHeaderIndex + 1) : lines;
  const candidate = scanLines.find((line) => line.startsWith("- "));
  return candidate ? truncateText(candidate.replace(/^- /, ""), 160) : "";
}

function buildSalesEntries(items: SalesAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "sales",
    workflowLabel: "Sales Pipeline",
    title: asset.company || asset.contactName || "销售资产",
    detail:
      asset.assetDraft ||
      asset.latestDraftSubject ||
      asset.nextAction ||
      asset.requirementSummary ||
      "已沉淀客户偏好、推进节奏和下一步动作。",
    status: asset.quoteStatus || asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.contactId
        ? {
            kind: "record",
            appId: "personal_crm",
            eventName: "openclaw:crm-select",
            eventDetail: { contactId: asset.contactId },
          }
        : asset.emailThreadId
          ? {
              kind: "record",
              appId: "email_assistant",
              eventName: "openclaw:email-assistant-select",
              eventDetail: { threadId: asset.emailThreadId },
            }
          : asset.dealId
            ? {
                kind: "record",
                appId: "deal_desk",
                eventName: "openclaw:deal-desk-select",
                eventDetail: { dealId: asset.dealId },
              }
            : undefined,
  }));
}

function buildCreatorEntries(items: CreatorAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => {
    const publishFeedback =
      asset.latestPublishFeedback || extractCreatorReuseSignal(asset.reuseNotes);
    return {
      id: asset.id,
      family: "creator",
      workflowLabel: "Creator Studio",
      title: asset.topic || "内容增长资产",
      detail:
        asset.nextAction ||
        asset.primaryAngle ||
        "已沉淀选题角度、多平台内容包和发布候选稿。",
      status: asset.publishStatus || asset.status,
      updatedAt: asset.updatedAt,
      meta: [
        asset.latestDraftTitle
          ? {
              key: "latestDraft" as const,
              value: truncateText(asset.latestDraftTitle, 96),
            }
          : null,
        asset.publishTargets.length
          ? {
              key: "targets" as const,
              value: asset.publishTargets.join(" / "),
            }
          : null,
        publishFeedback
          ? {
              key: "publishFeedback" as const,
              value: truncateText(publishFeedback, 160),
            }
          : null,
      ].filter((item): item is NonNullable<AssetConsoleEntry["meta"]>[number] => Boolean(item)),
      jumpTarget:
        asset.draftId
          ? {
              kind: "publisher",
              prefill: {
                draftId: asset.draftId,
                workflowRunId: asset.workflowRunId,
                workflowScenarioId: asset.scenarioId,
              },
            }
          : asset.repurposerProjectId
            ? {
                kind: "record",
                appId: "content_repurposer",
                eventName: "openclaw:content-repurposer-select",
                eventDetail: { projectId: asset.repurposerProjectId },
              }
            : asset.radarItemId
              ? {
                  kind: "record",
                  appId: "creator_radar",
                  eventName: "openclaw:creator-radar-select",
                  eventDetail: { radarItemId: asset.radarItemId },
                }
              : undefined,
    };
  });
}

function buildSupportEntries(items: SupportAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "support",
    workflowLabel: "Support Ops",
    title: asset.customer || "客服资产",
    detail:
      asset.latestReply ||
      asset.faqDraft ||
      asset.nextAction ||
      "已沉淀建议回复、升级动作和 FAQ 片段。",
    status: asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.ticketId
        ? {
            kind: "record",
            appId: "support_copilot",
            eventName: "openclaw:support-copilot-select",
            eventDetail: { ticketId: asset.ticketId },
          }
        : asset.inboxItemId
          ? {
              kind: "record",
              appId: "inbox_declutter",
              eventName: "openclaw:inbox-select",
              eventDetail: { itemId: asset.inboxItemId },
            }
          : undefined,
  }));
}

function buildResearchEntries(items: ResearchAssetRecord[]): AssetConsoleEntry[] {
  return items.map((asset) => ({
    id: asset.id,
    family: "research",
    workflowLabel: "Research Radar",
    title: asset.topic || "研究资产",
    detail:
      asset.latestBrief ||
      asset.latestReport ||
      asset.nextAction ||
      "已沉淀研究简报、观察框架和决策摘要。",
    status: asset.status,
    updatedAt: asset.updatedAt,
    jumpTarget:
      asset.briefId
        ? {
            kind: "record",
            appId: "morning_brief",
            eventName: "openclaw:morning-brief-select",
            eventDetail: { briefId: asset.briefId },
          }
        : asset.reportId
          ? {
              kind: "record",
              appId: "deep_research_hub",
              eventName: "openclaw:research-hub-select",
              eventDetail: { reportId: asset.reportId },
            }
          : undefined,
  }));
}

export function UnifiedAssetConsole({
  language,
  onOpenAsset,
}: {
  language: InterfaceLanguage;
  onOpenAsset: (target?: AssetJumpTarget) => void;
}) {
  const [family, setFamily] = useState<AssetFamily>("all");
  const [creatorFilter, setCreatorFilter] = useState<CreatorAssetFilterId>("all");
  const [creatorSort, setCreatorSort] = useState<CreatorAssetSortId>("updated");
  const [creatorPlatform, setCreatorPlatform] = useState<CreatorPlatformFilter>("all");
  const [revision, setRevision] = useState(0);
  const copy = getCopy(language);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const offSales = subscribeSalesAssets(bump);
    const offCreator = subscribeCreatorAssets(bump);
    const offSupport = subscribeSupportAssets(bump);
    const offResearch = subscribeResearchAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      offSales();
      offCreator();
      offSupport();
      offResearch();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const {
    recommendations: heroRecommendations,
    phase: heroRecommendationPhase,
    error: heroRecommendationError,
    syncedAt: heroRecommendationSyncedAt,
    refresh: refreshHeroRecommendations,
    refreshKey: heroRecommendationRefreshKey,
  } = useRuntimeHeroWorkflowSummary({
    unavailableMessage: copy.heroRecommendations.unavailable,
    refreshToken: `${language}:${revision}`,
  });

  const creatorPlatforms = useMemo(() => {
    void revision;
    const values = new Set<PublishPlatformId>();
    for (const asset of getCreatorAssets()) {
      for (const platform of asset.publishTargets) values.add(platform);
      for (const platform of asset.successfulPlatforms) values.add(platform);
      for (const platform of asset.failedPlatforms) values.add(platform);
      for (const platform of asset.retryablePlatforms) values.add(platform);
    }
    return Array.from(values).sort((left, right) => left.localeCompare(right, "en"));
  }, [revision]);

  const entries = useMemo(() => {
    void revision;
    const salesEntries = buildSalesEntries(getSalesAssets());
    const creatorItems = queryCreatorAssets(getCreatorAssets(), {
      filter: creatorFilter,
      platform: creatorPlatform,
      sort: creatorSort,
    });
    const creatorEntries = buildCreatorEntries(creatorItems);
    const supportEntries = buildSupportEntries(getSupportAssets());
    const researchEntries = buildResearchEntries(getResearchAssets());
    return {
      sales: salesEntries,
      creator: creatorEntries,
      support: supportEntries,
      research: researchEntries,
      all: [...salesEntries, ...creatorEntries, ...supportEntries, ...researchEntries].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    };
  }, [creatorFilter, creatorPlatform, creatorSort, revision]);

  const filteredEntries = entries[family];
  const visibleHeroFamilies = useMemo<HeroRecommendationFamily[]>(() => {
    if (family === "all") return ["sales", "creator", "support", "research"];
    return [family];
  }, [family]);
  const visibleHeroRecommendations = visibleHeroFamilies
    .map((heroFamily) => ({
      family: heroFamily,
      recommendation: heroRecommendations[heroFamily],
    }))
    .filter((item): item is { family: HeroRecommendationFamily; recommendation: RecommendationResult } => Boolean(item.recommendation));
  const shouldShowHeroRecommendationSection = true;
  const heroRecommendationStatusLabel =
    heroRecommendationPhase === "loading"
      ? copy.heroRecommendations.loading
      : heroRecommendationPhase === "error"
        ? copy.heroRecommendations.error
        : copy.heroRecommendations.ready;

  const counts = useMemo(
    () => ({
      sales: entries.sales.length,
      creator: entries.creator.length,
      support: entries.support.length,
      research: entries.research.length,
    }),
    [entries.creator.length, entries.research.length, entries.sales.length, entries.support.length],
  );

  return (
    <div className="mt-5 rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_100%)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">
            <LibraryBig className="h-3.5 w-3.5" />
            {copy.eyebrow}
          </div>
          <div className="mt-3 text-xl font-semibold text-white">{copy.title}</div>
          <div className="mt-2 text-sm leading-6 text-white/70">{copy.desc}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Sales</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.sales}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Creator</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.creator}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Support</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.support}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/14 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Research</div>
            <div className="mt-2 text-lg font-semibold text-white">{counts.research}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", "sales", "creator", "support", "research"] as AssetFamily[]).map((item) => {
          const active = item === family;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFamily(item)}
              className={[
                "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-white/20 bg-white/16 text-white"
                  : "border-white/10 bg-white/8 text-white/75 hover:bg-white/12",
              ].join(" ")}
            >
              {copy.filters[item]}
            </button>
          );
        })}
      </div>

      {shouldShowHeroRecommendationSection ? (
        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/16 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                {copy.heroRecommendations.title}
              </div>
              <div className="mt-2 text-sm leading-6 text-white/65">{copy.heroRecommendations.desc}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  heroRecommendationPhase === "error"
                    ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
                    : heroRecommendationPhase === "loading"
                      ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                      : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
                ].join(" ")}
              >
                {heroRecommendationStatusLabel}
              </div>
              <button
                type="button"
                onClick={refreshHeroRecommendations}
                disabled={heroRecommendationPhase === "loading"}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={["h-3.5 w-3.5", heroRecommendationPhase === "loading" ? "animate-spin" : ""].join(" ")} />
                {copy.heroRecommendations.refresh}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/55">
            <div>
              {copy.heroRecommendations.lastSynced}: {heroRecommendationSyncedAt ? new Date(heroRecommendationSyncedAt).toLocaleString() : "暂无"}
            </div>
            {heroRecommendationPhase === "error" ? (
              <div className="text-rose-200">{heroRecommendationError}</div>
            ) : null}
          </div>

          {visibleHeroRecommendations.length > 0 ? (
            <div className={["mt-4 grid gap-3", visibleHeroRecommendations.length > 1 ? "lg:grid-cols-3" : ""].join(" ")}>
              {visibleHeroRecommendations.map((item) => (
                <div
                  key={`hero-recommendation-${item.family}`}
                  className="rounded-[24px] border border-white/10 bg-black/14 p-4"
                >
                  <div className="mb-3 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75 inline-flex">
                    {copy.filters[item.family]}
                  </div>
                  <RecommendationResultBody
                    recommendation={item.recommendation}
                    tone="slate"
                    maxHitsPerSection={1}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-black/14 p-5 text-sm leading-6 text-white/60">
              {heroRecommendationPhase === "error"
                ? copy.heroRecommendations.unavailable
                : heroRecommendationPhase === "loading"
                  ? copy.heroRecommendations.loading
                  : copy.heroRecommendations.empty}
            </div>
          )}
        </div>
      ) : null}

      {family === "creator" ? (
        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/16 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {copy.creatorQuery.title}
          </div>
          <div className="mt-2 text-sm leading-6 text-white/65">{copy.creatorQuery.desc}</div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(copy.creatorQuery.filters) as CreatorAssetFilterId[]).map((item) => {
              const active = item === creatorFilter;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCreatorFilter(item)}
                  className={[
                    "rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-white/20 bg-white/16 text-white"
                      : "border-white/10 bg-white/8 text-white/70 hover:bg-white/12",
                  ].join(" ")}
                >
                  {copy.creatorQuery.filters[item]}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(copy.creatorQuery.sorts) as CreatorAssetSortId[]).map((item) => {
              const active = item === creatorSort;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCreatorSort(item)}
                  className={[
                    "rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-sky-300/40 bg-sky-400/12 text-sky-100"
                      : "border-white/10 bg-white/8 text-white/70 hover:bg-white/12",
                  ].join(" ")}
                >
                  {copy.creatorQuery.sorts[item]}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {copy.creatorQuery.platforms}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCreatorPlatform("all")}
                className={[
                  "rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors",
                  creatorPlatform === "all"
                    ? "border-emerald-300/35 bg-emerald-400/12 text-emerald-100"
                    : "border-white/10 bg-white/8 text-white/70 hover:bg-white/12",
                ].join(" ")}
              >
                {copy.creatorQuery.allPlatforms}
              </button>
              {creatorPlatforms.map((platform) => {
                const active = creatorPlatform === platform;
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => setCreatorPlatform(platform)}
                    className={[
                      "rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors",
                      active
                        ? "border-emerald-300/35 bg-emerald-400/12 text-emerald-100"
                        : "border-white/10 bg-white/8 text-white/70 hover:bg-white/12",
                    ].join(" ")}
                  >
                    {platform}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {filteredEntries.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {filteredEntries.slice(0, 8).map((entry) => (
            <div
              key={entry.id}
              className="rounded-[24px] border border-white/10 bg-black/14 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                      {entry.workflowLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-white/65">
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-3 text-base font-semibold text-white">{entry.title}</div>
                  <div className="mt-2 line-clamp-3 text-sm leading-6 text-white/70">
                    {entry.detail}
                  </div>
                  {entry.meta && entry.meta.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {entry.meta.slice(0, 3).map((meta) => (
                        <div
                          key={`${entry.id}-${meta.key}`}
                          className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2"
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                            {copy.metaLabels[meta.key]}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-white/72">{meta.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <FolderKanban className="h-5 w-5 shrink-0 text-white/35" />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs text-white/55">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.updated} {new Date(entry.updatedAt).toLocaleString()}
                </div>
                {entry.jumpTarget ? (
                  <button
                    type="button"
                    onClick={() => onOpenAsset(entry.jumpTarget)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition-colors hover:bg-white/15"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {copy.open}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border border-dashed border-white/10 bg-black/14 p-5 text-sm leading-6 text-white/60">
          {copy.empty}
        </div>
      )}
    </div>
  );
}
