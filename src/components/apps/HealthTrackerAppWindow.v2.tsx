"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, HeartPulse, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createHealthLog,
  getHealthLogs,
  removeHealthLog,
  subscribeHealth,
  updateHealthLog,
  type HealthLog,
} from "@/lib/health";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { Button, Input, Textarea, Card, Badge } from "@/design-system";
import { CardHeader, CardBody, CardDivider } from "@/design-system";

function buildLocalSummary(logs: HealthLog[]) {
  const recent = logs.slice(0, 7);
  const avgEnergy =
    recent.length > 0
      ? (recent.reduce((sum, log) => sum + log.energy, 0) / recent.length).toFixed(1)
      : "0";
  return [
    "【Health Summary】",
    `- 最近记录：${recent.length} 天`,
    `- 平均精力：${avgEnergy}/5`,
    "",
    "【观察】",
    ...(recent.length > 0
      ? recent.map((log) => `- ${log.date} | sleep ${log.sleepHours || "-"}h | energy ${log.energy} | symptom ${log.symptom || "无"}`)
      : ["- 还没有健康记录。"]),
    "",
    "【提醒】",
    "- 这里只做记录与整理，不替代专业医疗建议。",
    "- 如果症状持续、恶化或明显异常，请尽快线下就医。",
  ].join("\n");
}

export function HealthTrackerAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getHealthLogs();
      setLogs(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeHealth(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => logs.find((log) => log.id === selectedId) ?? null,
    [logs, selectedId],
  );

  const createNew = () => {
    const id = createHealthLog();
    setSelectedId(id);
    showToast("已新增健康记录", "ok");
  };

  const generateSummary = async () => {
    const fallback = buildLocalSummary(logs);
    const taskId = createTask({
      name: "Assistant - Health summary",
      status: "running",
      detail: "health-tracker",
    });
    setIsGenerating(true);
    try {
      const content = logs
        .slice(0, 10)
        .map((log) => `- ${log.date} | sleep ${log.sleepHours || "-"}h | energy ${log.energy} | symptom ${log.symptom || "无"} | medication ${log.medication || "无"} | notes ${log.notes || "无"}`)
        .join("\n");
      const message =
        "你是 Health & Symptom Tracker 助手。请基于用户记录输出一份中文整理摘要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 只总结模式和变化，不做诊断。\n" +
        "2) 提醒用户什么时候应该考虑线下就医。\n" +
        "3) 输出里明确说明这不是医疗建议。\n\n" +
        `记录：\n${content || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-health-tracker",
        timeoutSeconds: 90,
      });
      setSummary(text || fallback);
      updateTask(taskId, { status: "done" });
      showToast("健康摘要已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setSummary(fallback);
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地摘要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSummary = () => {
    if (!summary.trim()) {
      showToast("请先生成健康摘要", "error");
      return;
    }
    createDraft({
      title: "Health Summary",
      body: summary,
      tags: ["health", "symptom"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Health Tracker"
      icon={HeartPulse}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.health_tracker"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Health & Symptom Tracker</h1>
              <p className="mt-2 text-sm text-gray-600">
                高频个人场景：记录睡眠、精力、症状和药物，仅用于整理，不替代医疗建议。
              </p>
            </div>
            <Badge variant="warning" size="md">
              仅记录与整理，不替代医疗建议
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="健康记录"
                actions={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={createNew}
                  >
                    新建
                  </Button>
                }
              />
              <CardDivider />
              <CardBody spacing="sm">
                {logs.length > 0 ? (
                  logs.map((log) => {
                    const isActive = log.id === selectedId;
                    return (
                      <button
                        key={log.id}
                        type="button"
                        onClick={() => setSelectedId(log.id)}
                        className={[
                          "w-full rounded-xl border p-3 text-left transition-all",
                          isActive
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold text-gray-900">{log.date}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          energy {log.energy}/5 {log.symptom ? `· ${log.symptom}` : ""}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    还没有健康记录。
                  </div>
                )}
              </CardBody>
            </Card>
          </aside>

          <main className="space-y-6">
            <Card padding="md">
              {selected ? (
                <>
                  <CardHeader
                    title="记录详情"
                    subtitle="记录变化即可，不做诊断"
                    actions={
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => {
                          removeHealthLog(selected.id);
                          setSelectedId(null);
                          showToast("健康记录已删除", "ok");
                        }}
                      >
                        删除
                      </Button>
                    }
                  />
                  <CardDivider />
                  <CardBody spacing="md">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Input
                        type="date"
                        value={selected.date}
                        onChange={(e) => updateHealthLog(selected.id, { date: e.target.value })}
                        fullWidth
                      />
                      <Input
                        value={selected.sleepHours}
                        onChange={(e) => updateHealthLog(selected.id, { sleepHours: e.target.value })}
                        placeholder="睡眠小时，例如 7.5"
                        fullWidth
                      />
                      <div>
                        <select
                          value={String(selected.energy)}
                          onChange={(e) => updateHealthLog(selected.id, { energy: Number(e.target.value) })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              energy {value}/5
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        value={selected.medication}
                        onChange={(e) => updateHealthLog(selected.id, { medication: e.target.value })}
                        placeholder="药物 / 补剂"
                        fullWidth
                      />
                      <div className="md:col-span-2">
                        <Input
                          value={selected.symptom}
                          onChange={(e) => updateHealthLog(selected.id, { symptom: e.target.value })}
                          placeholder="症状"
                          fullWidth
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Textarea
                          value={selected.notes}
                          onChange={(e) => updateHealthLog(selected.id, { notes: e.target.value })}
                          placeholder="备注"
                          rows={5}
                          fullWidth
                        />
                      </div>
                    </div>
                  </CardBody>
                </>
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                  先创建或选择一条健康记录。
                </div>
              )}
            </Card>

            <Card padding="md">
              <CardHeader
                title="健康摘要"
                subtitle="只整理模式，不做诊断"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      icon={<Sparkles className="h-4 w-4" />}
                      onClick={generateSummary}
                      disabled={isGenerating}
                      loading={isGenerating}
                    >
                      {isGenerating ? "生成中..." : "生成摘要"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<FilePlus2 className="h-4 w-4" />}
                      onClick={saveSummary}
                    >
                      保存草稿
                    </Button>
                  </div>
                }
              />
              <CardDivider />
              <CardBody spacing="md">
                {summary ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{summary}</pre>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现健康摘要。
                  </div>
                )}
              </CardBody>
            </Card>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
