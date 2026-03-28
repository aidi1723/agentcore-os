import type { AssetJumpTarget } from "@/lib/asset-jumps";
import type { CreatorAssetRecord } from "@/lib/creator-assets";
import {
  getCreatorRuntimeLabel,
  getCreatorStageStateLabel,
  getCreatorTriggerLabel,
  getCreatorWorkflowNextAction,
} from "@/lib/creator-workflow";
import type { DraftRecord } from "@/lib/drafts";
import type {
  RecommendationAction,
  RecommendationHit,
  RecommendationResult,
  RecommendationSection,
} from "@/lib/recommendation-contract";
import type { PublishJobRecord } from "@/lib/publish";
import type { ResearchAssetRecord } from "@/lib/research-assets";
import {
  getResearchRuntimeLabel,
  getResearchStageStateLabel,
  getResearchTriggerLabel,
  getResearchWorkflowNextAction,
} from "@/lib/research-workflow";
import type { SalesAssetRecord } from "@/lib/sales-assets";
import {
  getSalesRuntimeLabel,
  getSalesStageStateLabel,
  getSalesTriggerLabel,
  getSalesWorkflowNextAction,
} from "@/lib/sales-workflow";
import type { SupportAssetRecord } from "@/lib/support-assets";
import {
  getSupportRuntimeLabel,
  getSupportStageStateLabel,
  getSupportTriggerLabel,
  getSupportWorkflowNextAction,
} from "@/lib/support-workflow";
import type { TaskRecord } from "@/lib/tasks";
import type { WorkflowRunRecord } from "@/lib/workflow-runs";

export type HeroWorkflowFamily = "sales" | "creator" | "support" | "research";

type RecommendationBuilder = {
  family: HeroWorkflowFamily;
  familyLabel: string;
  run: WorkflowRunRecord | null;
  source?: string;
  nextStep: string;
  assetJumpTarget?: AssetJumpTarget;
  runtimeLabel: string;
  triggerLabel: string;
  stageLabel?: string;
  sections: RecommendationSection[];
};

function truncateText(value: string, maxLength = 160) {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function getRunScore(run: WorkflowRunRecord | null) {
  switch (run?.state) {
    case "error":
      return 96;
    case "awaiting_human":
      return 89;
    case "running":
      return 78;
    case "completed":
      return 64;
    default:
      return 42;
  }
}

function buildRuntimeSection(builder: RecommendationBuilder): RecommendationSection {
  const currentStage = builder.run?.stageRuns.find((stage) => stage.id === builder.run?.currentStageId);
  const hits: RecommendationHit[] = [];

  hits.push({
    kind: `${builder.family}_workflow`,
    id: `${builder.family}-workflow-status`,
    title: currentStage ? `${currentStage.title} · ${builder.stageLabel ?? builder.runtimeLabel}` : builder.runtimeLabel,
    summary: builder.run
      ? truncateText(
          `${builder.familyLabel} 当前由 ${builder.triggerLabel} 触发。${builder.nextStep}`,
          180,
        )
      : `当前还没有在跑的 ${builder.familyLabel} 闭环。`,
    score: getRunScore(builder.run),
    rationale: builder.run
      ? "这是当前最直接决定执行节奏的运行态信号。"
      : "先明确是否有正在运行的闭环，再决定是否启动新一轮。",
    metadata: [
      `状态 ${builder.runtimeLabel}`,
      builder.run ? `触发 ${builder.triggerLabel}` : "等待启动",
      currentStage ? `阶段 ${currentStage.title}` : "无进行中阶段",
    ],
  });

  if (builder.source?.trim()) {
    hits.push({
      kind: "workflow_source",
      id: `${builder.family}-workflow-source`,
      title: "上游来源",
      summary: truncateText(builder.source, 180),
      score: 58,
      rationale: "跨应用来源决定了这一轮闭环应当继承的上下文。",
      metadata: ["跨应用上下文"],
    });
  }

  hits.push({
    kind: "workflow_next_step",
    id: `${builder.family}-workflow-next-step`,
    title: "下一步动作",
    summary: truncateText(builder.nextStep, 180),
    score: builder.run?.state === "error" ? 93 : builder.run?.state === "awaiting_human" ? 88 : 74,
    rationale: "把下一步动作显式化，能减少 workflow 在人工交接处的丢失。",
    metadata: [builder.run?.currentStageId ? `当前节点 ${builder.run.currentStageId}` : "默认路径"],
  });

  return {
    id: `${builder.family}_runtime`,
    label: "执行信号",
    hits,
  };
}

function buildAction(builder: RecommendationBuilder): RecommendationAction {
  if (builder.run?.state === "error") {
    return {
      kind: `resume_${builder.family}_workflow`,
      label: "回到异常节点",
      rationale: "这一轮闭环已进入异常状态，先处理失败节点和缺失上下文，再继续往后推进。",
      jumpTarget: builder.assetJumpTarget,
    };
  }
  if (builder.run?.state === "awaiting_human") {
    return {
      kind: `resume_${builder.family}_workflow`,
      label: "先处理人工确认",
      rationale: "当前卡点在人工确认位，先完成确认比继续生成更多候选结果更有效。",
      jumpTarget: builder.assetJumpTarget,
    };
  }
  if (builder.run?.state === "running") {
    return {
      kind: `advance_${builder.family}_workflow`,
      label: "继续推进当前阶段",
      rationale: "自动链路还在运行，最值得盯住当前阶段输出是否足够支撑下一跳。",
      jumpTarget: builder.assetJumpTarget,
    };
  }
  if (builder.run?.state === "completed" && builder.assetJumpTarget) {
    return {
      kind: `reuse_${builder.family}_asset`,
      label: "复用沉淀资产",
      rationale: "当前闭环已经完成，下一步不该重新开始，而是先回看并复用这一轮沉淀下来的资产。",
      jumpTarget: builder.assetJumpTarget,
    };
  }
  if (builder.run?.state === "completed") {
    return {
      kind: `assetize_${builder.family}_workflow`,
      label: "补齐资产沉淀",
      rationale: "流程已经跑完，但还缺少足够可复用的资产信号，先把沉淀补齐更划算。",
    };
  }
  if (builder.assetJumpTarget) {
    return {
      kind: `review_${builder.family}_asset`,
      label: "查看已沉淀资产",
      rationale: "当前没有进行中的闭环，可以先回看最近资产，确认是否能直接复用而不是重跑一遍。",
      jumpTarget: builder.assetJumpTarget,
    };
  }
  return {
    kind: `start_${builder.family}_workflow`,
    label: "启动新一轮闭环",
    rationale: `当前还没有进行中的 ${builder.familyLabel} workflow，先启动第一轮，再让资产层逐步积累。`,
  };
}

function buildRecommendation(builder: RecommendationBuilder): RecommendationResult {
  return {
    contractVersion: "v1",
    query: builder.source?.trim() || builder.nextStep || `${builder.family}-hero-workflow`,
    sections: [buildRuntimeSection(builder), ...builder.sections],
    recommendedAction: buildAction(builder),
  };
}

function buildDraftJumpTarget(draft: DraftRecord | null): AssetJumpTarget | undefined {
  if (!draft) return undefined;
  return {
    kind: "publisher",
    prefill: {
      draftId: draft.id,
      workflowRunId: draft.workflowRunId,
      workflowScenarioId: draft.workflowScenarioId,
    },
  };
}

function buildTaskSection(input: {
  family: HeroWorkflowFamily;
  tasks?: TaskRecord[];
  jumpTarget?: AssetJumpTarget;
}): RecommendationSection | null {
  const tasks = (input.tasks ?? []).slice(0, 3);
  if (tasks.length === 0) return null;
  return {
    id: `${input.family}_task_signals`,
    label: "任务信号",
    hits: tasks.map((task, index) => ({
      kind: "task",
      id: task.id,
      title: task.name || `任务 ${index + 1}`,
      summary: truncateText(
        task.detail || task.workflowNextStep || task.workflowSource || "当前任务还没有详细说明。",
        180,
      ),
      score:
        task.status === "error"
          ? 87
          : task.status === "running"
            ? 80
            : task.status === "queued"
              ? 76
              : 68,
      rationale: "与当前 workflow 绑定的任务能直接暴露这一轮闭环里仍在执行、排队或失败的工作。",
      metadata: [
        `状态 ${task.status}`,
        task.workflowStageId ? `阶段 ${task.workflowStageId}` : "",
        typeof task.progress === "number" ? `进度 ${task.progress}%` : "",
      ].filter(Boolean),
      jumpTarget: input.jumpTarget,
    })),
  };
}

function buildSalesJumpTarget(asset: SalesAssetRecord | null): AssetJumpTarget | undefined {
  if (!asset) return undefined;
  if (asset.contactId) {
    return {
      kind: "record",
      appId: "personal_crm",
      eventName: "openclaw:crm-select",
      eventDetail: { contactId: asset.contactId },
    };
  }
  if (asset.emailThreadId) {
    return {
      kind: "record",
      appId: "email_assistant",
      eventName: "openclaw:email-assistant-select",
      eventDetail: { threadId: asset.emailThreadId },
    };
  }
  if (asset.dealId) {
    return {
      kind: "record",
      appId: "deal_desk",
      eventName: "openclaw:deal-desk-select",
      eventDetail: { dealId: asset.dealId },
    };
  }
  return undefined;
}

function buildSupportJumpTarget(asset: SupportAssetRecord | null): AssetJumpTarget | undefined {
  if (!asset) return undefined;
  if (asset.ticketId) {
    return {
      kind: "record",
      appId: "support_copilot",
      eventName: "openclaw:support-copilot-select",
      eventDetail: { ticketId: asset.ticketId },
    };
  }
  if (asset.inboxItemId) {
    return {
      kind: "record",
      appId: "inbox_declutter",
      eventName: "openclaw:inbox-select",
      eventDetail: { itemId: asset.inboxItemId },
    };
  }
  return undefined;
}

function buildCreatorJumpTarget(asset: CreatorAssetRecord | null): AssetJumpTarget | undefined {
  if (!asset) return undefined;
  if (asset.draftId) {
    return {
      kind: "publisher",
      prefill: {
        draftId: asset.draftId,
        workflowRunId: asset.workflowRunId,
        workflowScenarioId: asset.scenarioId,
      },
    };
  }
  if (asset.repurposerProjectId) {
    return {
      kind: "record",
      appId: "content_repurposer",
      eventName: "openclaw:content-repurposer-select",
      eventDetail: { projectId: asset.repurposerProjectId },
    };
  }
  if (asset.radarItemId) {
    return {
      kind: "record",
      appId: "creator_radar",
      eventName: "openclaw:creator-radar-select",
      eventDetail: { radarItemId: asset.radarItemId },
    };
  }
  return undefined;
}

function buildResearchJumpTarget(asset: ResearchAssetRecord | null): AssetJumpTarget | undefined {
  if (!asset) return undefined;
  if (asset.briefId) {
    return {
      kind: "record",
      appId: "morning_brief",
      eventName: "openclaw:morning-brief-select",
      eventDetail: { briefId: asset.briefId },
    };
  }
  if (asset.reportId) {
    return {
      kind: "record",
      appId: "deep_research_hub",
      eventName: "openclaw:research-hub-select",
      eventDetail: { reportId: asset.reportId },
    };
  }
  return undefined;
}

export function buildSalesHeroWorkflowRecommendation(input: {
  run: WorkflowRunRecord | null;
  asset: SalesAssetRecord | null;
  tasks?: TaskRecord[];
  source?: string;
  nextStep?: string;
}): RecommendationResult {
  const asset = input.asset;
  const assetJumpTarget = buildSalesJumpTarget(asset);
  const detail =
    asset?.assetDraft ||
    asset?.requirementSummary ||
    asset?.nextAction ||
    "完成资格判断、邮件审核和 CRM 同步后，这里会逐步沉淀客户偏好与推进规则。";
  const assetSignals = [
    asset?.preferenceNotes ? `偏好：${asset.preferenceNotes}` : "",
    asset?.objectionNotes ? `异议：${asset.objectionNotes}` : "",
    asset?.quoteNotes ? `报价：${asset.quoteNotes}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return buildRecommendation({
    family: "sales",
    familyLabel: "销售",
    run: input.run,
    source: input.source,
    nextStep: input.nextStep || asset?.nextAction || getSalesWorkflowNextAction(input.run),
    assetJumpTarget,
    runtimeLabel: getSalesRuntimeLabel(input.run?.state),
    triggerLabel: getSalesTriggerLabel(input.run?.triggerType),
    stageLabel: input.run?.currentStageId
      ? getSalesStageStateLabel(
          input.run.stageRuns.find((stage) => stage.id === input.run?.currentStageId)?.state ?? "pending",
        )
      : undefined,
    sections: [
      {
        id: "sales_asset_signals",
        label: "资产信号",
        hits: asset
          ? [
              {
                kind: "sales_asset",
                id: asset.id,
                title: asset.company || asset.contactName || "销售资产",
                summary: truncateText(detail, 180),
                score: asset.status === "completed" ? 86 : asset.quoteStatus === "approved" ? 80 : 70,
                rationale: "这是当前最接近复用价值的客户与推进资产。",
                metadata: [
                  asset.inquiryChannel ? `来源 ${asset.inquiryChannel}` : "",
                  asset.productLine ? `产品 ${asset.productLine}` : "",
                  asset.preferredLanguage ? `语言 ${asset.preferredLanguage}` : "",
                ].filter(Boolean),
                jumpTarget: assetJumpTarget,
              },
              ...(assetSignals
                ? [
                    {
                      kind: "sales_signal",
                      id: `${asset.id}-signals`,
                      title: "偏好与成交信号",
                      summary: truncateText(assetSignals, 180),
                      score: 74,
                      rationale: "偏好、异议和报价反馈决定下一轮能否更快推进。",
                      metadata: [asset.quoteStatus ? `报价状态 ${asset.quoteStatus}` : "待报价"],
                    } satisfies RecommendationHit,
                  ]
                : []),
            ]
          : [],
      },
      buildTaskSection({
        family: "sales",
        tasks: input.tasks,
        jumpTarget: assetJumpTarget,
      }),
    ].filter((section): section is RecommendationSection => Boolean(section)),
  });
}

export function buildSupportHeroWorkflowRecommendation(input: {
  run: WorkflowRunRecord | null;
  asset: SupportAssetRecord | null;
  tasks?: TaskRecord[];
  source?: string;
  nextStep?: string;
}): RecommendationResult {
  const asset = input.asset;
  const assetJumpTarget = buildSupportJumpTarget(asset);
  const detail =
    asset?.latestReply ||
    asset?.issueSummary ||
    asset?.nextAction ||
    "问题摘要、回复草稿、FAQ 和升级规则会逐步沉淀到这里。";
  const reuseSignal =
    asset?.faqDraft || asset?.escalationTask
      ? [asset?.faqDraft ? `FAQ：${asset.faqDraft}` : "", asset?.escalationTask ? `升级：${asset.escalationTask}` : ""]
          .filter(Boolean)
          .join(" | ")
      : "";

  return buildRecommendation({
    family: "support",
    familyLabel: "客服",
    run: input.run,
    source: input.source,
    nextStep: input.nextStep || asset?.nextAction || getSupportWorkflowNextAction(input.run),
    assetJumpTarget,
    runtimeLabel: getSupportRuntimeLabel(input.run?.state),
    triggerLabel: getSupportTriggerLabel(input.run?.triggerType),
    stageLabel: input.run?.currentStageId
      ? getSupportStageStateLabel(
          input.run.stageRuns.find((stage) => stage.id === input.run?.currentStageId)?.state ?? "pending",
        )
      : undefined,
    sections: [
      {
        id: "support_asset_signals",
        label: "资产信号",
        hits: asset
          ? [
              {
                kind: "support_asset",
                id: asset.id,
                title: asset.customer || "客服资产",
                summary: truncateText(detail, 180),
                score: asset.status === "completed" ? 85 : asset.status === "faq" ? 81 : 72,
                rationale: "这是当前最接近标准回复和处理边界的客服资产。",
                metadata: [
                  asset.channel ? `渠道 ${asset.channel}` : "",
                  asset.status ? `状态 ${asset.status}` : "",
                ].filter(Boolean),
                jumpTarget: assetJumpTarget,
              },
              ...(reuseSignal
                ? [
                    {
                      kind: "support_signal",
                      id: `${asset.id}-reuse`,
                      title: "FAQ / 升级边界",
                      summary: truncateText(reuseSignal, 180),
                      score: 76,
                      rationale: "FAQ 与升级边界越清晰，下一次客服闭环越稳。",
                      metadata: ["可复用处理规则"],
                    } satisfies RecommendationHit,
                  ]
                : []),
            ]
          : [],
      },
      buildTaskSection({
        family: "support",
        tasks: input.tasks,
        jumpTarget: assetJumpTarget,
      }),
    ].filter((section): section is RecommendationSection => Boolean(section)),
  });
}

export function buildCreatorHeroWorkflowRecommendation(input: {
  run: WorkflowRunRecord | null;
  asset: CreatorAssetRecord | null;
  draft?: DraftRecord | null;
  publishJob?: PublishJobRecord | null;
  tasks?: TaskRecord[];
  source?: string;
  nextStep?: string;
}): RecommendationResult {
  const asset = input.asset;
  const draft = input.draft ?? null;
  const publishJob = input.publishJob ?? null;
  const assetJumpTarget = buildCreatorJumpTarget(asset);
  const draftJumpTarget = buildDraftJumpTarget(draft);
  const detail =
    asset?.latestPublishFeedback ||
    asset?.nextAction ||
    asset?.latestDraftTitle ||
    asset?.primaryAngle ||
    "选题、内容包、发布状态和复用笔记会逐步沉淀到这里。";
  const assetSignals = [
    asset?.publishTargets.length ? `平台：${asset.publishTargets.join(" / ")}` : "",
    asset?.successfulPlatforms.length ? `成功：${asset.successfulPlatforms.join(" / ")}` : "",
    asset?.retryablePlatforms.length ? `重试：${asset.retryablePlatforms.join(" / ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  const reuseSignal = asset?.reuseNotes ? truncateText(asset.reuseNotes, 180) : "";
  const draftSummary =
    draft?.body?.trim() ||
    draft?.workflowSourceSummary ||
    draft?.workflowPublishNotes ||
    "当前还没有可复盘的草稿正文。";
  const connectorSummary = (() => {
    if (!publishJob) return "";
    if (publishJob.results?.length) {
      const successful = publishJob.results.filter((item) => item.ok).map((item) => item.platform);
      const retryable = publishJob.results.filter((item) => item.retryable).map((item) => item.platform);
      const failed = publishJob.results.filter((item) => !item.ok).map((item) => item.platform);
      return [
        successful.length ? `成功：${successful.join(" / ")}` : "",
        retryable.length ? `可重试：${retryable.join(" / ")}` : "",
        failed.length ? `失败：${failed.join(" / ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    }
    return publishJob.resultText || "当前还没有 connector 回执明细。";
  })();

  return buildRecommendation({
    family: "creator",
    familyLabel: "内容",
    run: input.run,
    source: input.source,
    nextStep: input.nextStep || asset?.nextAction || getCreatorWorkflowNextAction(input.run),
    assetJumpTarget,
    runtimeLabel: getCreatorRuntimeLabel(input.run?.state),
    triggerLabel: getCreatorTriggerLabel(input.run?.triggerType),
    stageLabel: input.run?.currentStageId
      ? getCreatorStageStateLabel(
          input.run.stageRuns.find((stage) => stage.id === input.run?.currentStageId)?.state ?? "pending",
        )
      : undefined,
    sections: [
      {
        id: "creator_asset_signals",
        label: "资产信号",
        hits: asset
          ? [
              {
                kind: "creator_asset",
                id: asset.id,
                title: asset.topic || asset.latestDraftTitle || "内容资产",
                summary: truncateText(detail, 180),
                score:
                  asset.status === "completed"
                    ? 87
                    : asset.status === "publishing"
                      ? 82
                      : asset.status === "preflight"
                        ? 77
                        : 71,
                rationale: "这是当前最接近复用价值的内容选题、发布反馈和平台动作资产。",
                metadata: [
                  asset.publishStatus ? `发布 ${asset.publishStatus}` : "",
                  asset.audience ? `受众 ${asset.audience}` : "",
                  asset.primaryAngle ? `角度 ${truncateText(asset.primaryAngle, 42)}` : "",
                ].filter(Boolean),
                jumpTarget: assetJumpTarget,
              },
              ...(assetSignals
                ? [
                    {
                      kind: "creator_signal",
                      id: `${asset.id}-signals`,
                      title: "平台结果信号",
                      summary: truncateText(assetSignals, 180),
                      score: 79,
                      rationale: "平台成功和可重试信号决定下一轮该复用什么结构、修什么连接。",
                      metadata: ["平台级反馈"],
                    } satisfies RecommendationHit,
                  ]
                : []),
              ...(reuseSignal
                ? [
                    {
                      kind: "creator_reuse_signal",
                      id: `${asset.id}-reuse`,
                      title: "复用笔记",
                      summary: reuseSignal,
                      score: 74,
                      rationale: "复用笔记把一次性的发布结果转成下一轮可复用的结构资产。",
                      metadata: ["结构复盘"],
                    } satisfies RecommendationHit,
                  ]
                : []),
            ]
          : [],
      },
      {
        id: "creator_draft_signals",
        label: "草稿信号",
        hits: draft
          ? [
              {
                kind: "draft",
                id: draft.id,
                title: draft.title || "发布草稿",
                summary: truncateText(draftSummary, 180),
                score: 76,
                rationale: "草稿是内容闭环里最直接可编辑、可预演、可发布的中间产物。",
                metadata: [
                  draft.source ? `来源 ${draft.source}` : "",
                  draft.workflowStageId ? `阶段 ${draft.workflowStageId}` : "",
                  draft.tags?.length ? `标签 ${draft.tags.slice(0, 3).join(" / ")}` : "",
                ].filter(Boolean),
                jumpTarget: draftJumpTarget,
              },
            ]
          : [],
      },
      {
        id: "creator_connector_signals",
        label: "连接器信号",
        hits: publishJob
          ? [
              {
                kind: "publish_job",
                id: publishJob.id,
                title: publishJob.draftTitle || draft?.title || "发布任务",
                summary: truncateText(connectorSummary || "当前还没有 connector 回执明细。", 180),
                score:
                  publishJob.status === "error"
                    ? 88
                    : publishJob.status === "running" || publishJob.status === "queued"
                      ? 81
                      : 73,
                rationale: "connector 回执决定这一轮内容链是在继续等待、先修连接，还是可以直接复用表现最好的结构。",
                metadata: [
                  publishJob.status ? `任务 ${publishJob.status}` : "",
                  publishJob.mode ? `模式 ${publishJob.mode}` : "",
                  publishJob.platforms.length ? `平台 ${publishJob.platforms.join(" / ")}` : "",
                ].filter(Boolean),
                jumpTarget: draftJumpTarget ?? assetJumpTarget,
              },
            ]
          : [],
      },
      {
        id: "creator_task_signals",
        label: "任务信号",
        hits: buildTaskSection({
          family: "creator",
          tasks: input.tasks,
          jumpTarget: draftJumpTarget ?? assetJumpTarget,
        })?.hits ?? [],
      },
    ],
  });
}

export function buildResearchHeroWorkflowRecommendation(input: {
  run: WorkflowRunRecord | null;
  asset: ResearchAssetRecord | null;
  tasks?: TaskRecord[];
  source?: string;
  nextStep?: string;
}): RecommendationResult {
  const asset = input.asset;
  const assetJumpTarget = buildResearchJumpTarget(asset);
  const detail =
    asset?.latestBrief ||
    asset?.latestReport ||
    asset?.angle ||
    asset?.nextAction ||
    "研究摘要、洞察路由和晨报分发会逐步沉淀到这里。";
  const routingSignal =
    asset?.vaultQuery || asset?.audience
      ? [asset?.vaultQuery ? `知识检索：${asset.vaultQuery}` : "", asset?.audience ? `受众：${asset.audience}` : ""]
          .filter(Boolean)
          .join(" | ")
      : "";

  return buildRecommendation({
    family: "research",
    familyLabel: "研究",
    run: input.run,
    source: input.source,
    nextStep: input.nextStep || asset?.nextAction || getResearchWorkflowNextAction(input.run),
    assetJumpTarget,
    runtimeLabel: getResearchRuntimeLabel(input.run?.state),
    triggerLabel: getResearchTriggerLabel(input.run?.triggerType),
    stageLabel: input.run?.currentStageId
      ? getResearchStageStateLabel(
          input.run.stageRuns.find((stage) => stage.id === input.run?.currentStageId)?.state ?? "pending",
        )
      : undefined,
    sections: [
      {
        id: "research_asset_signals",
        label: "资产信号",
        hits: asset
          ? [
              {
                kind: "research_asset",
                id: asset.id,
                title: asset.topic || "研究资产",
                summary: truncateText(detail, 180),
                score: asset.status === "completed" ? 85 : asset.status === "routing" ? 79 : 71,
                rationale: "这是当前最接近复盘、分发和长期跟踪价值的研究资产。",
                metadata: [
                  asset.sources ? `来源 ${asset.sources}` : "",
                  asset.status ? `状态 ${asset.status}` : "",
                ].filter(Boolean),
                jumpTarget: assetJumpTarget,
              },
              ...(routingSignal
                ? [
                    {
                      kind: "research_signal",
                      id: `${asset.id}-routing`,
                      title: "分发与检索信号",
                      summary: truncateText(routingSignal, 180),
                      score: 75,
                      rationale: "研究结果要进入知识检索或晨报路由，才算真正闭环。",
                      metadata: ["知识路由"],
                    } satisfies RecommendationHit,
                  ]
                : []),
            ]
          : [],
      },
      buildTaskSection({
        family: "research",
        tasks: input.tasks,
        jumpTarget: assetJumpTarget,
      }),
    ].filter((section): section is RecommendationSection => Boolean(section)),
  });
}
