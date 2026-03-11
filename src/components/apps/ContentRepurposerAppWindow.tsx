"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
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
import { createDraft } from "@/lib/drafts";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp, type ContentRepurposerPrefill } from "@/lib/ui-events";

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
    const onPrefill = (event: Event) => {
      const detail = (event as CustomEvent<ContentRepurposerPrefill>).detail;
      const id = createContentRepurposerProject({
        title: detail?.title ?? "",
        sourceType: detail?.sourceType ?? "youtube",
        audience: detail?.audience ?? "",
        goal: detail?.goal ?? "",
        sourceContent: detail?.sourceContent ?? "",
      });
      setSelectedId(id);
      showToast("已带入 repurpose 上下文", "ok");
    };
    window.addEventListener("openclaw:content-repurposer-prefill", onPrefill);
    return () =>
      window.removeEventListener("openclaw:content-repurposer-prefill", onPrefill);
  }, [showToast]);

  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
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

  const generatePack = async () => {
    if (!selected) {
      showToast("请先选择项目", "error");
      return;
    }
    const fallback = buildLocalPack(selected);
    const taskId = createTask({
      name: "Assistant - Content repurposer",
      status: "running",
      detail: selected.title,
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
      patchSelected({ contentPack: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("内容包已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ contentPack: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("OpenClaw 不可用，已切换本地内容包", "error");
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
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToPublisher = () => {
    if (!selected?.contentPack.trim()) {
      showToast("请先生成内容包", "error");
      return;
    }
    createDraft({
      title: `${selected.title || "Repurpose"} Publish Pack`,
      body: selected.contentPack,
      tags: ["repurpose", "publish-ready"],
      source: "import",
    });
    requestOpenApp("publisher");
    showToast("已存草稿并打开发布中心", "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Content Repurposer"
      icon={RefreshCw}
      widthClassName="w-[1200px]"
      storageKey="openclaw.window.content_repurposer"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">
                Content Repurposer / Long-form to Shorts
              </div>
              <div className="mt-1 text-sm text-gray-500">
                对应高频内容生产场景：把长视频、播客、文章拆成短视频、帖子和 newsletter。
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              projects {projects.length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">Repurpose packs</div>
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
                {projects.length > 0 ? (
                  projects.map((project) => {
                    const isActive = project.id === selectedId;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setSelectedId(project.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          isActive
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{project.title}</div>
                        <div className={["mt-1 text-xs", isActive ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {project.sourceType}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有 repurpose pack。
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
                      <div className="text-sm font-semibold text-gray-900">源内容</div>
                      <div className="mt-1 text-xs text-gray-500">
                        填长内容摘要、逐字稿或观点笔记，再生成多平台内容包。
                      </div>
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
                    <input
                      value={selected.title}
                      onChange={(e) => patchSelected({ title: e.target.value })}
                      placeholder="主题 / 项目名"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={selected.sourceType}
                      onChange={(e) =>
                        patchSelected({ sourceType: e.target.value as RepurposeSourceType })
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {sourceTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={selected.audience}
                      onChange={(e) => patchSelected({ audience: e.target.value })}
                      placeholder="目标受众"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={selected.goal}
                      onChange={(e) => patchSelected({ goal: e.target.value })}
                      placeholder="目标，例如 导流、教育、涨粉"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      value={selected.sourceContent}
                      onChange={(e) => patchSelected({ sourceContent: e.target.value })}
                      placeholder="粘贴逐字稿、摘要、show notes、直播纪要或文章正文"
                      className="md:col-span-2 h-44 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  先新建一个 repurpose pack。
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">多平台内容包</div>
                  <div className="mt-1 text-xs text-gray-500">
                    生成短视频口播、社媒帖子和 newsletter 摘要，便于继续编辑和发布。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generatePack}
                    disabled={!selected || isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成内容包"}
                  </button>
                  <button
                    type="button"
                    onClick={savePack}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    存草稿
                  </button>
                  <button
                    type="button"
                    onClick={sendToPublisher}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                    发到发布中心
                  </button>
                </div>
              </div>

              <textarea
                value={selected?.contentPack ?? ""}
                onChange={(e) => patchSelected({ contentPack: e.target.value })}
                placeholder="这里会生成适合多个平台继续加工或发布的内容包。"
                className="mt-4 h-[340px] w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
