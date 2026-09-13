"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, FilePlus2, Plus, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import { CreatorHeroWorkflowPanel } from "@/components/workflows/CreatorHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createContentRepurposerProject,
  getContentRepurposerProjects,
  removeContentRepurposerProject,
  subscribeContentRepurposer,
  updateContentRepurposerProject,
  type ContentRepurposerProject,
  type RepurposeSourceType,
} from "@/lib/content-repurposer";
import {
  getCreatorAssetByWorkflowRunId,
  subscribeCreatorAssets,
  upsertCreatorAsset,
} from "@/lib/creator-assets";
import {
  buildCreatorWorkflowMeta,
  getCreatorWorkflowOriginLabel,
  getCreatorWorkflowScenario,
} from "@/lib/creator-workflow";
import { createDraft } from "@/lib/drafts";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { buildContentRepurposerSurfaceRecommendation } from "@/lib/workflow-surface-recommendation";
import { requestOpenPublisher, type ContentRepurposerPrefill } from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  getWorkflowRun,
  startWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";
import { designTokens } from "@/design-system/tokens";

const sourceTypes: Array<{ value: RepurposeSourceType; label: string }> = [
  { value: "youtube", label: "YouTube / 长视频" },
  { value: "podcast", label: "播客" },
  { value: "webinar", label: "直播 / webinar" },
  { value: "article", label: "文章" },
  { value: "notes", label: "笔记 / 研究" },
];

function buildLocalPack(project: ContentRepurposerProject) {
  return [
    "【Repurpose Pack】",
    `- 标题：${project.title || "未填写"}`,
    `- 来源类型：${project.sourceType}`,
    `- 受众：${project.audience || "未填写"}`,
    `- 目标：${project.goal || "未填写"}`,
    "",
    "【短视频口播】",
    `开场：今天用 30 秒讲清楚 ${project.title || "这个主题"}。`,
    "结构：问题 -> 关键观点 -> 一个可执行动作 -> CTA。",
    "",
    "【社媒帖子】",
    `标题：${project.title || "这个主题"}，其实最该先做的是这一步`,
    "正文：提炼 3 个要点，每点一句，最后补一个行动建议。",
    "",
    "【邮件 / newsletter 摘要】",
    "用 3 段写清背景、核心洞察和下一步建议，方便发给订阅用户或团队。",
  ].join("\n");
}

function getDefaultTriggerType(project: ContentRepurposerProject): WorkflowTriggerType {
  return project.workflowTriggerType ?? "manual";
}

function extractLeadLine(content: string, fallback: string) {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.replace(/^[\-*#【】\s]+/g, "").trim())
    .find(Boolean);
  return line || fallback;
}

function buildRepurposerSourceSummary(project: ContentRepurposerProject) {
  return [project.sourceContent, project.contentPack].map((value) => value?.trim()).find(Boolean) ?? "";
}

function buildRepurposerPublishNotes(
  project: ContentRepurposerProject,
  options?: {
    blockLabel?: string;
    suggestedPlatforms?: SuggestedPlatform[];
  },
) {
  return [
    project.goal ? `目标：${project.goal}` : "",
    options?.blockLabel ? `内容块：${options.blockLabel}` : "",
    options?.suggestedPlatforms?.length
      ? `建议平台：${options.suggestedPlatforms.join(" / ")}`
      : project.workflowSuggestedPlatforms?.length
        ? `建议平台：${project.workflowSuggestedPlatforms.join(" / ")}`
        : "",
  ]
    .filter(Boolean)
    .join("；");
}

type ContentPackBlock = {
  id: string;
  label: string;
  body: string;
  summary: string;
  suggestedPlatforms: ("xiaohongshu" | "douyin" | "tiktok" | "instagram")[];
};

type SuggestedPlatform = ContentPackBlock["suggestedPlatforms"][number];

function normalizeBlockMeta(label: string) {
  const key = label.toLowerCase();
  if (key.includes("短视频") || key.includes("口播") || key.includes("video") || key.includes("reel")) {
    return { suggestedPlatforms: ["douyin", "tiktok"] as const };
  }
  if (key.includes("newsletter") || key.includes("邮件") || key.includes("email")) {
    return { suggestedPlatforms: ["xiaohongshu", "instagram"] as const };
  }
  return { suggestedPlatforms: ["xiaohongshu", "instagram"] as const };
}

function parseContentPackBlocks(content: string) {
  const text = content.trim();
  if (!text) return [] as ContentPackBlock[];

  const lines = text.split(/\r?\n/);
  const blocks: Array<{ label: string; lines: string[] }> = [];
  let current: { label: string; lines: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bracketHeading = line.match(/^【(.+?)】\s*$/);
    const markdownHeading = line.match(/^#{1,3}\s+(.+?)\s*$/);
    const heading = bracketHeading?.[1] ?? markdownHeading?.[1] ?? null;

    if (heading) {
      const next = { label: heading.trim(), lines: [] as string[] };
      blocks.push(next);
      current = next;
      continue;
    }

    if (!current) {
      current = { label: "内容包", lines: [] };
      blocks.push(current);
    }
    current.lines.push(rawLine);
  }

  const parsed = blocks
    .map((block, index) => {
      const body = block.lines.join("\n").trim();
      if (!body) return null;
      if (block.label === "Repurpose Pack" || block.label === "内容包") return null;
      const summary = body.replace(/\s+/g, " ").slice(0, 88);
      return {
        id: `${index}-${block.label}`,
        label: block.label,
        body,
        summary: summary || "可继续编辑后投递到下一步。",
        suggestedPlatforms: [...normalizeBlockMeta(block.label).suggestedPlatforms] as SuggestedPlatform[],
      } satisfies ContentPackBlock;
    })
    .filter((block): block is ContentPackBlock => Boolean(block));

  if (parsed.length > 0) return parsed;

  return [
    {
      id: "full-pack",
      label: "完整内容包",
      body: text,
      summary: text.replace(/\s+/g, " ").slice(0, 88) || "可继续编辑后投递到下一步。",
      suggestedPlatforms: ["xiaohongshu", "instagram"] as SuggestedPlatform[],
    },
  ];
}

export function ContentRepurposerAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [projects, setProjects] = useState<ContentRepurposerProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetRevision, setAssetRevision] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getContentRepurposerProjects();
      setProjects(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeContentRepurposer(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const bump = () => setAssetRevision((value) => value + 1);
    const off = subscribeCreatorAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<ContentRepurposerPrefill>).detail;
      const id = createContentRepurposerProject({
        title: detail?.title ?? "",
        sourceType: detail?.sourceType ?? "youtube",
        audience: detail?.audience ?? "",
        goal: detail?.goal ?? "",
        sourceContent: detail?.sourceContent ?? "",
        workflowSource: detail?.workflowSource ?? "",
        workflowNextStep: detail?.workflowNextStep ?? "",
        ...buildCreatorWorkflowMeta(detail),
      });
      setSelectedId(id);
      showToast("已带入 repurpose 上下文", "ok");
    };
    window.addEventListener("openclaw:content-repurposer-prefill", onPrefill);
    return () =>
      window.removeEventListener("openclaw:content-repurposer-prefill", onPrefill);
  }, [showToast]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!projectId) return;
      const targetProject = getContentRepurposerProjects().find((project) => project.id === projectId);
      if (!targetProject) return;
      setSelectedId(targetProject.id);
      showToast("已定位到内容拆解项目", "ok");
    };
    window.addEventListener("openclaw:content-repurposer-select", onSelect);
    return () =>
      window.removeEventListener("openclaw:content-repurposer-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );
  const currentCreatorAsset = useMemo(() => {
    void assetRevision;
    return getCreatorAssetByWorkflowRunId(selected?.workflowRunId);
  }, [assetRevision, selected?.workflowRunId]);
  const contentBlocks = useMemo(
    () => parseContentPackBlocks(selected?.contentPack ?? ""),
    [selected?.contentPack],
  );
  const surfaceRecommendation = useMemo(
    () => buildContentRepurposerSurfaceRecommendation({ project: selected, asset: currentCreatorAsset }),
    [currentCreatorAsset, selected],
  );

  const patchSelected = (
    patch: Partial<Omit<ContentRepurposerProject, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateContentRepurposerProject(selected.id, patch);
  };

  const createNew = () => {
    const id = createContentRepurposerProject();
    setSelectedId(id);
    showToast("已新增 repurpose pack", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeContentRepurposerProject(selected.id);
    setSelectedId(null);
    showToast("repurpose pack 已删除", "ok");
  };

  const ensureWorkflowForSelected = (triggerType?: WorkflowTriggerType) => {
    if (!selected) return null;
    const resolvedTriggerType = triggerType ?? getDefaultTriggerType(selected);
    if (selected.workflowRunId) return selected.workflowRunId;
    const scenario = getCreatorWorkflowScenario();
    if (!scenario) return null;
    const runId = startWorkflowRun(scenario, resolvedTriggerType);
    advanceWorkflowRun(runId);
    patchSelected({
      workflowRunId: runId,
      workflowScenarioId: scenario.id,
      workflowStageId: "repurpose",
      workflowTriggerType: resolvedTriggerType,
      workflowSource: "来自 Content Repurposer 的手动内容拆解",
      workflowNextStep: "先生成多平台内容包，再挑一条送去 Publisher 做发布前检查。",
      workflowOriginApp: selected.workflowOriginApp ?? "content_repurposer",
      workflowOriginId: selected.workflowOriginId ?? selected.id,
      workflowOriginLabel:
        selected.workflowOriginLabel ?? selected.title ?? "内容拆解项目",
      workflowAudience: selected.workflowAudience ?? selected.audience,
      workflowPrimaryAngle:
        selected.workflowPrimaryAngle ??
        extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
      workflowSourceSummary: selected.workflowSourceSummary ?? buildRepurposerSourceSummary(selected),
      workflowSuggestedPlatforms: selected.workflowSuggestedPlatforms ?? ["xiaohongshu", "douyin"],
      workflowPublishNotes: selected.workflowPublishNotes ?? buildRepurposerPublishNotes(selected),
    });
    upsertCreatorAsset(runId, {
      scenarioId: scenario.id,
      repurposerProjectId: selected.id,
      topic: selected.title,
      audience: selected.audience,
      primaryAngle: extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
      latestDigest: selected.sourceContent,
      nextAction: "先生成多平台内容包，再挑一个版本进入 Publisher。",
      publishStatus: "repurpose_started",
      status: "repurposing",
    });
    return runId;
  };

  const generatePack = async () => {
    if (!selected) {
      showToast("请先选择项目", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const fallback = buildLocalPack(selected);
    const taskId = createTask({
      name: "Assistant - Content Repurposer",
      status: "running",
      detail: selected.title,
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
      workflowStageId: "repurpose",
      workflowSource: "Content Repurposer 生成多平台内容包",
      workflowNextStep: "从内容包中挑 1 个版本进入 Publisher 做预演。",
      workflowTriggerType: selected.workflowTriggerType ?? "manual",
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Content Repurposer 助手。请把用户提供的长内容素材，改写成一份中文多平台内容包。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 至少输出短视频口播、社媒帖子、newsletter 摘要三部分。\n" +
        "2) 结构清晰，可直接继续编辑或发布。\n" +
        "3) 风格贴合目标受众和目标。\n\n" +
        `标题：${selected.title}\n` +
        `来源类型：${selected.sourceType}\n` +
        `目标受众：${selected.audience || "(未填)"}\n` +
        `目标：${selected.goal || "(未填)"}\n` +
        `源内容：\n${selected.sourceContent || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-content-repurposer",
        timeoutSeconds: 90,
      });
      const nextPack = text || fallback;
      const run = runId ? getWorkflowRun(runId) : null;
      patchSelected({
        contentPack: nextPack,
        workflowRunId: runId ?? selected.workflowRunId,
        workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
        workflowStageId: run?.currentStageId === "repurpose" ? "preflight" : selected.workflowStageId,
        workflowSource: "Content Repurposer 已生成多平台内容包",
        workflowNextStep: "从内容包里挑 1 个最适合本轮发布的平台版本，送去 Publisher 做预演。",
      });
      if (runId) {
        upsertCreatorAsset(runId, {
          scenarioId: "creator-studio",
          repurposerProjectId: selected.id,
          topic: selected.title,
          audience: selected.audience,
          primaryAngle: extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
          latestDigest: selected.sourceContent,
          latestPack: nextPack,
          nextAction: "进入 Publisher 检查标题、CTA 和平台适配，再决定是否自动发布。",
          publishStatus: "preflight_pending",
          status: "preflight",
        });
        if (run?.currentStageId === "repurpose") {
          advanceWorkflowRun(runId);
        }
      }
      updateTask(taskId, { status: "done" });
      showToast("内容包已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({
        contentPack: fallback,
        workflowSource: "Content Repurposer 本地兜底生成内容包",
        workflowNextStep: "建议人工检查内容包后，再送入 Publisher。",
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地内容包", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePack = () => {
    if (!selected?.contentPack.trim()) {
      showToast("请先生成内容包", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Repurpose"} Pack`,
      body: selected.contentPack,
      tags: ["repurpose", selected.sourceType],
      source: "import",
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: selected.workflowStageId,
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: selected.workflowSource,
      workflowNextStep: selected.workflowNextStep,
      workflowOriginApp: selected.workflowOriginApp ?? "content_repurposer",
      workflowOriginId: selected.workflowOriginId ?? selected.id,
      workflowOriginLabel: selected.workflowOriginLabel ?? selected.title ?? "内容拆解项目",
      workflowAudience: selected.workflowAudience ?? selected.audience,
      workflowPrimaryAngle:
        selected.workflowPrimaryAngle ??
        extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
      workflowSourceSummary: selected.workflowSourceSummary ?? buildRepurposerSourceSummary(selected),
      workflowSuggestedPlatforms: selected.workflowSuggestedPlatforms ?? ["xiaohongshu", "douyin"],
      workflowPublishNotes: selected.workflowPublishNotes ?? buildRepurposerPublishNotes(selected),
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToPublisher = () => {
    if (!selected?.contentPack.trim()) {
      showToast("请先生成内容包", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    const run = runId ? getWorkflowRun(runId) : null;
    const nextStep = "在 Publisher 里先做预演，确认标题、CTA 和平台差异后再决定是否自动发布。";
    patchSelected({
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
      workflowStageId: run?.currentStageId === "repurpose" ? "preflight" : selected.workflowStageId ?? "preflight",
      workflowSource: "来自 Content Repurposer 的发布候选稿",
      workflowNextStep: nextStep,
      workflowOriginApp: "content_repurposer",
      workflowOriginId: selected.id,
      workflowOriginLabel: selected.title || "发布候选稿",
      workflowAudience: selected.audience,
      workflowPrimaryAngle: extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
      workflowSourceSummary: buildRepurposerSourceSummary(selected),
      workflowSuggestedPlatforms: selected.workflowSuggestedPlatforms ?? ["xiaohongshu", "douyin"],
      workflowPublishNotes: buildRepurposerPublishNotes(selected),
    });
    if (runId) {
      if (run?.currentStageId === "repurpose") {
        advanceWorkflowRun(runId);
      }
      upsertCreatorAsset(runId, {
        scenarioId: "creator-studio",
        repurposerProjectId: selected.id,
        topic: selected.title,
        audience: selected.audience,
        primaryAngle: extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
        latestDigest: selected.sourceContent,
        latestPack: selected.contentPack,
        nextAction: nextStep,
        publishStatus: "preflight_pending",
        status: "preflight",
      });
    }
    const draftId = createDraft({
      title: `${selected.title || "Repurpose"} Publish Pack`,
      body: selected.contentPack,
      tags: ["repurpose", "publish-ready", selected.sourceType],
      source: "import",
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
      workflowStageId: run?.currentStageId === "repurpose" ? "preflight" : selected.workflowStageId ?? "preflight",
      workflowTriggerType: selected.workflowTriggerType ?? "manual",
      workflowSource: selected.workflowSource || "来自 Content Repurposer 的发布候选稿",
      workflowNextStep: nextStep,
      workflowOriginApp: "content_repurposer",
      workflowOriginId: selected.id,
      workflowOriginLabel: selected.title || "发布候选稿",
      workflowAudience: selected.audience,
      workflowPrimaryAngle: extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
      workflowSourceSummary: buildRepurposerSourceSummary(selected),
      workflowSuggestedPlatforms: selected.workflowSuggestedPlatforms ?? ["xiaohongshu", "douyin"],
      workflowPublishNotes: buildRepurposerPublishNotes(selected),
    });
    requestOpenPublisher({
      draftId,
      platforms: ["xiaohongshu", "douyin"],
      dispatchMode: "dry-run",
      workflowSource: selected.workflowSource || "来自 Content Repurposer 的发布候选稿",
      workflowNextStep: "建议先做预演，检查平台版本、CTA 和收据，再决定是否自动发布。",
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "creator-studio",
      workflowStageId: run?.currentStageId === "repurpose" ? "preflight" : selected.workflowStageId ?? "preflight",
      workflowTriggerType: selected.workflowTriggerType ?? "manual",
      workflowOriginApp: "content_repurposer",
      workflowOriginId: selected.id,
      workflowOriginLabel: selected.title || "发布候选稿",
      workflowAudience: selected.audience,
      workflowPrimaryAngle: extractLeadLine(selected.sourceContent, selected.title || "内容主线"),
      workflowSourceSummary: buildRepurposerSourceSummary(selected),
      workflowSuggestedPlatforms: ["xiaohongshu", "douyin"],
      workflowPublishNotes: buildRepurposerPublishNotes(selected),
    });
    showToast("已存草稿并打开发布中心", "ok");
  };

  const copyBlock = async (block: ContentPackBlock) => {
    try {
      await navigator.clipboard.writeText(block.body);
      showToast(`已复制：${block.label}`, "ok");
    } catch {
      showToast("复制失败", "error");
    }
  };

  const saveBlockDraft = (block: ContentPackBlock) => {
    if (!selected) return;
    createDraft({
      title: `${selected.title || "Repurpose"} · ${block.label}`,
      body: block.body,
      tags: ["repurpose", "section", selected.sourceType, ...block.suggestedPlatforms],
      source: "import",
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: selected.workflowStageId,
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: selected.workflowSource || "来自 Content Repurposer 的独立内容块",
      workflowNextStep: `把「${block.label}」作为单独版本继续编辑，或送进 Publisher 做预演。`,
      workflowOriginApp: "content_repurposer",
      workflowOriginId: selected.id,
      workflowOriginLabel: selected.title || block.label,
      workflowAudience: selected.audience,
      workflowPrimaryAngle: extractLeadLine(block.body, selected.title || "内容主线"),
      workflowSourceSummary: block.body,
      workflowBlockLabel: block.label,
      workflowSuggestedPlatforms: block.suggestedPlatforms,
      workflowPublishNotes: buildRepurposerPublishNotes(selected, {
        blockLabel: block.label,
        suggestedPlatforms: block.suggestedPlatforms,
      }),
    });
    showToast(`已保存片段：${block.label}`, "ok");
  };

  const sendBlockToPublisher = (block: ContentPackBlock) => {
    if (!selected) return;
    const draftId = createDraft({
      title: `${selected.title || "Repurpose"} · ${block.label}`,
      body: block.body,
      tags: ["repurpose", "publish-ready", selected.sourceType, ...block.suggestedPlatforms],
      source: "import",
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: selected.workflowStageId,
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: selected.workflowSource || `来自 Content Repurposer 的「${block.label}」`,
      workflowNextStep: `先在 Publisher 里预演「${block.label}」版本，再决定是否进入自动发布。`,
      workflowOriginApp: "content_repurposer",
      workflowOriginId: selected.id,
      workflowOriginLabel: selected.title || block.label,
      workflowAudience: selected.audience,
      workflowPrimaryAngle: extractLeadLine(block.body, selected.title || "内容主线"),
      workflowSourceSummary: block.body,
      workflowBlockLabel: block.label,
      workflowSuggestedPlatforms: block.suggestedPlatforms,
      workflowPublishNotes: buildRepurposerPublishNotes(selected, {
        blockLabel: block.label,
        suggestedPlatforms: block.suggestedPlatforms,
      }),
    });
    requestOpenPublisher({
      draftId,
      platforms: block.suggestedPlatforms,
      dispatchMode: "dry-run",
      workflowSource: selected.workflowSource || `来自 Content Repurposer 的「${block.label}」`,
      workflowNextStep: `先在 Publisher 预演「${block.label}」，核对完再投递。`,
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: selected.workflowStageId,
      workflowTriggerType: selected.workflowTriggerType,
      workflowOriginApp: "content_repurposer",
      workflowOriginId: selected.id,
      workflowOriginLabel: selected.title || block.label,
      workflowAudience: selected.audience,
      workflowPrimaryAngle: extractLeadLine(block.body, selected.title || "内容主线"),
      workflowSourceSummary: block.body,
      workflowSuggestedPlatforms: block.suggestedPlatforms,
      workflowPublishNotes: buildRepurposerPublishNotes(selected, {
        blockLabel: block.label,
        suggestedPlatforms: block.suggestedPlatforms,
      }),
    });
    showToast(`已发送片段到发布中心：${block.label}`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Content Repurposer"
      icon={RefreshCw}
      widthClassName="w-[1240px]"
      storageKey="openclaw.window.content_repurposer"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Content Repurposer / Long-form to Shorts
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                对应高频内容生产场景：把长视频、播客、文章拆成短视频、帖子和 newsletter。
              </p>
            </div>
            <Badge variant="default" size="md">
              projects {projects.length}
            </Badge>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <CreatorHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.title || "未命名内容包"} · 内容拆解阶段` : "Content Repurposer · Hero Workflow"}
            description="这一层负责把选题或长内容真正变成可投递的执行版本，让用户看到的不是工具，而是一条会继续流动的内容生产链。"
            emptyHint="当内容是从 Creator Radar 送过来时，这里会显示同一条内容工作流的运行状态。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: "生成内容包",
                onClick: generatePack,
                disabled: !selected || isGenerating,
              },
              {
                label: "送去 Publisher",
                onClick: sendToPublisher,
                disabled: !selected || !selected?.contentPack.trim(),
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <Card padding="md">
                <CardHeader
                  title="Repurpose packs"
                  actions={
                    <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={createNew}>
                      新建
                    </Button>
                  }
                />
                <CardBody spacing="sm">
                  {projects.length > 0 ? (
                    projects.map((project) => {
                      const isActive = project.id === selectedId;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => setSelectedId(project.id)}
                          className={[
                            "w-full rounded-xl border p-3 text-left transition-all",
                            isActive
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-gray-900">{project.title}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            {project.sourceType}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                      还没有 repurpose pack。
                    </div>
                  )}
                </CardBody>
              </Card>
            </aside>

            <main className="space-y-6">
              <Card padding="lg">
                {selected ? (
                  <>
                    <CardHeader
                      title="源内容"
                      subtitle="填长内容摘要、逐字稿或观点笔记，再生成多平台内容包。"
                      actions={
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={deleteSelected}
                        >
                          删除
                        </Button>
                      }
                    />
                    <CardBody spacing="md">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Input
                          label="主题 / 项目名"
                          value={selected.title}
                          onChange={(e) => patchSelected({ title: e.target.value })}
                          placeholder="主题 / 项目名"
                          fullWidth
                        />
                        <div className="space-y-2">
                          <label htmlFor="source-type-select" className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                            来源类型
                          </label>
                          <select
                            id="source-type-select"
                            value={selected.sourceType}
                            onChange={(e) =>
                              patchSelected({ sourceType: e.target.value as RepurposeSourceType })
                            }
                            style={{
                              width: "100%",
                              borderRadius: designTokens.borderRadius.xl,
                              border: `1px solid ${designTokens.colors.default.border}`,
                              padding: "10px 16px",
                              fontSize: "14px",
                              outline: "none",
                            }}
                          >
                            {sourceTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Input
                          label="目标受众"
                          value={selected.audience}
                          onChange={(e) => patchSelected({ audience: e.target.value })}
                          placeholder="目标受众"
                          fullWidth
                        />
                        <Input
                          label="目标"
                          value={selected.goal}
                          onChange={(e) => patchSelected({ goal: e.target.value })}
                          placeholder="例如 导流、教育、涨粉"
                          fullWidth
                        />
                        <div className="md:col-span-2">
                          <Textarea
                            label="源内容"
                            value={selected.sourceContent}
                            onChange={(e) => patchSelected({ sourceContent: e.target.value })}
                            placeholder="粘贴逐字稿、摘要、show notes、直播纪要或文章正文"
                            rows={11}
                            fullWidth
                          />
                        </div>
                      </div>

                      {selected.workflowSource || selected.workflowNextStep ? (
                        <div
                          style={{
                            borderRadius: "24px",
                            border: "1px solid #DBEAFE",
                            background: "linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)",
                            padding: "16px",
                            marginTop: "16px",
                          }}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <ArrowRight className="h-4 w-4 text-blue-600" />
                            内容流程上下文
                          </div>
                          {selected.workflowSource ? (
                            <div className="mt-3 text-sm leading-6 text-gray-700">
                              <span className="font-semibold text-gray-900">来源：</span>
                              {selected.workflowSource}
                            </div>
                          ) : null}
                          {selected.workflowNextStep ? (
                            <div className="mt-2 text-sm leading-6 text-gray-700">
                              <span className="font-semibold text-gray-900">建议下一步：</span>
                              {selected.workflowNextStep}
                            </div>
                          ) : null}
                          {selected.workflowOriginApp || selected.workflowPrimaryAngle || selected.workflowAudience ? (
                            <div className="mt-3 grid gap-2 text-xs leading-5 text-gray-600 sm:grid-cols-2">
                              {selected.workflowOriginApp ? (
                                <div>
                                  <span className="font-semibold text-gray-900">来源应用：</span>
                                  {getCreatorWorkflowOriginLabel(selected.workflowOriginApp)}
                                </div>
                              ) : null}
                              {selected.workflowAudience ? (
                                <div>
                                  <span className="font-semibold text-gray-900">目标受众：</span>
                                  {selected.workflowAudience}
                                </div>
                              ) : null}
                              {selected.workflowPrimaryAngle ? (
                                <div className="sm:col-span-2">
                                  <span className="font-semibold text-gray-900">主打角度：</span>
                                  {selected.workflowPrimaryAngle}
                                </div>
                              ) : null}
                              {selected.workflowSuggestedPlatforms?.length ? (
                                <div className="sm:col-span-2">
                                  <span className="font-semibold text-gray-900">建议平台：</span>
                                  {selected.workflowSuggestedPlatforms.join(" / ")}
                                </div>
                              ) : null}
                              {selected.workflowPublishNotes ? (
                                <div className="sm:col-span-2">
                                  <span className="font-semibold text-gray-900">发布备注：</span>
                                  {selected.workflowPublishNotes}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </CardBody>
                  </>
                ) : (
                  <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                    先新建一个 repurpose pack。
                  </div>
                )}
              </Card>

              <Card padding="lg">
                <CardHeader
                  title="多平台内容包"
                  subtitle="生成短视频口播、社媒帖子和 newsletter 摘要，便于继续编辑和发布。"
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Sparkles className="h-4 w-4" />}
                        onClick={generatePack}
                        disabled={!selected || isGenerating}
                        loading={isGenerating}
                      >
                        {isGenerating ? "生成中..." : "生成内容包"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<FilePlus2 className="h-4 w-4" />}
                        onClick={savePack}
                      >
                        存草稿
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        icon={<RefreshCw className="h-4 w-4" />}
                        onClick={sendToPublisher}
                      >
                        发到发布中心
                      </Button>
                    </div>
                  }
                />
                <CardBody spacing="md">
                  <RecommendationResultBody
                    recommendation={surfaceRecommendation}
                    tone="emerald"
                    actionTitle="执行建议"
                    actionButtonLabel="查看当前内容项目"
                    maxHitsPerSection={2}
                  />
                  <Textarea
                    value={selected?.contentPack ?? ""}
                    onChange={(e) => patchSelected({ contentPack: e.target.value })}
                    placeholder="这里会生成适合多个平台继续加工或发布的内容包。"
                    rows={17}
                    fullWidth
                  />
                </CardBody>
              </Card>

              <Card padding="lg">
                <CardHeader
                  title="可直接投递的内容块"
                  subtitle="系统会根据标题段落拆出可操作模块。你可以只挑一个版本送去 Publisher，而不是整包一起发。"
                  actions={
                    <Badge variant="default" size="sm">
                      {contentBlocks.length} 个可操作片段
                    </Badge>
                  }
                />
                <CardBody>
                  {contentBlocks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                      先生成内容包。生成后会自动拆出短视频、社媒、newsletter 等独立片段。
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      {contentBlocks.map((block) => (
                        <div
                          key={block.id}
                          style={{
                            borderRadius: "24px",
                            border: `1px solid ${designTokens.colors.default.border}`,
                            background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
                            padding: "16px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{block.label}</div>
                              <div className="mt-1 text-xs text-gray-500">{block.summary}</div>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {block.suggestedPlatforms.map((platform) => (
                                <span
                                  key={platform}
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                                >
                                  {platform}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-50 px-3 py-3 text-xs leading-6 text-gray-700">
                            {block.body}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Copy className="h-3.5 w-3.5" />}
                              onClick={() => {
                                void copyBlock(block);
                              }}
                            >
                              复制片段
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<FilePlus2 className="h-3.5 w-3.5" />}
                              onClick={() => saveBlockDraft(block)}
                            >
                              存独立草稿
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              icon={<Send className="h-3.5 w-3.5" />}
                              onClick={() => sendBlockToPublisher(block)}
                            >
                              送去 Publisher
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </main>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
