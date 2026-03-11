"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, FilePlus2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createDeal,
  getDeals,
  removeDeal,
  subscribeDeals,
  updateDeal,
  type DealRecord,
  type DealStage,
} from "@/lib/deals";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import {
  requestComposeEmail,
  type DealDeskPrefill,
} from "@/lib/ui-events";

const stages: Array<{ value: DealStage; label: string }> = [
  { value: "new", label: "新线索" },
  { value: "qualified", label: "已判断" },
  { value: "proposal", label: "提案中" },
  { value: "blocked", label: "阻塞" },
  { value: "won", label: "已成交" },
];

function buildLocalBrief(deal: DealRecord) {
  return [
    "【Deal Brief】",
    `- 公司：${deal.company || "未填写"}`,
    `- 联系人：${deal.contact || "未填写"}`,
    `- 需求：${deal.need || "未填写"}`,
    `- 预算：${deal.budget || "未填写"}`,
    `- 时间：${deal.timing || "未填写"}`,
    "",
    "【判断】",
    "- 先确认需求是否明确、预算是否匹配、时间是否可执行。",
    "",
    "【下一步建议】",
    "- 如果信息不足，先补预算、目标和关键决策人。",
    "- 如果匹配度高，尽快安排方案会或发送提案。",
    "- 如果当前阻塞，明确卡点并设置跟进时间。",
  ].join("\n");
}

export function DealDeskAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getDeals();
      setDeals(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeDeals(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<DealDeskPrefill>).detail;
      const id = createDeal({
        company: detail?.company ?? "",
        contact: detail?.contact ?? "",
        need: detail?.need ?? "",
        budget: detail?.budget ?? "",
        timing: detail?.timing ?? "",
        notes: detail?.notes ?? "",
        stage: detail?.stage ?? "new",
      });
      setSelectedId(id);
      showToast("已带入线索上下文", "ok");
    };
    window.addEventListener("openclaw:deal-desk-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:deal-desk-prefill", onPrefill);
  }, [showToast]);

  const selected = useMemo(
    () => deals.find((deal) => deal.id === selectedId) ?? null,
    [deals, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<DealRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateDeal(selected.id, patch);
  };

  const createNew = () => {
    const id = createDeal();
    setSelectedId(id);
    showToast("已新增线索", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeDeal(selected.id);
    setSelectedId(null);
    showToast("线索已删除", "ok");
  };

  const qualifyDeal = async () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    const fallback = buildLocalBrief(selected);
    const taskId = createTask({
      name: "Assistant - Deal qualification",
      status: "running",
      detail: selected.company,
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Deal Desk 助手。请根据用户给出的线索信息，输出中文资格判断简报。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先判断当前线索是否值得推进。\n" +
        "2) 指出缺失信息和风险点。\n" +
        "3) 给出下一步建议，尽量可执行。\n\n" +
        `公司：${selected.company}\n` +
        `联系人：${selected.contact || "(未填)"}\n` +
        `需求：${selected.need || "(未填)"}\n` +
        `预算：${selected.budget || "(未填)"}\n` +
        `时间：${selected.timing || "(未填)"}\n` +
        `备注：${selected.notes || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-deal-desk",
        timeoutSeconds: 90,
      });
      patchSelected({
        brief: text || fallback,
        stage: selected.stage === "new" ? "qualified" : selected.stage,
      });
      updateTask(taskId, { status: "done" });
      showToast("线索简报已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ brief: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地简报", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const queueFollowUp = () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    createTask({
      name: `Deal - ${selected.company}`,
      status: "queued",
      detail: selected.need || "安排下一步沟通",
    });
    showToast("已加入任务中心", "ok");
  };

  const saveBriefDraft = () => {
    if (!selected?.brief.trim()) {
      showToast("请先生成线索简报", "error");
      return;
    }
    createDraft({
      title: `${selected.company} Deal Brief`,
      body: selected.brief,
      tags: ["deal", selected.stage],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToEmailAssistant = () => {
    if (!selected) {
      showToast("请先选择线索", "error");
      return;
    }
    requestComposeEmail({
      subject: `关于 ${selected.company || "合作"} 的下一步沟通`,
      recipient: selected.contact,
      goal: "确认需求匹配度并推进下一次沟通",
      tone: "professional",
      context: [
        `公司：${selected.company || "(未填)"}`,
        `联系人：${selected.contact || "(未填)"}`,
        `需求：${selected.need || "(未填)"}`,
        `预算：${selected.budget || "(未填)"}`,
        `时间：${selected.timing || "(未填)"}`,
        selected.brief ? `当前判断：\n${selected.brief}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    showToast("已发送到 Email Assistant", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Deal Desk"
      icon={Briefcase}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.deal_desk"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Lead Qualification / Deal Desk</div>
              <div className="mt-1 text-sm text-gray-500">
                用于判断线索是否值得推进，找缺失信息、风险点，并形成下一步提案动作。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              线索 {deals.length} 条
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">线索列表</div>
                <button
                  type="button"
                  onClick={createNew}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {deals.length > 0 ? (
                  deals.map((deal) => {
                    const active = deal.id === selectedId;
                    return (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => setSelectedId(deal.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{deal.company}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {deal.contact || "未填写联系人"} · {deal.stage}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有线索。
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
                      <div className="text-sm font-semibold text-gray-900">线索信息</div>
                      <div className="mt-1 text-xs text-gray-500">填需求、预算、时间，生成判断简报。</div>
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
                      <label className="mb-2 block text-xs font-semibold text-gray-600">公司</label>
                      <input
                        value={selected.company}
                        onChange={(e) => patchSelected({ company: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">联系人</label>
                      <input
                        value={selected.contact}
                        onChange={(e) => patchSelected({ contact: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">预算</label>
                      <input
                        value={selected.budget}
                        onChange={(e) => patchSelected({ budget: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">时间</label>
                      <input
                        value={selected.timing}
                        onChange={(e) => patchSelected({ timing: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">需求</label>
                      <textarea
                        value={selected.need}
                        onChange={(e) => patchSelected({ need: e.target.value })}
                        className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-xs font-semibold text-gray-600">备注</label>
                      <textarea
                        value={selected.notes}
                        onChange={(e) => patchSelected({ notes: e.target.value })}
                        className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-gray-600">阶段</label>
                      <select
                        value={selected.stage}
                        onChange={(e) => patchSelected({ stage: e.target.value as DealStage })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {stages.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条线索。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">线索判断简报</div>
                  <div className="mt-1 text-xs text-gray-500">输出判断、风险点和下一步建议。</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={qualifyDeal}
                    disabled={!selected || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "分析中..." : "生成简报"}
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
                    onClick={saveBriefDraft}
                    disabled={!selected}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                  <button
                    type="button"
                    onClick={sendToEmailAssistant}
                    disabled={!selected}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    转到 Email Assistant
                  </button>
                </div>
              </div>

              <div className="min-h-[280px] pt-4">
                {selected?.brief ? (
                  <textarea
                    value={selected.brief}
                    onChange={(e) => patchSelected({ brief: e.target.value })}
                    className="h-[280px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-7 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现线索判断简报。
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
