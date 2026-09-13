"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Copy, RefreshCw, RotateCcw, Send, Share2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import { CreatorHeroWorkflowPanel } from "@/components/workflows/CreatorHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { AppToast } from "@/components/AppToast";
import { useTimedToast } from "@/hooks/useTimedToast";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { upsertCreatorAsset } from "@/lib/creator-assets";
import { buildCreatorPublishFeedback } from "@/lib/creator-publish-feedback";
import {
  getCreatorWorkflowOriginLabel,
  type CreatorWorkflowMeta,
} from "@/lib/creator-workflow";
import {
  createDraft,
  getDrafts,
  removeDraft,
  subscribeDrafts,
  updateDraft,
  type DraftId,
  type DraftRecord,
} from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  analyzePublishReadiness,
  type ChecklistStatus,
  type PlatformAdvice,
} from "@/lib/publish-recommendation";
import {
  createPublishJob,
  getPublishJobs,
  removePublishJob,
  refreshPublishJobs,
  subscribePublish,
  updatePublishJob,
  type PublishJobId,
  type PublishJobRecord,
  type PublishJobResult,
  type PublishPlatformId,
} from "@/lib/publish";
import {
  getPublishConfig,
  refreshPublishConfig,
  savePublishConfig,
  subscribePublishConfig,
} from "@/lib/publish-config";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenSettings, type PublisherPrefill } from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  completeWorkflowRun,
  getWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

const platforms: Array<{ id: PublishPlatformId; name: string; supported?: boolean }> = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  { id: "wechat", name: "公众号", supported: false },
  { id: "twitter", name: "X(Twitter)", supported: false },
  { id: "linkedin", name: "LinkedIn", supported: false },
  { id: "storefront", name: "独立站", supported: false },
];

function getModeLabel(mode: PublishJobRecord["mode"]) {
  return mode === "dispatch" ? "自动发布" : "安全预演";
}

function formatPlatformNames(values: PublishPlatformId[]) {
  return values.map((platform) => getPlatformLabel(platform)).join(" / ");
}

function getJobStatusMeta(status: PublishJobRecord["status"]) {
  switch (status) {
    case "queued":
      return { label: "排队中", variant: "warning" as const };
    case "running":
      return { label: "执行中", variant: "info" as const };
    case "done":
      return { label: "已完成", variant: "success" as const };
    case "error":
      return { label: "失败", variant: "danger" as const };
    case "stopped":
      return { label: "已停止", variant: "default" as const };
  }
}

function formatTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function getPlatformLabel(platform: PublishPlatformId) {
  return platforms.find((item) => item.id === platform)?.name ?? platform;
}

type JobFilterId = "all" | "active" | "failed" | "done";

const jobFilters: Array<{ id: JobFilterId; label: string }> = [
  { id: "all", label: "全部" },
  { id: "active", label: "进行中" },
  { id: "failed", label: "失败" },
  { id: "done", label: "完成" },
];

function getChecklistStatusMeta(status: ChecklistStatus) {
  switch (status) {
    case "ok":
      return { label: "通过", variant: "success" as const };
    case "warn":
      return { label: "建议调整", variant: "warning" as const };
    case "risk":
      return { label: "高风险", variant: "danger" as const };
  }
}

export function PublisherAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [jobs, setJobs] = useState<PublishJobRecord[]>([]);
  const [selectedId, setSelectedId] = useState<DraftId | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<PublishJobId | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PublishPlatformId[]>(() => ["xiaohongshu", "douyin"]);
  const [resultText, setResultText] = useState("");
  const [lastResults, setLastResults] = useState<PublishJobResult[] | null>(null);
  const [connByPlatform, setConnByPlatform] = useState<Record<string, { token: string; webhookUrl: string }>>({});
  const [dispatchMode, setDispatchMode] = useState<"dry-run" | "dispatch">("dry-run");
  const [connectorOnline, setConnectorOnline] = useState<null | boolean>(null);
  const [queueAuthRequired, setQueueAuthRequired] = useState<null | boolean>(null);
  const [jobFilter, setJobFilter] = useState<JobFilterId>("all");
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const [workflowRunId, setWorkflowRunId] = useState<string | undefined>();
  const [workflowScenarioId, setWorkflowScenarioId] = useState<string | undefined>();
  const { toast, showToast } = useTimedToast(2200);

  const applyWorkflowContext = useCallback((context?: CreatorWorkflowMeta | null) => {
    setWorkflowRunId(context?.workflowRunId);
    setWorkflowScenarioId(context?.workflowScenarioId);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    setDrafts(getDrafts());
    setJobs(getPublishJobs());
    void refreshPublishJobs();
    const unsubDrafts = subscribeDrafts(() => setDrafts(getDrafts()));
    const unsubPublish = subscribePublish(() => setJobs(getPublishJobs()));
    return () => {
      unsubDrafts();
      unsubPublish();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const apply = () => {
      setConnByPlatform(getPublishConfig());
    };
    apply();
    void refreshPublishConfig();
    const unsubConfig = subscribePublishConfig(apply);
    return () => {
      unsubConfig();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (drafts.length === 0) {
      setSelectedId(null);
      setTitle("");
      setBody("");
      applyWorkflowContext(null);
      return;
    }
    if (selectedId && drafts.some((draft) => draft.id === selectedId)) return;
    const first = drafts[0];
    setSelectedId(first.id);
    setTitle(first.title);
    setBody(first.body);
    applyWorkflowContext(first);
  }, [applyWorkflowContext, drafts, isVisible, selectedId]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<PublisherPrefill>).detail;
      const targetDraft = detail?.draftId ? getDrafts().find((draft) => draft.id === detail.draftId) ?? null : null;

      if (targetDraft) {
        setSelectedId(targetDraft.id);
        setTitle(targetDraft.title);
        setBody(targetDraft.body);
        applyWorkflowContext(targetDraft);
      } else {
        setSelectedId(null);
        setTitle(detail?.title ?? "");
        setBody(detail?.body ?? "");
        applyWorkflowContext(detail);
      }

      if (detail?.platforms?.length) {
        setSelectedPlatforms(detail.platforms);
      }
      if (detail?.dispatchMode) {
        setDispatchMode(detail.dispatchMode);
      }
      setResultText("");
      setLastResults(null);
      showToast("已带入发布上下文", "ok");
    };

    window.addEventListener("openclaw:publisher-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:publisher-prefill", onPrefill);
  }, [applyWorkflowContext, showToast]);

  const selectedDraft = useMemo(() => {
    if (!selectedId) return null;
    return drafts.find((draft) => draft.id === selectedId) ?? null;
  }, [drafts, selectedId]);

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }, [jobs, selectedJobId]);

  const isDispatching = useMemo(
    () => jobs.some((job) => job.status === "running"),
    [jobs],
  );

  const queueSummary = useMemo(() => {
    const queued = jobs.filter((job) => job.status === "queued").length;
    const running = jobs.filter((job) => job.status === "running").length;
    const failed = jobs.filter((job) => job.status === "error").length;
    const done = jobs.filter((job) => job.status === "done").length;
    return { queued, running, failed, done };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    switch (jobFilter) {
      case "active":
        return jobs.filter((job) => job.status === "queued" || job.status === "running");
      case "failed":
        return jobs.filter((job) => job.status === "error");
      case "done":
        return jobs.filter((job) => job.status === "done");
      default:
        return jobs;
    }
  }, [jobFilter, jobs]);

  const publishInsights = useMemo(
    () =>
      analyzePublishReadiness({
        title,
        body,
        platforms: selectedPlatforms,
        dispatchMode,
        connections: connByPlatform,
      }),
    [title, body, selectedPlatforms, dispatchMode, connByPlatform],
  );

  const togglePlatform = (id: PublishPlatformId) => {
    setSelectedPlatforms((prev) => (prev.includes(id) ? prev.filter((platform) => platform !== id) : [...prev, id]));
  };

  const onSelectDraft = (draftId: DraftId) => {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;
    setSelectedId(draftId);
    setTitle(draft.title);
    setBody(draft.body);
    applyWorkflowContext(draft);
    setResultText("");
    setLastResults(null);
  };

  const refreshJobsPanel = async () => {
    setJobsRefreshing(true);
    try {
      await refreshPublishJobs();
    } finally {
      setJobsRefreshing(false);
    }
  };

  const saveCurrent = () => {
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    if (!nextBody) return;
    if (!selectedId) {
      const draftId = createDraft({
        title: nextTitle,
        body: nextBody,
        tags: selectedPlatforms,
        source: "publisher",
        workflowRunId,
        workflowScenarioId,
      });
      setSelectedId(draftId);
      showToast("草稿已创建", "ok");
      return;
    }
    updateDraft(selectedId, {
      title: nextTitle,
      body: nextBody,
      tags: selectedPlatforms,
      workflowRunId,
      workflowScenarioId,
    });
    showToast("草稿已保存", "ok");
  };

  const dispatch = async () => {
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    if (!nextBody || selectedPlatforms.length === 0) {
      showToast("请填写内容并选择平台", "error");
      return;
    }

    const draftId = (() => {
      if (!selectedId) {
        const id = createDraft({
          title: nextTitle,
          body: nextBody,
          tags: selectedPlatforms,
          source: "publisher",
          workflowRunId,
          workflowScenarioId,
        });
        setSelectedId(id);
        return id;
      }
      updateDraft(selectedId, {
        title: nextTitle,
        body: nextBody,
        tags: selectedPlatforms,
        workflowRunId,
        workflowScenarioId,
      });
      return selectedId;
    })();

    setResultText("已加入队列，等待执行…");
    setLastResults(null);

    try {
      const jobId = await createPublishJob({
        draftId,
        draftTitle: nextTitle,
        draftBody: nextBody,
        platforms: selectedPlatforms,
        mode: dispatchMode,
        status: "queued",
        maxAttempts: dispatchMode === "dry-run" ? 1 : 3,
      });
      setSelectedJobId(jobId);
      showToast(`${getModeLabel(dispatchMode)}已进入队列`, "ok");

      if (workflowRunId) {
        const run = getWorkflowRun(workflowRunId);
        if (run?.currentStageId === "preflight") {
          advanceWorkflowRun(workflowRunId);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "提交失败";
      showToast(errorMessage, "error");
      setResultText(`提交失败：${errorMessage}`);
    }
  };

  const deleteDraft = () => {
    if (!selectedId) return;
    removeDraft(selectedId);
    setSelectedId(null);
    setTitle("");
    setBody("");
    showToast("草稿已删除", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="矩阵发布中心"
      icon={Share2}
      widthClassName="w-[1200px]"
      storageKey="openclaw.window.publisher"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Multi-Platform Publisher</h1>
              <p className="mt-1 text-sm text-gray-500">
                统一多平台内容发布，支持安全预演和自动发布两种模式。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" size="md">
                队列 {queueSummary.queued}
              </Badge>
              <Badge variant="success" size="md">
                完成 {queueSummary.done}
              </Badge>
              {queueSummary.failed > 0 && (
                <Badge variant="danger" size="md">
                  失败 {queueSummary.failed}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {workflowRunId && (
          <CreatorHeroWorkflowPanel
            workflowRunId={workflowRunId}
            title="Creator Hero Workflow · 发布与复用阶段"
            description="Publisher 负责把内容推到队列，再根据回执确认哪些版本值得复用沉淀。"
            emptyHint="当内容是从其他 app 送过来时，这里会显示所属 Creator Hero Workflow。"
            source="Publisher 已接收内容并进入发布队列"
            nextStep="等待平台回执与收据，再确认哪些结构值得复用沉淀。"
            actions={[
              {
                label: "查看草稿",
                onClick: () => selectedId && onSelectDraft(selectedId),
                disabled: !selectedId,
              },
            ]}
          />
        )}

        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="草稿列表"
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedId(null);
                      setTitle("");
                      setBody("");
                      showToast("已创建新草稿", "ok");
                    }}
                  >
                    新建
                  </Button>
                }
              />
              <CardBody spacing="sm">
                {drafts.length > 0 ? (
                  drafts.slice(0, 10).map((draft) => {
                    const isActive = draft.id === selectedId;
                    return (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => onSelectDraft(draft.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          isActive
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 bg-white hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold text-gray-900">{draft.title}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {draft.tags?.slice(0, 3).map(getPlatformLabel).join(" · ")}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    还没有草稿。
                  </div>
                )}
              </CardBody>
            </Card>
          </aside>

          <main className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="内容编辑"
                subtitle="填写标题和正文，选择目标平台。"
                actions={
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={deleteDraft}
                    disabled={!selectedId}
                  >
                    删除
                  </Button>
                }
              />
              <CardBody spacing="md">
                <Input
                  label="标题"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入内容标题..."
                  fullWidth
                />
                <Textarea
                  label="正文"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="输入内容正文..."
                  rows={12}
                  fullWidth
                />

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    目标平台
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {platforms.filter((p) => p.supported !== false).map((platform) => (
                      <Button
                        key={platform.id}
                        variant={selectedPlatforms.includes(platform.id) ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => togglePlatform(platform.id)}
                      >
                        {platform.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    发布模式
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={dispatchMode === "dry-run" ? "primary" : "secondary"}
                      size="md"
                      onClick={() => setDispatchMode("dry-run")}
                    >
                      安全预演
                    </Button>
                    <Button
                      variant={dispatchMode === "dispatch" ? "success" : "secondary"}
                      size="md"
                      onClick={() => setDispatchMode("dispatch")}
                    >
                      自动发布
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={saveCurrent}
                    disabled={!body.trim()}
                  >
                    保存草稿
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={Send}
                    onClick={dispatch}
                    disabled={!body.trim() || selectedPlatforms.length === 0 || isDispatching}
                  >
                    {getModeLabel(dispatchMode)}
                  </Button>
                </div>
              </CardBody>
            </Card>

            <Card padding="md">
              <CardHeader
                title="发布队列"
                subtitle="查看已提交的发布任务及其状态。"
                actions={
                  <div className="flex gap-2">
                    {jobFilters.map((filter) => (
                      <Button
                        key={filter.id}
                        variant={jobFilter === filter.id ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setJobFilter(filter.id)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      onClick={refreshJobsPanel}
                      disabled={jobsRefreshing}
                      loading={jobsRefreshing}
                    >
                      刷新
                    </Button>
                  </div>
                }
              />
              <CardBody spacing="sm">
                {filteredJobs.length > 0 ? (
                  <div className="space-y-2">
                    {filteredJobs.slice(0, 10).map((job) => {
                      const statusMeta = getJobStatusMeta(job.status);
                      return (
                        <div
                          key={job.id}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {job.draftTitle}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {formatPlatformNames(job.platforms)} · {getModeLabel(job.mode)}
                              </div>
                            </div>
                            <Badge variant={statusMeta.variant} size="sm">
                              {statusMeta.label}
                            </Badge>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            {formatTime(job.createdAt)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                    {jobFilter === "all" ? "还没有发布任务" : `没有${jobFilters.find((f) => f.id === jobFilter)?.label}的任务`}
                  </div>
                )}
              </CardBody>
            </Card>

            {publishInsights && (
              <Card padding="md">
                <CardHeader
                  title="发布检查"
                  subtitle="发布前建议检查以下事项。"
                />
                <CardBody spacing="sm">
                  <div className="space-y-2">
                    {publishInsights.checklist.map((item, index) => {
                      const statusMeta = getChecklistStatusMeta(item.status);
                      return (
                        <div
                          key={index}
                          className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3"
                        >
                          <Badge variant={statusMeta.variant} size="sm">
                            {statusMeta.label}
                          </Badge>
                          <div className="flex-1 text-sm text-gray-700">{item.message}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
