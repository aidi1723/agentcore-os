"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, Headphones, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { RecommendationResultBody } from "@/components/recommendations/RecommendationResultBody";
import { SupportHeroWorkflowPanel } from "@/components/workflows/SupportHeroWorkflowPanel";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent, requestRealityCheck } from "@/lib/openclaw-agent-client";
import { upsertKnowledgeAsset } from "@/lib/knowledge-assets";
import {
  getSupportAssetByWorkflowRunId,
  getSupportAssetForFocus,
  subscribeSupportAssets,
  upsertSupportAsset,
  type SupportAssetRecord,
} from "@/lib/support-assets";
import { buildSupportWorkflowMeta, getSupportWorkflowScenario } from "@/lib/support-workflow";
import {
  createSupportTicket,
  getSupportTickets,
  removeSupportTicket,
  subscribeSupportTickets,
  updateSupportTicket,
  type SupportChannel,
  type SupportStatus,
  type SupportTicket,
} from "@/lib/support";
import { createTask, updateTask } from "@/lib/tasks";
import { buildSupportCopilotSurfaceRecommendation } from "@/lib/workflow-surface-recommendation";
import { requestOpenCrm, requestOpenKnowledgeVault, type SupportCopilotPrefill } from "@/lib/ui-events";
import {
  advanceWorkflowRun,
  completeWorkflowRun,
  getWorkflowRun,
  setWorkflowRunAwaitingHuman,
  startWorkflowRun,
  type WorkflowTriggerType,
} from "@/lib/workflow-runs";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

const channelOptions: Array<{ value: SupportChannel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "reviews", label: "Google Reviews" },
];

const statusOptions: Array<{ value: SupportStatus; label: string }> = [
  { value: "new", label: "新工单" },
  { value: "waiting", label: "等待中" },
  { value: "resolved", label: "已解决" },
];

function buildLocalReply(ticket: SupportTicket) {
  return [
    `给 ${ticket.customer || "客户"} 的建议回复：`,
    `你好，已经收到你关于「${ticket.subject || "当前问题"}」的反馈。`,
    "我们正在核对具体情况，并会优先给出明确处理方案。",
    `下一步建议：${ticket.message.slice(0, 80) || "确认订单/上下文，再给出时间和方案。"}。`,
    "如果方便，也请补充订单号、时间点或截图，这样能更快定位。",
  ].join("\n");
}

function getDefaultTriggerType(ticket: SupportTicket): WorkflowTriggerType {
  return ticket.workflowTriggerType ?? "manual";
}

function hasSupportRecordFocus(detail?: SupportCopilotPrefill | null) {
  return Boolean(detail?.assetId || detail?.sourceKey);
}

function findTicketForSupportAsset(asset: SupportAssetRecord) {
  const tickets = getSupportTickets();
  return (
    tickets.find((ticket) => asset.ticketId && ticket.id === asset.ticketId) ??
    tickets.find((ticket) => ticket.workflowRunId === asset.workflowRunId) ??
    null
  );
}

export function SupportCopilotAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assetRevision, setAssetRevision] = useState(0);
  const [focusRetryRevision, setFocusRetryRevision] = useState(0);
  const [pendingFocus, setPendingFocus] = useState<{
    detail: SupportCopilotPrefill;
    startRevision: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getSupportTickets();
      setTickets(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
      setFocusRetryRevision((value) => value + 1);
    };
    sync();
    const unsub = subscribeSupportTickets(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const resolveSupportRecordFocus = useCallback(
    (detail: SupportCopilotPrefill, reportMissing: boolean) => {
      const asset = getSupportAssetForFocus(detail);
      const targetTicket = asset ? findTicketForSupportAsset(asset) : null;
      if (targetTicket) {
        setSelectedId(targetTicket.id);
        setPendingFocus(null);
        showToast("已定位到客服工单", "ok");
        return true;
      }
      if (reportMissing) {
        setPendingFocus(null);
        showToast("未找到对应客服工单", "error");
      }
      return false;
    },
    [showToast],
  );

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<SupportCopilotPrefill>).detail;
      if (hasSupportRecordFocus(detail)) {
        const resolved = resolveSupportRecordFocus(detail, false);
        if (!resolved) {
          setPendingFocus({ detail, startRevision: focusRetryRevision });
        }
        return;
      }

      const id = createSupportTicket({
        customer: detail?.customer ?? "",
        channel: detail?.channel ?? "email",
        subject: detail?.subject ?? "",
        message: detail?.message ?? "",
        status: detail?.status ?? "new",
        replyDraft: detail?.replyDraft ?? "",
        ...buildSupportWorkflowMeta(detail),
      });
      setSelectedId(id);
      showToast("已带入客服场景上下文", "ok");
    };
    window.addEventListener("openclaw:support-copilot-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:support-copilot-prefill", onPrefill);
  }, [focusRetryRevision, resolveSupportRecordFocus, showToast]);

  useEffect(() => {
    const bump = () => {
      setAssetRevision((value) => value + 1);
      setFocusRetryRevision((value) => value + 1);
    };
    const off = subscribeSupportAssets(bump);
    const onStorage = () => bump();
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!pendingFocus || focusRetryRevision <= pendingFocus.startRevision) return;
    const retryCount = focusRetryRevision - pendingFocus.startRevision;
    resolveSupportRecordFocus(pendingFocus.detail, retryCount >= 2);
  }, [focusRetryRevision, pendingFocus, resolveSupportRecordFocus]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const ticketId = (event as CustomEvent<{ ticketId?: string }>).detail?.ticketId;
      if (!ticketId) return;
      const targetTicket = getSupportTickets().find((ticket) => ticket.id === ticketId);
      if (!targetTicket) return;
      setSelectedId(targetTicket.id);
      showToast("已定位到客服工单", "ok");
    };
    window.addEventListener("openclaw:support-copilot-select", onSelect);
    return () =>
      window.removeEventListener("openclaw:support-copilot-select", onSelect);
  }, [showToast]);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? null,
    [selectedId, tickets],
  );
  const currentSupportAsset = useMemo(() => {
    void assetRevision;
    return getSupportAssetByWorkflowRunId(selected?.workflowRunId);
  }, [assetRevision, selected?.workflowRunId]);
  const surfaceRecommendation = useMemo(
    () => buildSupportCopilotSurfaceRecommendation({ ticket: selected, asset: currentSupportAsset }),
    [currentSupportAsset, selected],
  );

  const patchSelected = (patch: Partial<Omit<SupportTicket, "id" | "createdAt" | "updatedAt">>) => {
    if (!selected) return;
    updateSupportTicket(selected.id, patch);
  };

  const createNewTicket = () => {
    const id = createSupportTicket();
    setSelectedId(id);
    showToast("已新增工单", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeSupportTicket(selected.id);
    setSelectedId(null);
    showToast("工单已删除", "ok");
  };

  const ensureWorkflowForSelected = (triggerType?: WorkflowTriggerType) => {
    if (!selected) return null;
    const resolvedTriggerType = triggerType ?? getDefaultTriggerType(selected);
    if (selected.workflowRunId) return selected.workflowRunId;
    const scenario = getSupportWorkflowScenario();
    if (!scenario) return null;
    const runId = startWorkflowRun(scenario, resolvedTriggerType);
    patchSelected({
      workflowRunId: runId,
      workflowScenarioId: scenario.id,
      workflowStageId: "reply",
      workflowTriggerType: resolvedTriggerType,
      workflowSource: "来自 Support Copilot 的手动问题录入",
      workflowNextStep: "先生成建议回复，再由人工确认是否外发或升级处理。",
    });
    upsertSupportAsset(runId, {
      scenarioId: scenario.id,
      ticketId: selected.id,
      customer: selected.customer,
      channel: selected.channel,
      issueSummary: selected.message.slice(0, 220),
      nextAction: "先生成建议回复，再由人工审核。",
      status: "replying",
    });
    return runId;
  };

  const generateReply = async () => {
    if (!selected) {
      showToast("请先选择工单", "error");
      return;
    }
    const runId = ensureWorkflowForSelected();
    if (runId) {
      const run = getWorkflowRun(runId);
      if (run?.currentStageId === "capture") {
        advanceWorkflowRun(runId);
      }
    }
    const fallback = buildLocalReply(selected);
    const taskId = createTask({
      name: "Assistant - Support reply",
      status: "running",
      detail: selected.subject,
      workflowRunId: runId ?? selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId ?? "support-ops",
      workflowStageId: "reply",
      workflowSource: selected.workflowSource ?? "Support Copilot 生成建议回复",
      workflowNextStep: "人工确认回复后决定是否外发或升级。",
      workflowTriggerType: selected.workflowTriggerType ?? "manual",
    });
    setIsGenerating(true);
    try {
      const message =
        "请根据客户问题生成一段可直接人工审核的客户回复草稿。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先表达已收到问题。\n" +
        "2) 给出清晰下一步，不要推诿。\n" +
        "3) 如果信息不足，礼貌地请求补充。\n" +
        "4) 语气专业、克制。\n" +
        "5) 不得编造退款、赔付、订单状态、处理时效或内部结论。\n" +
        "6) 输出只能是回复正文，不要附加解释。\n\n" +
        `渠道：${selected.channel}\n` +
        `客户：${selected.customer}\n` +
        `主题：${selected.subject}\n` +
        `问题描述：${selected.message}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-support-copilot",
        timeoutSeconds: 90,
        expertProfileId: "support_reply_specialist",
      });
      const nextReply = text || fallback;
      let reviewNotes = "";
      try {
        reviewNotes = await requestRealityCheck({
          taskLabel: "客服回复草稿",
          sourceContext: [
            `渠道：${selected.channel}`,
            `客户：${selected.customer}`,
            `主题：${selected.subject}`,
            `问题描述：${selected.message}`,
          ].join("\n"),
          candidateOutput: nextReply,
          sessionId: "webos-support-copilot-review",
          timeoutSeconds: 45,
        });
      } catch {
        reviewNotes = "";
      }
      patchSelected({
        replyDraft: nextReply,
        reviewNotes,
        workflowRunId: runId ?? selected.workflowRunId,
        workflowScenarioId: selected.workflowScenarioId ?? "support-ops",
        workflowStageId: "reply",
        workflowSource: "Support Copilot 已生成建议回复",
        workflowNextStep: "人工确认回复边界后，再决定是否转任务跟进或沉淀成 FAQ。",
      });
      if (runId) {
        upsertSupportAsset(runId, {
          scenarioId: "support-ops",
          ticketId: selected.id,
          customer: selected.customer,
          channel: selected.channel,
          issueSummary: selected.message.slice(0, 220),
          latestReply: nextReply,
          nextAction: "人工确认当前回复，确认是否需要升级处理或转成任务。",
          status: "replying",
        });
        setWorkflowRunAwaitingHuman(runId);
      }
      updateTask(taskId, { status: "done" });
      showToast("回复草稿已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({
        replyDraft: fallback,
        reviewNotes: "",
        workflowSource: "Support Copilot 本地兜底生成回复草稿",
        workflowNextStep: "建议人工检查回复后，再决定是否进入跟进。",
      });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地回复", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveReplyDraft = () => {
    if (!selected?.replyDraft.trim()) {
      showToast("请先生成回复草稿", "error");
      return;
    }
    createDraft({
      title: `Support - ${selected.subject || selected.customer}`,
      body: selected.replyDraft,
      tags: ["support", selected.channel],
      source: "import",
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: selected.workflowStageId,
      workflowTriggerType: selected.workflowTriggerType,
      workflowSource: selected.workflowSource,
      workflowNextStep: selected.workflowNextStep,
    });
    showToast("已保存到草稿", "ok");
  };

  const queueFollowUp = () => {
    if (!selected) {
      showToast("请先选择工单", "error");
      return;
    }
    createTask({
      name: `Support - ${selected.customer}`,
      status: "queued",
      detail: selected.subject || "客户回复跟进",
      workflowRunId: selected.workflowRunId,
      workflowScenarioId: selected.workflowScenarioId,
      workflowStageId: "followup",
      workflowSource: selected.workflowSource ?? "Support Copilot 已进入后续跟进阶段",
      workflowNextStep: "把本次处理沉淀成 FAQ 或升级规则。",
      workflowTriggerType: selected.workflowTriggerType,
    });
    if (selected.workflowRunId) {
      const run = getWorkflowRun(selected.workflowRunId);
      if (run?.currentStageId === "reply") {
        advanceWorkflowRun(selected.workflowRunId);
      }
      patchSelected({
        workflowStageId: "followup",
        workflowSource: "Support Copilot 已完成人工确认，进入后续跟进阶段",
        workflowNextStep: "把这次处理沉淀成 FAQ 或升级规则，避免重复人工处理。",
      });
      upsertSupportAsset(selected.workflowRunId, {
        scenarioId: selected.workflowScenarioId ?? "support-ops",
        ticketId: selected.id,
        customer: selected.customer,
        channel: selected.channel,
        issueSummary: selected.message.slice(0, 220),
        latestReply: selected.replyDraft,
        escalationTask: selected.subject || "客户问题跟进",
        nextAction: "完成跟进后，把高频问题沉淀成 FAQ 条目。",
        status: "followup",
      });
    }
    showToast("已加入任务中心", "ok");
  };

  const sendToKnowledgeVault = () => {
    if (!selected) {
      showToast("请先选择工单", "error");
      return;
    }
    void (async () => {
      const fallbackFaqDraft = [
        `问题主题：${selected.subject || "未命名问题"}`,
        `客户渠道：${selected.channel}`,
        `问题摘要：${selected.message || "(未填)"}`,
        selected.replyDraft ? `建议回复：\n${selected.replyDraft}` : "",
        "请整理成 FAQ 条目，输出：适用场景、标准回复、升级边界、需要人工确认的条件。",
      ]
        .filter(Boolean)
        .join("\n\n");
      let faqDraft = fallbackFaqDraft;
      try {
        const generated = await requestOpenClawAgent({
          message: [
            "请把下面这次客服处理结果整理成一份可复用 FAQ / 升级边界资产草稿。",
            `${getOutputLanguageInstruction()}`,
            "要求：",
            "1) 使用以下标题输出：",
            "【适用场景】",
            "【标准回复】",
            "【需要补充的信息】",
            "【升级边界】",
            "【复用备注】",
            "2) 不要编造订单状态、政策或内部结论。",
            "",
            `客户：${selected.customer}`,
            `渠道：${selected.channel}`,
            `主题：${selected.subject || "(未填)"}`,
            `问题摘要：${selected.message || "(未填)"}`,
            `当前回复草稿：${selected.replyDraft || "(未填)"}`,
          ].join("\n"),
          sessionId: "webos-support-copilot-assetize",
          timeoutSeconds: 60,
          expertProfileId: "knowledge_asset_editor",
        });
        faqDraft = generated || fallbackFaqDraft;
      } catch {
        faqDraft = fallbackFaqDraft;
      }

      if (selected.workflowRunId) {
        const run = getWorkflowRun(selected.workflowRunId);
        if (run?.currentStageId === "followup") {
          advanceWorkflowRun(selected.workflowRunId);
        }
        patchSelected({
          workflowStageId: "faq",
          workflowSource: "Support Copilot 已准备沉淀 FAQ 资产",
          workflowNextStep: "本轮问题处理已接近完成，把 FAQ、升级规则和标准回复写回知识层。",
        });
        upsertSupportAsset(selected.workflowRunId, {
          scenarioId: selected.workflowScenarioId ?? "support-ops",
          ticketId: selected.id,
          customer: selected.customer,
          channel: selected.channel,
          issueSummary: selected.message.slice(0, 220),
          latestReply: selected.replyDraft,
          faqDraft,
          nextAction: "FAQ 已准备完成，确认知识条目后即可结束本轮工作流。",
          status: "faq",
        });
        completeWorkflowRun(selected.workflowRunId);
      }

      requestOpenKnowledgeVault({
        query: faqDraft,
      });
      showToast("已发送到 Knowledge Vault", "ok");
    })();
  };

  const confirmSupportAssetToVault = () => {
    if (!selected?.workflowRunId) {
      showToast("请先完成 FAQ 沉淀阶段", "error");
      return;
    }
    const supportAsset = getSupportAssetByWorkflowRunId(selected.workflowRunId);
    const body =
      supportAsset?.faqDraft ||
      [
      `客户：${selected.customer || "(未填)"}`,
      `渠道：${selected.channel}`,
      `主题：${selected.subject || "(未填)"}`,
      `问题：${selected.message || "(未填)"}`,
      selected.replyDraft ? `当前回复：\n${selected.replyDraft}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    upsertKnowledgeAsset(`support:${selected.workflowRunId}`, {
      title: `${selected.subject || selected.customer || "客服"} · FAQ 资产`,
      body,
      sourceApp: "support_copilot",
      scenarioId: selected.workflowScenarioId ?? "support-ops",
      workflowRunId: selected.workflowRunId,
      assetType: "support_faq",
      status: "active",
      tags: ["support", "faq", "reply", "boundary"],
      applicableScene: "客服回复 / FAQ 复用 / 升级边界判断",
      sourceJumpTarget: {
        kind: "record",
        appId: "support_copilot",
        eventName: "openclaw:support-copilot-select",
        eventDetail: { ticketId: selected.id },
      },
    });
    requestOpenKnowledgeVault({
      query: selected.subject || selected.customer || "FAQ 资产",
    });
    showToast("FAQ 资产已确认入库", "ok");
  };

  const sendToCrm = () => {
    if (!selected) {
      showToast("请先选择工单", "error");
      return;
    }
    requestOpenCrm({
      name: selected.customer,
      role: `${selected.channel} support`,
      status: "lead",
      nextStep: selected.subject || "跟进客户问题",
      notes: [
        `渠道：${selected.channel}`,
        `主题：${selected.subject}`,
        `问题：${selected.message}`,
        selected.replyDraft ? `当前回复草稿：\n${selected.replyDraft}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    showToast("已发送到 Personal CRM", "ok");
  };

  const stats = useMemo(
    () => ({
      total: tickets.length,
      unresolved: tickets.filter((ticket) => ticket.status !== "resolved").length,
    }),
    [tickets],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Support Copilot"
      icon={Headphones}
      widthClassName="w-[1160px]"
      storageKey="openclaw.window.support_copilot"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Customer Service Copilot</h1>
              <p className="mt-1 text-sm text-gray-500">
                对应 use case 里的 Multi-Channel AI Customer Service。先用统一工单界面整理多渠道消息，再生成可发送回复。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" size="md">
                总工单 {stats.total}
              </Badge>
              <Badge variant="default" size="md">
                未解决 {stats.unresolved}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <SupportHeroWorkflowPanel
            workflowRunId={selected?.workflowRunId}
            title={selected ? `${selected.subject || "未命名工单"} · 回复与跟进阶段` : "Support Copilot · Hero Workflow"}
            description="Support Copilot 负责客服链里最关键的人机协作边界: AI 起草建议回复，人工确认风险边界，再把结果转成跟进动作和 FAQ 资产。"
            emptyHint="当问题是从 Inbox 送过来时，这里会自动显示所属 Support Hero Workflow。"
            source={selected?.workflowSource}
            nextStep={selected?.workflowNextStep}
            actions={[
              {
                label: "生成回复",
                onClick: generateReply,
                disabled: !selected || isGenerating,
              },
              {
                label: "沉淀 FAQ",
                onClick: sendToKnowledgeVault,
                disabled: !selected,
                tone: "secondary",
              },
              {
                label: "确认入库",
                onClick: confirmSupportAssetToVault,
                disabled: !selected?.workflowRunId,
                tone: "secondary",
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="工单列表"
                actions={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={createNewTicket}
                  >
                    新建
                  </Button>
                }
              />
              <CardBody spacing="sm">
                {tickets.length > 0 ? (
                  tickets.map((ticket) => {
                    const active = ticket.id === selectedId;
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedId(ticket.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{ticket.subject}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {ticket.customer} · {ticket.channel}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有工单。
                  </div>
                )}
              </CardBody>
            </Card>
          </aside>

          <main className="space-y-4">
            <Card padding="md">
              {selected ? (
                <>
                  <CardHeader
                    title="工单详情"
                    subtitle="这里维护渠道、客户问题和处理状态。"
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
                        label="客户"
                        value={selected.customer}
                        onChange={(e) => patchSelected({ customer: e.target.value })}
                        fullWidth
                      />
                      <Input
                        label="主题"
                        value={selected.subject}
                        onChange={(e) => patchSelected({ subject: e.target.value })}
                        fullWidth
                      />
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          渠道
                        </label>
                        <select
                          value={selected.channel}
                          onChange={(e) => patchSelected({ channel: e.target.value as SupportChannel })}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-400 focus:outline-none"
                        >
                          {channelOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          状态
                        </label>
                        <select
                          value={selected.status}
                          onChange={(e) => patchSelected({ status: e.target.value as SupportStatus })}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm focus:border-gray-400 focus:outline-none"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <Textarea
                      label="客户问题"
                      value={selected.message}
                      onChange={(e) => patchSelected({ message: e.target.value })}
                      placeholder="粘贴客户原始消息。"
                      rows={8}
                      fullWidth
                    />
                  </CardBody>
                </>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条工单。
                </div>
              )}
            </Card>

            <Card padding="md">
              <CardHeader
                title="回复草稿"
                subtitle="生成专业、可发送的多渠道客服回复。"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      icon={<Sparkles className="h-4 w-4" />}
                      onClick={generateReply}
                      disabled={!selected || isGenerating}
                      loading={isGenerating}
                    >
                      {isGenerating ? "生成中..." : "生成回复"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={queueFollowUp}
                      disabled={!selected}
                    >
                      加入待办
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<FilePlus2 className="h-4 w-4" />}
                      onClick={saveReplyDraft}
                      disabled={!selected}
                    >
                      保存草稿
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={sendToCrm}
                      disabled={!selected}
                    >
                      发送到 CRM
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={sendToKnowledgeVault}
                      disabled={!selected}
                    >
                      沉淀 FAQ
                    </Button>
                  </div>
                }
              />
              <CardBody spacing="md">
                <div className="min-h-[280px]">
                  <RecommendationResultBody
                    recommendation={surfaceRecommendation}
                    tone="emerald"
                    actionTitle="执行建议"
                    actionButtonLabel="查看当前工单"
                    maxHitsPerSection={2}
                  />
                  {selected?.replyDraft ? (
                    <Textarea
                      value={selected.replyDraft}
                      onChange={(e) => patchSelected({ replyDraft: e.target.value, reviewNotes: "" })}
                      rows={12}
                      fullWidth
                    />
                  ) : (
                    <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                      生成后，这里会出现客服回复草稿。
                    </div>
                  )}
                </div>

                {selected?.reviewNotes ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Reality Checker
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
                      {selected.reviewNotes}
                    </pre>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Card padding="md">
              <CardHeader
                title="FAQ / 资产草稿"
                subtitle="这里是 Knowledge Asset Editor 整理出的 FAQ 与升级边界草稿。你可以先编辑，再确认入库。"
                actions={
                  <Button
                    size="sm"
                    variant="success"
                    onClick={confirmSupportAssetToVault}
                    disabled={!selected?.workflowRunId || !currentSupportAsset?.faqDraft?.trim()}
                  >
                    确认入库
                  </Button>
                }
              />
              <CardBody spacing="md">
                {currentSupportAsset?.faqDraft ? (
                  <Textarea
                    value={currentSupportAsset.faqDraft}
                    onChange={(e) => {
                      if (!selected?.workflowRunId) return;
                      upsertSupportAsset(selected.workflowRunId, {
                        faqDraft: e.target.value,
                      });
                    }}
                    rows={10}
                    fullWidth
                  />
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    进入 FAQ 沉淀阶段后，这里会出现可编辑的 FAQ 资产草稿。
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
