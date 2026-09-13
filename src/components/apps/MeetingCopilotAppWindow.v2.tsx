"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ClipboardCheck, FilePlus2, Mic2, Sparkles } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { getMeetings, subscribeMeetings, upsertMeeting, type MeetingRecord } from "@/lib/meetings";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, requestOpenDealDesk } from "@/lib/ui-events";
import { Button, Input, Textarea, Card, Badge } from "@/design-system";
import { CardHeader, CardBody, CardDivider } from "@/design-system";

function buildLocalMeetingSummary(title: string, participants: string, transcript: string) {
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const short = lines.slice(0, 6);
  const actionHints = lines
    .filter((line) => /todo|待办|行动|下一步|follow up|deadline|负责/i.test(line))
    .slice(0, 5);

  return [
    "【会议摘要】",
    `- 会议：${title.trim() || "未命名会议"}`,
    `- 参与人：${participants.trim() || "未填写"}`,
    ...(short.length > 0 ? short.map((line) => `- ${line}`) : ["- 暂无足够记录。"]),
    "",
    "【决议】",
    "- 建议把关键结论固化成 2-3 条可执行项。",
    "",
    "【待办】",
    ...(actionHints.length > 0
      ? actionHints.map((line) => `- ${line.replace(/^[-*]\s*/, "")}`)
      : ["- 整理负责人、截止时间和下一步动作。"]),
  ].join("\n");
}

function extractActionItems(summary: string) {
  const sectionMatch = summary.match(/【待办】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : summary;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function MeetingCopilotAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [meetingId, setMeetingId] = useState<string | undefined>(undefined);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => setRecords(getMeetings());
    sync();
    const unsub = subscribeMeetings(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const generate = async () => {
    const transcriptText = transcript.trim();
    if (!transcriptText) {
      showToast("请先粘贴会议记录", "error");
      return;
    }

    const fallback = buildLocalMeetingSummary(title, participants, transcriptText);
    const taskId = createTask({
      name: "Assistant - Meeting copilot",
      status: "running",
      detail: title.trim().slice(0, 80) || "meeting-summary",
    });

    setIsGenerating(true);
    try {
      const message =
        "你是 Meeting Copilot。请把用户提供的会议记录整理成中文会议纪要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出格式必须包含以下三个标题：\n" +
        "【会议摘要】\n【决议】\n【待办】\n" +
        "其中待办使用短 bullet，每条尽量包含负责人/动作/时间。\n\n" +
        `会议名称：${title.trim() || "未命名会议"}\n` +
        `参与人：${participants.trim() || "未填写"}\n` +
        `会议记录：\n${transcriptText}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-meeting-copilot",
        timeoutSeconds: 120,
      });
      setSummary(text || fallback);
      setMeetingId(
        upsertMeeting({
          id: meetingId,
          title,
          participants,
          transcript,
          summary: text || fallback,
        }),
      );
      updateTask(taskId, { status: "done" });
      showToast("会议纪要已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setSummary(fallback);
      setMeetingId(
        upsertMeeting({
          id: meetingId,
          title,
          participants,
          transcript,
          summary: fallback,
        }),
      );
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已生成本地纪要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!summary.trim()) {
      showToast("请先生成会议纪要", "error");
      return;
    }
    createDraft({
      title: title.trim() || "会议纪要",
      body: summary,
      tags: ["meeting", "notes"],
      source: "import",
    });
    showToast("已写入草稿", "ok");
  };

  const pushTasks = () => {
    const items = extractActionItems(summary);
    if (items.length === 0) {
      showToast("没有可写入的待办项", "error");
      return;
    }
    for (const item of items) {
      createTask({
        name: `Meeting - ${title.trim() || "Follow-up"}`,
        status: "queued",
        detail: item,
      });
    }
    showToast(`已写入 ${items.length} 个待办`, "ok");
  };

  const sendToDealDesk = () => {
    if (!summary.trim()) {
      showToast("请先生成会议纪要", "error");
      return;
    }
    const actionItems = extractActionItems(summary);
    requestOpenDealDesk({
      company: title.trim() || "Meeting Lead",
      contact: participants.trim(),
      need: actionItems[0] || title.trim() || "根据会议内容跟进下一步",
      notes: summary,
      stage: "new",
    });
    showToast("已发送到 Deal Desk", "ok");
  };

  const stats = useMemo(
    () => ({
      records: records.length,
      actionItems: extractActionItems(summary).length,
    }),
    [records.length, summary],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Meeting Copilot"
      icon={Mic2}
      widthClassName="w-[1140px]"
      storageKey="openclaw.window.meeting_copilot"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-slate-50">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Meeting Notes & Action Items</h1>
              <p className="mt-2 text-sm text-gray-600">
                把原始记录压缩成纪要、决议和待办，并能直接写入任务中心。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" size="md">
                纪要记录 {stats.records} 条
              </Badge>
              <Badge variant="primary" size="md">
                当前待办 {stats.actionItems} 项
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 xl:grid-cols-[340px_minmax(0,1fr)] xl:overflow-hidden">
          <aside className="min-h-0 space-y-4 xl:overflow-y-auto">
            <Card padding="md">
              <CardHeader title="输入会议内容" />
              <CardDivider />
              <CardBody spacing="md">
                <Input
                  label="会议名称"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：周一增长周会"
                  fullWidth
                />

                <Input
                  label="参与人"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder="例如：产品、运营、销售"
                  fullWidth
                />

                <Textarea
                  label="会议记录 / Transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="粘贴会议纪要、录音转写或你的手写笔记。"
                  rows={8}
                  fullWidth
                />

                <Button
                  variant="primary"
                  size="md"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={generate}
                  disabled={isGenerating}
                  loading={isGenerating}
                  fullWidth
                >
                  {isGenerating ? "整理中..." : "生成会议纪要"}
                </Button>
              </CardBody>
            </Card>

            <Card padding="md">
              <CardHeader
                title="最近会议"
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => requestOpenApp("task_manager")}
                  >
                    打开任务中心
                  </Button>
                }
              />
              <CardDivider />
              <CardBody spacing="sm">
                {records.length > 0 ? (
                  records.slice(0, 6).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        setMeetingId(record.id);
                        setTitle(record.title);
                        setParticipants(record.participants);
                        setTranscript(record.transcript);
                        setSummary(record.summary);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-gray-300 hover:bg-gray-50"
                    >
                      <div className="text-sm font-semibold text-gray-900">{record.title}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(record.updatedAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    还没有会议记录。
                  </div>
                )}
              </CardBody>
            </Card>
          </aside>

          <main className="flex min-h-0 flex-col">
            <Card padding="md" className="flex min-h-0 flex-col">
              <CardHeader
                title="纪要结果"
                subtitle="支持保存为草稿，或把待办直接写入任务调度中心"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<FilePlus2 className="h-4 w-4" />}
                      onClick={saveDraft}
                    >
                      写入草稿
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      icon={<ClipboardCheck className="h-4 w-4" />}
                      onClick={pushTasks}
                    >
                      写入待办
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={sendToDealDesk}
                    >
                      发送到 Deal Desk
                    </Button>
                  </div>
                }
              />
              <CardDivider />

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {summary ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
                    {summary}
                  </pre>
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现会议纪要与行动项。
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-gray-700">
                <div className="inline-flex items-center gap-2 font-semibold text-gray-900">
                  <CalendarCheck2 className="h-4 w-4" />
                  使用建议
                </div>
                <div className="mt-2">
                  会后立刻粘贴 transcript，先生成纪要，再把待办推到任务中心，减少后续遗漏。
                </div>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
