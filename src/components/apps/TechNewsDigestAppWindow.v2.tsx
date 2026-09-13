"use client";

import { useEffect, useMemo, useState } from "react";
import { Compass, FilePlus2, Newspaper, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createNewsDigest,
  getNewsDigests,
  removeNewsDigest,
  subscribeNewsDigests,
  updateNewsDigest,
  type NewsDigestRecord,
} from "@/lib/news-digest";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import {
  requestOpenCreatorRadar,
  requestOpenKnowledgeVault,
  requestOpenMorningBrief,
} from "@/lib/ui-events";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody, CardDivider } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

function buildLocalDigest(item: NewsDigestRecord) {
  return [
    "【Tech / Market Digest】",
    `- 主题：${item.title || "未填写"}`,
    `- 来源：${item.sources || "未填写"}`,
    `- 关注重点：${item.focus || "未填写"}`,
    `- 面向对象：${item.audience || "未填写"}`,
    "",
    "【值得关注】",
    "- 趋势 1：挑一个变化最快、最可能影响当前业务或内容方向的主题。",
    "- 趋势 2：留意谁在发布新产品、新接口或新分发策略。",
    "- 趋势 3：记录可以马上转成内容或行动的信号。",
    "",
    "【下一步】",
    "- 如果适合做内容，送到 Creator Radar 继续整理选题。",
    "- 如果影响今天节奏，送到 Morning Brief 写入今日重点。",
    "- 对长期有效的资料，沉淀到 Knowledge Vault。",
  ].join("\n");
}

export function TechNewsDigestAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [digests, setDigests] = useState<NewsDigestRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getNewsDigests();
      setDigests(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeNewsDigests(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => digests.find((item) => item.id === selectedId) ?? null,
    [digests, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<NewsDigestRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateNewsDigest(selected.id, patch);
  };

  const createNew = () => {
    const id = createNewsDigest();
    setSelectedId(id);
    showToast("已新增 digest", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeNewsDigest(selected.id);
    setSelectedId(null);
    showToast("digest 已删除", "ok");
  };

  const generateDigest = async () => {
    if (!selected) {
      showToast("请先选择 digest", "error");
      return;
    }
    const fallback = buildLocalDigest(selected);
    const taskId = createTask({
      name: "Assistant - Tech news digest",
      status: "running",
      detail: selected.title,
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Multi-Source Tech News Digest 助手。请根据用户给出的来源、主题和关注重点，输出一份中文摘要。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先总结今天最值得关注的 3-5 个信号。\n" +
        "2) 指出哪些适合转成内容选题，哪些会影响今天的工作优先级。\n" +
        "3) 给出一个明确下一步。\n\n" +
        `主题：${selected.title}\n` +
        `来源：${selected.sources || "(未填)"}\n` +
        `关注重点：${selected.focus || "(未填)"}\n` +
        `面向对象：${selected.audience || "(未填)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-tech-news-digest",
        timeoutSeconds: 90,
      });
      patchSelected({ digest: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("tech digest 已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ digest: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地摘要", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDigest = () => {
    if (!selected?.digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Tech"} Digest`,
      body: selected.digest,
      tags: ["tech-news", "digest"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToCreatorRadar = () => {
    if (!selected?.digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    requestOpenCreatorRadar({
      title: selected.title || "News-derived angle",
      channels: selected.sources,
      audience: selected.audience,
      goal: "从这份 digest 里挑出今天最值得做的内容角度",
      notes: selected.digest,
    });
    showToast("已发送到 Creator Radar", "ok");
  };

  const sendToMorningBrief = () => {
    if (!selected?.digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    requestOpenMorningBrief({
      focus: selected.title || "今日 tech / market 变化",
      notes: selected.digest,
    });
    showToast("已发送到 Morning Brief", "ok");
  };

  const sendToVault = () => {
    if (!selected?.digest.trim()) {
      showToast("请先生成摘要", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query: `请基于以下 tech / market digest，整理成长期可复用的观察清单、资料来源和追踪框架：\n${selected.digest}`,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Tech News Digest"
      icon={Newspaper}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.tech_news_digest"
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
                Multi-Source Tech / Market News Digest
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                对应案例库里的 Multi-Source Tech News Digest，把信息摄取、摘要和后续动作串起来。
              </p>
            </div>
            <Badge variant="info" size="md">
              digests {digests.length}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="Digest briefs"
                actions={
                  <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={createNew}>
                    新建
                  </Button>
                }
              />
              <CardDivider />
              <CardBody spacing="sm">
                {digests.length > 0 ? (
                  digests.map((item) => {
                    const isActive = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={[
                          "w-full rounded-xl border p-3 text-left transition-all",
                          isActive
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {item.sources || "未填写来源"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    还没有 tech digest。
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
                    title="输入上下文"
                    subtitle="填来源、跟踪主题和关注重点，再生成一份可行动的 digest"
                    actions={
                      <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={deleteSelected}>
                        删除
                      </Button>
                    }
                  />
                  <CardDivider />
                  <CardBody spacing="md">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Input
                        value={selected.title}
                        onChange={(e) => patchSelected({ title: e.target.value })}
                        placeholder="主题，例如 AI agent infra / creator economy"
                        fullWidth
                      />
                      <Input
                        value={selected.audience}
                        onChange={(e) => patchSelected({ audience: e.target.value })}
                        placeholder="面向对象，例如 创作者团队 / 产品团队"
                        fullWidth
                      />
                      <div className="md:col-span-2">
                        <Input
                          value={selected.sources}
                          onChange={(e) => patchSelected({ sources: e.target.value })}
                          placeholder="来源，例如 RSS / X / GitHub / newsletters / blogs"
                          fullWidth
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Textarea
                          value={selected.focus}
                          onChange={(e) => patchSelected({ focus: e.target.value })}
                          placeholder="关注重点，例如 新模型发布、API 变更、分发策略、增长信号"
                          rows={5}
                          fullWidth
                        />
                      </div>
                    </div>
                  </CardBody>
                </>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                  先新建一个 digest。
                </div>
              )}
            </Card>

            <Card padding="md">
              <CardHeader
                title="今日摘要"
                subtitle="生成后可以直接转到 Creator Radar、Morning Brief 或 Knowledge Vault"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Sparkles className="h-4 w-4" />}
                      onClick={generateDigest}
                      disabled={!selected || isGenerating}
                      loading={isGenerating}
                    >
                      {isGenerating ? "生成中..." : "生成摘要"}
                    </Button>
                    <Button size="sm" variant="secondary" icon={<FilePlus2 className="h-4 w-4" />} onClick={saveDigest}>
                      存草稿
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Compass className="h-4 w-4" />} onClick={sendToCreatorRadar}>
                      发到 Creator Radar
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Newspaper className="h-4 w-4" />} onClick={sendToMorningBrief}>
                      发到 Morning Brief
                    </Button>
                    <Button size="sm" variant="secondary" onClick={sendToVault}>
                      发到知识库
                    </Button>
                  </div>
                }
              />
              <CardDivider />
              <CardBody spacing="md">
                <Textarea
                  value={selected?.digest ?? ""}
                  onChange={(e) => patchSelected({ digest: e.target.value })}
                  placeholder="这里会生成今天最值得关注的信号，以及应该转成内容还是行动。"
                  rows={15}
                  fullWidth
                />
              </CardBody>
            </Card>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
