"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Globe2, Plus, Sparkles, Trash2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import {
  createWebsiteSeoRecord,
  getWebsiteSeoRecords,
  removeWebsiteSeoRecord,
  subscribeWebsiteSeo,
  updateWebsiteSeoRecord,
  type WebsitePageType,
  type WebsiteSeoRecord,
} from "@/lib/website-seo-studio";
import { requestOpenApp, requestOpenKnowledgeVault } from "@/lib/ui-events";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

const pageTypeOptions: Array<{ id: WebsitePageType; label: string }> = [
  { id: "homepage", label: "首页" },
  { id: "landing", label: "落地页" },
  { id: "blog", label: "博客文章" },
  { id: "product", label: "产品页" },
  { id: "service", label: "服务页" },
];

function buildLocalBlueprint(item: WebsiteSeoRecord) {
  return [
    "【Site Blueprint】",
    `- 品牌 / 网站：${item.brand || "未填写"}`,
    `- 页面类型：${pageTypeOptions.find((option) => option.id === item.pageType)?.label ?? item.pageType}`,
    `- 目标受众：${item.audience || "未填写"}`,
    `- 核心关键词：${item.primaryKeywords || "未填写"}`,
    `- 核心转化目标：${item.offer || "未填写"}`,
    "",
    "【SEO Strategy】",
    "- 先锁定一个主关键词和 3-5 个辅助关键词，避免一页承载过多目标。",
    "- 标题、首屏文案、H2 和 FAQ 都要围绕搜索意图展开。",
    "- 对比竞品时优先看信息架构、标题口径和 CTA 布局。",
    "",
    "【Page Outline】",
    "- Hero：一句话价值 + 可信证明 + 主 CTA。",
    "- 问题场景：说明用户当前卡点。",
    "- 解决方案：给出产品/服务如何解决。",
    "- FAQ：补足搜索长尾和异议处理。",
    "",
    "【Meta Pack】",
    "- SEO Title：控制在可读范围内，优先核心关键词 + 价值。",
    "- Meta Description：说明对象、问题、结果和 CTA。",
    "",
    "【Next Actions】",
    "- 先确定首屏标题、主 CTA 和 3 个核心板块。",
    "- 把 FAQ 和内链建议写入知识库，方便后续扩页。",
    "- 把页面制作和文案拆成明确任务推进。",
  ].join("\n");
}

function extractNextActions(text: string) {
  const sectionMatch = text.match(/【Next Actions】([\s\S]*)/);
  const source = sectionMatch ? sectionMatch[1] : text;
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function WebsiteSeoStudioAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [records, setRecords] = useState<WebsiteSeoRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const next = getWebsiteSeoRecords();
      setRecords(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeWebsiteSeo(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selected = useMemo(
    () => records.find((item) => item.id === selectedId) ?? null,
    [records, selectedId],
  );

  const patchSelected = (
    patch: Partial<Omit<WebsiteSeoRecord, "id" | "createdAt" | "updatedAt">>,
  ) => {
    if (!selected) return;
    updateWebsiteSeoRecord(selected.id, patch);
  };

  const createNew = () => {
    const id = createWebsiteSeoRecord();
    setSelectedId(id);
    showToast("已新增网站 SEO 项目", "ok");
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeWebsiteSeoRecord(selected.id);
    setSelectedId(null);
    showToast("网站 SEO 项目已删除", "ok");
  };

  const generateBlueprint = async () => {
    if (!selected) {
      showToast("请先选择项目", "error");
      return;
    }
    const fallback = buildLocalBlueprint(selected);
    const taskId = createTask({
      name: "Assistant - Website SEO",
      status: "running",
      detail: selected.brand.slice(0, 80),
    });
    setIsGenerating(true);
    try {
      const message =
        "你是 Website SEO Studio 助手。请根据用户提供的网站信息，输出一份可执行的网站结构与 SEO 优化方案。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "输出必须包含以下标题：\n" +
        "【Site Blueprint】\n【SEO Strategy】\n【Page Outline】\n【Meta Pack】\n【Next Actions】\n" +
        "要求：\n" +
        "1) 明确页面结构、SEO 标题方向、内容块和 FAQ 建议。\n" +
        "2) 兼顾网站制作与自动 SEO 优化。\n" +
        "3) 输出简洁、可执行，不要空话。\n\n" +
        `品牌 / 网站：${selected.brand}\n` +
        `页面类型：${selected.pageType}\n` +
        `目标受众：${selected.audience || "(未填)"}\n` +
        `核心关键词：${selected.primaryKeywords || "(未填)"}\n` +
        `核心转化目标：${selected.offer || "(未填)"}\n` +
        `竞品参考：${selected.competitors || "(未填)"}\n` +
        `补充说明：\n${selected.notes || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-website-seo-studio",
        timeoutSeconds: 120,
      });
      patchSelected({ blueprint: text || fallback });
      updateTask(taskId, { status: "done" });
      showToast("网站 SEO 方案已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      patchSelected({ blueprint: fallback });
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地方案", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!selected?.blueprint.trim()) {
      showToast("请先生成方案", "error");
      return;
    }
    createDraft({
      title: `${selected.brand || "Website"} SEO Blueprint`,
      body: selected.blueprint,
      tags: ["website", "seo"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const sendToVault = () => {
    if (!selected?.blueprint.trim()) {
      showToast("请先生成方案", "error");
      return;
    }
    requestOpenKnowledgeVault({
      query: `请基于以下网站 SEO 方案，整理可复用的页面模板、FAQ、关键词分组和内链结构：\n${selected.blueprint}`,
    });
    showToast("已发送到 Knowledge Vault", "ok");
  };

  const sendToTasks = () => {
    if (!selected?.blueprint.trim()) {
      showToast("请先生成方案", "error");
      return;
    }
    const items = extractNextActions(selected.blueprint);
    if (items.length === 0) {
      showToast("没有可写入的动作项", "error");
      return;
    }
    items.forEach((item) => {
      createTask({
        name: `Website SEO - ${selected.brand || "Website"}`,
        status: "queued",
        detail: item,
      });
    });
    requestOpenApp("task_manager");
    showToast(`已写入 ${items.length} 个任务`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Website SEO Studio"
      icon={Globe2}
      widthClassName="w-[1200px]"
      storageKey="openclaw.window.website_seo_studio"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Website SEO Studio</div>
              <div className="mt-1 text-sm text-gray-500">
                把网站制作和自动 SEO 优化收口到一个工作台里，输出页面结构、Meta、FAQ 和下一步执行清单。
              </div>
            </div>
            <Badge variant="default" size="md">
              项目 {records.length} 个
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="SEO 项目"
                actions={
                  <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={createNew}>
                    新建
                  </Button>
                }
              />
              <CardBody spacing="sm">
                {records.length > 0 ? (
                  records.map((item) => {
                    const activeItem = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-4 text-left transition-colors",
                          activeItem
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.brand}</div>
                        <div className={["mt-1 text-xs", activeItem ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {pageTypeOptions.find((option) => option.id === item.pageType)?.label}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                    还没有网站 SEO 项目。
                  </div>
                )}
              </CardBody>
            </Card>
          </aside>

          <main className="space-y-4">
            {selected ? (
              <>
                <Card padding="md">
                  <CardBody spacing="md">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Input
                        label="品牌 / 网站"
                        value={selected.brand}
                        onChange={(event) => patchSelected({ brand: event.target.value })}
                        placeholder="如：AgentCore Studio"
                        fullWidth
                      />
                      <Input
                        label="目标受众"
                        value={selected.audience}
                        onChange={(event) => patchSelected({ audience: event.target.value })}
                        placeholder="如：SaaS founder / 独立开发者 / 电商品牌"
                        fullWidth
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="page-type-select"
                          className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500"
                        >
                          页面类型
                        </label>
                        <select
                          id="page-type-select"
                          value={selected.pageType}
                          onChange={(event) => patchSelected({ pageType: event.target.value as WebsitePageType })}
                          className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                        >
                          {pageTypeOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="核心转化目标"
                        value={selected.offer}
                        onChange={(event) => patchSelected({ offer: event.target.value })}
                        placeholder="如：预约 Demo / 留资 / 试用注册 / 购买"
                        fullWidth
                      />
                    </div>

                    <Input
                      label="核心关键词"
                      value={selected.primaryKeywords}
                      onChange={(event) => patchSelected({ primaryKeywords: event.target.value })}
                      placeholder="如：AI workflow OS, creator automation, website SEO studio"
                      fullWidth
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Textarea
                        label="竞品参考"
                        value={selected.competitors}
                        onChange={(event) => patchSelected({ competitors: event.target.value })}
                        placeholder="写下竞品站点、标题口径、结构或你想参考的对象。"
                        rows={5}
                        fullWidth
                      />
                      <Textarea
                        label="补充说明"
                        value={selected.notes}
                        onChange={(event) => patchSelected({ notes: event.target.value })}
                        placeholder="写下业务背景、已有页面、想强调的信息架构或 SEO 方向。"
                        rows={5}
                        fullWidth
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        icon={<Sparkles className="h-4 w-4" />}
                        onClick={generateBlueprint}
                        disabled={isGenerating}
                        loading={isGenerating}
                      >
                        {isGenerating ? "生成中..." : "生成网站 SEO 方案"}
                      </Button>
                      <Button variant="secondary" size="md" icon={<FilePlus2 className="h-4 w-4" />} onClick={saveDraft}>
                        写入草稿
                      </Button>
                      <Button variant="secondary" size="md" onClick={sendToVault}>
                        发到知识库
                      </Button>
                      <Button variant="secondary" size="md" onClick={sendToTasks}>
                        发到任务中心
                      </Button>
                      <Button variant="danger" size="md" icon={<Trash2 className="h-4 w-4" />} onClick={deleteSelected}>
                        删除
                      </Button>
                    </div>
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardBody spacing="md">
                    <div className="text-sm font-semibold text-gray-900">输出方案</div>
                    <pre className="min-h-[320px] whitespace-pre-wrap rounded-3xl border border-gray-200 bg-white p-4 text-sm leading-7 text-gray-700">
                      {selected.blueprint || "填写项目信息后生成网站结构与 SEO 优化方案。"}
                    </pre>
                  </CardBody>
                </Card>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
                先新建一个网站 SEO 项目。
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
