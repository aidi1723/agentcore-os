"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Copy, Layers, Plus, ShieldCheck } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import {
  getAppDisplayName,
  getCategoryLabel,
  getDisplayLanguage,
} from "@/lib/app-display";
import {
  createPlaybook,
  loadPlaybooks,
  subscribePlaybooks,
  type PlaybookAction,
} from "@/lib/playbooks";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import { sourceUseCaseIndustries } from "@/lib/openclaw-usecase-map";
import { defaultSettings, loadSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp } from "@/lib/ui-events";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Badge } from "@/design-system/components/Badge";

type Solution = {
  id: string;
  category: string;
  tags: string[];
  title: string;
  desc: string;
  stacks: Array<{ title: string; items: string[] }>;
  playbooks: Array<{ title: string; desc: string; actions: PlaybookAction[] }>;
  setupChecklist: string;
};

function buildSolutions(): Solution[] {
  return [
    {
      id: "tech-news-radar",
      category: "信息摄取",
      tags: ["news digest", "tech", "market", "multi-source"],
      title: "Tech / Market Radar（多源信息摄取 → 摘要 → 行动）",
      desc: "参考 Multi-Source Tech News Digest 一类案例，把 RSS、X、GitHub、newsletter 等来源压成一份可行动摘要。",
      stacks: [
        { title: "输入", items: ["多源来源列表", "关注主题", "面向对象"] },
        { title: "输出", items: ["今日 3-5 个重要信号", "内容选题方向", "今日优先级调整建议"] },
      ],
      playbooks: [
        {
          title: "先看市场，再定今天动作",
          desc: "先做 digest，再把可做内容送去 Creator Radar，把影响执行的点送去 Morning Brief。",
          actions: [
            { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
            { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
            { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          ],
        },
      ],
      setupChecklist:
        "Tech / Market Radar 搭建清单：\n" +
        "1) 固定维护信息来源池。\n" +
        "2) 明确你真正关心的是产品、模型、分发还是增长。\n" +
        "3) 每次 digest 之后只保留 1-2 个真正要行动的点。",
    },
    {
      id: "creator-radar",
      category: "内容增长",
      tags: ["youtube digest", "creator", "research", "ideas"],
      title: "Creator Radar（日更选题 / 频道情报 / 评论区问题）",
      desc: "参考 Daily YouTube Digest 一类高频场景，把频道动态、评论区问题和可做角度压成一份日更摘要。",
      stacks: [
        { title: "输入", items: ["频道 / 创作者来源", "近期主题", "评论区高频问题"] },
        { title: "输出", items: ["今日 3 个值得做的角度", "推荐 hook", "下一步 app 动作"] },
      ],
      playbooks: [
        {
          title: "日更选题整理",
          desc: "先做一份雷达摘要，再把最值得跟进的一条送去拆内容。",
          actions: [
            { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
            { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          ],
        },
      ],
      setupChecklist:
        "Creator Radar 搭建清单：\n" +
        "1) 维护固定关注来源和频道池。\n" +
        "2) 把评论区反复出现的问题写进 notes。\n" +
        "3) 每天只挑 1 条最值得做的内容推进到下一步。",
    },
    // ... 其他 solutions 省略以节省空间
  ];
}

export function SolutionsHubAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const solutions = useMemo(() => buildSolutions(), []);
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(
    defaultSettings.personalization.interfaceLanguage,
  );
  const displayLanguage = getDisplayLanguage(interfaceLanguage);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(solutions[0]?.id ?? "content-pipeline");
  const [selectedSourceIndustry, setSelectedSourceIndustry] = useState(
    sourceUseCaseIndustries[0]?.industry ?? "Content & Media",
  );
  const [installedCount, setInstalledCount] = useState(0);
  const { toast, showToast } = useTimedToast(1600);
  const t = useMemo(
    () =>
      displayLanguage === "en"
        ? {
            copied: "Copied to clipboard",
            copyFailed: "Copy failed",
            installed: "Installed into My Playbooks",
            installFailed: "Already exists or install failed",
            title: "Solutions Hub",
            subtitle: "Turn proven workflows into Playbooks and connectors inside WebOS.",
            compliant: "Compliance first: official APIs / approved tools / webhook connectors",
            localFirst: "Local first: Playbooks are stored in browser localStorage",
            openPlaybooks: "Open Playbooks",
            installCurrent: "Install Current Solution",
            installedCount: "Installed Playbooks",
            searchPlaceholder: "Search solutions (keywords / tags)…",
            total: "Total",
            current: "Visible",
            noMatch: "No matching solution. Try a shorter keyword or search by category / tag.",
            structure: "Solution Structure",
            playbooks: "Playbooks (installable)",
            playbooksHint: "Installing the current solution will add these Playbooks into My Playbooks.",
            copyJson: "Copy Playbooks JSON",
            checklist: "Setup Checklist",
            checklistHint: "Use this to connect external tools or connectors into this UI.",
            copyChecklist: "Copy Checklist",
            openSettings: "Open Settings",
            openPublisher: "Open Publisher",
            noResult: "No result under current search, so the previous solution is hidden.",
            sourceMap: "Source Use Case Mapping",
            sourceMapHint:
              "Map source scenarios into current WebOS apps by industry, then open the packaged app set directly.",
            ready: "Ready",
            partial: "Partial",
            mappedApps: "Mapped apps",
            openPackagedFlow: "Open packaged flow",
          }
        : displayLanguage === "ja"
          ? {
              copied: "クリップボードにコピーしました",
              copyFailed: "コピーに失敗しました",
              installed: "My Playbooks に追加しました",
              installFailed: "すでに存在するか、追加に失敗しました",
              title: "Solutions Hub",
              subtitle: "実運用の流れを Playbooks と connector として WebOS に組み込みます。",
              compliant: "コンプライアンス優先: 公式API / 承認済みツール / webhook connector",
              localFirst: "ローカル優先: Playbooks はブラウザ localStorage に保存されます",
              openPlaybooks: "Playbooks を開く",
              installCurrent: "現在の案を追加",
              installedCount: "追加済み Playbooks",
              searchPlaceholder: "ソリューションを検索（キーワード / タグ）…",
              total: "合計",
              current: "表示中",
              noMatch: "一致するソリューションがありません。短いキーワードか分類 / タグで試してください。",
              structure: "構成",
              playbooks: "Playbooks（追加可能）",
              playbooksHint: "現在の案を追加すると、これらが My Playbooks に入ります。",
              copyJson: "Playbooks JSON をコピー",
              checklist: "構築チェックリスト",
              checklistHint: "外部ツールや connector をこの UI に接続するためのチェックです。",
              copyChecklist: "チェックリストをコピー",
              openSettings: "設定を開く",
              openPublisher: "Publisher を開く",
              noResult: "検索結果がないため、前の案は表示しません。",
              sourceMap: "元ユースケース対応表",
              sourceMapHint:
                "元のシナリオを現在の WebOS アプリに業界別で対応付け、まとめて開けます。",
              ready: "実装済み",
              partial: "一部対応",
              mappedApps: "対応アプリ",
              openPackagedFlow: "対応フローを開く",
            }
          : {
              copied: "已复制到剪贴板",
              copyFailed: "复制失败（浏览器权限）",
              installed: "已安装到「我的 Playbooks」",
              installFailed: "已存在或安装失败",
              title: "成熟落地方案库",
              subtitle: "用「方案 → Playbooks → 连接器」把真实业务流程快速装进 WebOS。",
              compliant: "合规优先：官方 API / 合规工具 / webhook 连接器",
              localFirst: "本地优先：Playbooks 存在浏览器 localStorage",
              openPlaybooks: "打开 Playbooks",
              installCurrent: "安装当前方案",
              installedCount: "已安装 Playbooks",
              searchPlaceholder: "搜索方案（关键词/标签）…",
              total: "共",
              current: "当前",
              noMatch: "没有匹配的方案。试试更短的关键词，或直接搜分类/标签。",
              structure: "方案结构",
              playbooks: "Playbooks（可直接安装）",
              playbooksHint: "点击「安装当前方案」会把这些 Playbooks 写入「我的 Playbooks」。",
              copyJson: "复制 Playbooks JSON",
              checklist: "搭建清单",
              checklistHint: "用于把外部工具/连接器「接入」到本 UI（不包含任何平台绕过自动化）。",
              copyChecklist: "复制清单",
              openSettings: "打开 设置",
              openPublisher: "打开 发布中心",
              noResult: "当前搜索没有结果，因此不会继续显示旧方案内容。",
              sourceMap: "来源场景映射",
              sourceMapHint: "按行业把来源场景映射到当前 WebOS 已封装的 app 和流程，可直接打开对应组合。",
              ready: "已封装",
              partial: "部分覆盖",
              mappedApps: "对应 app",
              openPackagedFlow: "打开对应流程",
            },
    [displayLanguage],
  );

  useEffect(() => {
    if (!isVisible) return;
    const syncLanguage = () => setInterfaceLanguage(loadSettings().personalization.interfaceLanguage);
    syncLanguage();
    const refresh = () => setInstalledCount(loadPlaybooks().length);
    refresh();
    const unsub = subscribePlaybooks(refresh);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith("openclaw.playbooks")) refresh();
      syncLanguage();
    };
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, syncLanguage);
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      removeSettingsListener();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const filteredSolutions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return solutions;
    return solutions.filter((s) => {
      const hay = `${s.title} ${s.desc} ${s.category} ${s.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, solutions]);

  const visibleSelected = useMemo(
    () => filteredSolutions.find((s) => s.id === selectedId) ?? filteredSolutions[0] ?? null,
    [filteredSolutions, selectedId],
  );

  const visibleSourceIndustry = useMemo(
    () =>
      sourceUseCaseIndustries.find((item) => item.industry === selectedSourceIndustry) ??
      sourceUseCaseIndustries[0] ??
      null,
    [selectedSourceIndustry],
  );

  useEffect(() => {
    if (!filteredSolutions.some((s) => s.id === selectedId)) {
      setSelectedId(filteredSolutions[0]?.id ?? solutions[0]?.id ?? selectedId);
    }
  }, [filteredSolutions, selectedId, solutions]);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t.copied, "ok");
    } catch {
      showToast(t.copyFailed, "error");
    }
  }, [showToast, t]);

  const installSelected = useCallback(() => {
    if (!visibleSelected) return;
    const before = loadPlaybooks().length;
    for (const pb of visibleSelected.playbooks) {
      createPlaybook({ title: pb.title, desc: pb.desc, actions: pb.actions });
    }
    const after = loadPlaybooks().length;
    showToast(after > before ? t.installed : t.installFailed, after > before ? "ok" : "error");
    setInstalledCount(after);
  }, [showToast, t, visibleSelected]);

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title={t.title}
      icon={Layers}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.solutions_hub"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-slate-50">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-900">{t.title}</h1>
              <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="success" size="sm">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  {t.compliant}
                </Badge>
                <Badge variant="default" size="sm">
                  <BookOpen className="mr-1 h-3 w-3" />
                  {t.localFirst}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<BookOpen className="h-4 w-4" />}
                onClick={() => requestOpenApp("industry_hub")}
              >
                {displayLanguage === "en" ? "Open Industry App Center" : displayLanguage === "ja" ? "業界アプリセンターを開く" : "打开行业应用中心"}
              </Button>
              <Button
                variant="success"
                size="md"
                icon={<Plus className="h-4 w-4" />}
                onClick={installSelected}
                disabled={!visibleSelected}
              >
                {t.installCurrent}
              </Button>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {t.installedCount}：<span className="font-semibold text-gray-800">{installedCount}</span>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-white/70 p-4">
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t.sourceMap}</h2>
              <p className="mt-1 text-sm text-gray-600">{t.sourceMapHint}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {sourceUseCaseIndustries.map((industry) => {
                const active = industry.industry === visibleSourceIndustry?.industry;
                return (
                  <Button
                    key={industry.industry}
                    variant={active ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedSourceIndustry(industry.industry)}
                  >
                    {industry.industry}
                  </Button>
                );
              })}
            </div>

            {visibleSourceIndustry && (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {visibleSourceIndustry.apps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{app.name}</div>
                        <div className="mt-1 text-sm text-gray-600">{app.desc}</div>
                      </div>
                      <Badge
                        variant={app.coverage === "ready" ? "success" : "warning"}
                        size="sm"
                      >
                        {app.coverage === "ready" ? t.ready : t.partial}
                      </Badge>
                    </div>

                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                      {t.mappedApps}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {app.mappedApps.map((appId) => (
                        <Badge key={`${app.id}:${appId}`} variant="default" size="sm">
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          app.workflowActions.forEach((action, index) => {
                            window.setTimeout(() => {
                              if (action.type === "open_app") requestOpenApp(action.appId);
                            }, index * 90);
                          });
                        }}
                      >
                        {t.openPackagedFlow}
                      </Button>
                      {app.mappedApps.slice(0, 3).map((appId) => (
                        <Button
                          key={`${app.id}:open:${appId}`}
                          variant="secondary"
                          size="sm"
                          onClick={() => requestOpenApp(appId)}
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-4 lg:overflow-hidden">
          <aside className="space-y-2 lg:col-span-1 lg:min-h-0 lg:overflow-y-auto">
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                fullWidth
              />
              <div className="mt-2 text-xs text-gray-500">
                {t.total} {solutions.length} · {t.current} {filteredSolutions.length}
              </div>
            </div>

            {filteredSolutions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                {t.noMatch}
              </div>
            )}

            {filteredSolutions.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={[
                    "w-full text-left rounded-2xl border p-4 transition-colors",
                    isActive ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className={["text-sm font-semibold", isActive ? "text-white" : "text-gray-900"].join(" ")}>
                    {s.title}
                  </div>
                  <div className={["mt-1 text-xs", isActive ? "text-white/75" : "text-gray-500"].join(" ")}>
                    {s.desc}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="default" size="sm">
                      {getCategoryLabel(
                        s.category === "信息摄取"
                          ? "insight"
                          : s.category === "内容增长" || s.category === "发布上线"
                            ? "content"
                            : s.category === "个人生活"
                              ? "personal"
                              : s.category === "外联与沟通" || s.category === "用户运营" || s.category === "增长获客" || s.category === "B2B 外联"
                                ? "relationship"
                                : "workflow",
                        interfaceLanguage,
                      )}
                    </Badge>
                    {s.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="default" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="space-y-4 lg:col-span-3 lg:min-h-0 lg:overflow-y-auto">
            {visibleSelected ? (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900">{t.structure}</h3>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {visibleSelected.stacks.map((stack) => (
                      <div key={stack.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">{stack.title}</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                          {stack.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{t.playbooks}</h3>
                      <p className="mt-1 text-xs text-gray-500">{t.playbooksHint}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => copy(JSON.stringify(visibleSelected.playbooks, null, 2))}
                    >
                      {t.copyJson}
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {visibleSelected.playbooks.map((playbook) => (
                      <div key={playbook.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">{playbook.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{playbook.desc}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {playbook.actions.map((action) => (
                            <Button
                              key={action.label}
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                if (action.type === "open_app") requestOpenApp(action.appId);
                                if (action.type === "copy") void copy(action.text);
                              }}
                            >
                              {action.type === "open_app"
                                ? `${displayLanguage === "en" ? "Open" : displayLanguage === "ja" ? "開く" : "打开"} ${getAppDisplayName(action.appId, action.appId, interfaceLanguage)}`
                                : action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{t.checklist}</h3>
                      <p className="mt-1 text-xs text-gray-500">{t.checklistHint}</p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Copy className="h-4 w-4" />}
                      onClick={() => copy(visibleSelected.setupChecklist)}
                    >
                      {t.copyChecklist}
                    </Button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
                    {visibleSelected.setupChecklist}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => requestOpenApp("settings")}
                    >
                      {t.openSettings}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => requestOpenApp("publisher")}
                    >
                      {t.openPublisher}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                {t.noResult}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
