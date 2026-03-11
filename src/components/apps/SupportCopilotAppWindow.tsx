"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Headphones, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
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
import { requestOpenCrm } from "@/lib/ui-events";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getSupportTickets();
      setTickets(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
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

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? null,
    [selectedId, tickets],
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

  const generateReply = async () => {
    if (!selected) {
      showToast("请先选择工单", "error");
      return;
    }
    const fallback = buildLocalReply(selected);
    const taskId = createTask({
      name: "Assistant - Support reply",
      status: "running",
      detail: selected.subject,
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Customer Service Copilot。请根据用户提供的客户问题，输出一段中文回复草稿。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先表达已收到问题。\n" +
        "2) 给出清晰下一步，不要推诿。\n" +
        "3) 如果信息不足，礼貌地请求补充。\n" +
        "4) 语气专业、克制。\n\n" +
        `渠道：${selected.channel}\n` +
        `客户：${selected.customer}\n` +
        `主题：${selected.subject}\n` +
        `问题描述：${selected.message}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-support-copilot",
        timeoutSeconds: 90,
      });
      patchSelected({ replyDraft: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("回复草稿已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ replyDraft: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地回复", "error");
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
    });
    showToast("已加入任务中心", "ok");
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
              <div className="text-lg font-bold text-gray-900">Customer Service Copilot</div>
              <div className="mt-1 text-sm text-gray-500">
                对应 use case 里的 Multi-Channel AI Customer Service。先用统一工单界面整理多渠道消息，再生成可发送回复。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                总工单 {stats.total}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                未解决 {stats.unresolved}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">工单列表</div>
                <button
                  type="button"
                  onClick={createNewTicket}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>
              <div className="mt-3 space-y-2">
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
              </div>
            </div>
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              {selected ? (
                <>
                  <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">工单详情</div>
                      <div className="mt-1 text-xs text-gray-500">这里维护渠道、客户问题和处理状态。</div>
                    </div>
                    <button
                      type="button"
                      onClick={deleteSelected}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">客户</label>
                      <input
                        value={selected.customer}
                        onChange={(e) => patchSelected({ customer: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">主题</label>
                      <input
                        value={selected.subject}
                        onChange={(e) => patchSelected({ subject: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">渠道</label>
                      <select
                        value={selected.channel}
                        onChange={(e) => patchSelected({ channel: e.target.value as SupportChannel })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {channelOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">状态</label>
                      <select
                        value={selected.status}
                        onChange={(e) => patchSelected({ status: e.target.value as SupportStatus })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-semibold text-gray-600">客户问题</label>
                    <textarea
                      value={selected.message}
                      onChange={(e) => patchSelected({ message: e.target.value })}
                      placeholder="粘贴客户原始消息。"
                      className="h-36 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条工单。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">回复草稿</div>
                  <div className="mt-1 text-xs text-gray-500">生成专业、可发送的多渠道客服回复。</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateReply}
                    disabled={!selected || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成回复"}
                  </button>
                  <button
                    type="button"
                    onClick={queueFollowUp}
                    disabled={!selected}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    加入待办
                  </button>
                  <button
                    type="button"
                    onClick={saveReplyDraft}
                    disabled={!selected}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                  <button
                    type="button"
                    onClick={sendToCrm}
                    disabled={!selected}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    发送到 CRM
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {selected?.replyDraft ? (
                  <textarea
                    value={selected.replyDraft}
                    onChange={(e) => patchSelected({ replyDraft: e.target.value })}
                    className="h-[280px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-7 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现客服回复草稿。
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
