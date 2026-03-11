"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  Layers,
  PlayCircle,
  Rocket,
  Sparkles,
} from "lucide-react";

import type { AppId, AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { appCatalog, getAppDisplayName, getCategoryLabel, getDisplayLanguage } from "@/lib/app-display";
import {
  getIndustryBundle,
  industries,
  listBundlesByIndustry,
  mapIndustryToWorkspaceIndustry,
  type IndustryId,
} from "@/lib/industry-solutions";
import type { PlaybookAction } from "@/lib/playbooks";
import { defaultSettings, loadSettings, saveSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp } from "@/lib/ui-events";

type CopySet = {
  title: string;
  subtitle: string;
  applyWorkspace: string;
  openCore: string;
  launchDesk: string;
  openSolutions: string;
  sourceCases: string;
  packagedApps: string;
  workspaceResult: string;
  openedApps: string;
  highlights: string;
  workspaceApps: string;
  appRoles: string;
  quickFlows: string;
  copyUseCases: string;
  runFlow: string;
  dashboard: string;
  shortcuts: string;
  runShortcut: string;
  workspaceBuilder: string;
  workspaceBuilderDesc: string;
  desktopSelection: string;
  dockSelection: string;
  applyCustomWorkspace: string;
  resetTemplate: string;
  addToDesktop: string;
  pinToDock: string;
  required: string;
  selectedCount: string;
  templates: string;
  todaysFocus: string;
  launchSequence: string;
};

function getCopy(language: InterfaceLanguage): CopySet {
  if (language === "en-US") {
    return {
      title: "Industry App Center",
      subtitle:
        "Package mature OpenClaw use cases into ready-to-run industry workbenches and apply them directly to your desktop.",
      applyWorkspace: "Apply to Workspace",
      openCore: "Open Core Apps",
      launchDesk: "Launch Industry Desk",
      openSolutions: "Open Solutions Hub",
      sourceCases: "Referenced use cases",
      packagedApps: "Packaged apps",
      workspaceResult: "Workspace applied",
      openedApps: "Core apps opened",
      highlights: "Why this bundle works",
      workspaceApps: "Workspace apps",
      appRoles: "App roles",
      quickFlows: "Recommended flows",
      copyUseCases: "Copy use cases",
      runFlow: "Run flow",
      dashboard: "Industry dashboard",
      shortcuts: "High-frequency shortcuts",
      runShortcut: "Run shortcut",
      workspaceBuilder: "Workspace builder",
      workspaceBuilderDesc:
        "Choose the apps you want to keep on desktop and pin to Dock, then generate your own industry workspace.",
      desktopSelection: "Desktop apps",
      dockSelection: "Dock apps",
      applyCustomWorkspace: "Apply custom workspace",
      resetTemplate: "Reset to template",
      addToDesktop: "Desktop",
      pinToDock: "Dock",
      required: "Required",
      selectedCount: "selected",
      templates: "templates",
      todaysFocus: "Today's recommended actions",
      launchSequence: "Default launch sequence",
    };
  }
  if (language === "ja-JP") {
    return {
      title: "業界アプリセンター",
      subtitle:
        "成熟した OpenClaw 活用例を業界別ワークベンチとしてまとめ、デスクトップへそのまま適用できます。",
      applyWorkspace: "ワークスペースに適用",
      openCore: "主要アプリを開く",
      launchDesk: "業界デスクを起動",
      openSolutions: "Solutions Hub を開く",
      sourceCases: "参照ユースケース",
      packagedApps: "パッケージ済みアプリ",
      workspaceResult: "ワークスペースを適用しました",
      openedApps: "主要アプリを開きました",
      highlights: "この構成が有効な理由",
      workspaceApps: "ワークスペース構成",
      appRoles: "アプリの役割",
      quickFlows: "おすすめフロー",
      copyUseCases: "ユースケースをコピー",
      runFlow: "フローを実行",
      dashboard: "業界ダッシュボード",
      shortcuts: "高頻度ショートカット",
      runShortcut: "ショートカット実行",
      workspaceBuilder: "ワークスペースビルダー",
      workspaceBuilderDesc:
        "デスクトップと Dock に置くアプリを選び、業界テンプレートを自分用に調整します。",
      desktopSelection: "デスクトップアプリ",
      dockSelection: "Dock アプリ",
      applyCustomWorkspace: "カスタム構成を適用",
      resetTemplate: "テンプレートに戻す",
      addToDesktop: "デスクトップ",
      pinToDock: "Dock",
      required: "必須",
      selectedCount: "選択済み",
      templates: "テンプレート",
      todaysFocus: "今日の推奨アクション",
      launchSequence: "既定の起動順序",
    };
  }
  return {
    title: "行业应用中心",
    subtitle:
      "把 awesome-openclaw-usecases 里成熟的落地场景，按行业打包成可直接使用的工作台和 app 组合。",
    applyWorkspace: "应用到工作台",
    openCore: "打开核心应用",
    launchDesk: "启动行业桌面",
    openSolutions: "打开方案库",
    sourceCases: "参考场景",
    packagedApps: "组合应用",
    workspaceResult: "已应用到当前工作台",
    openedApps: "已打开核心应用",
    highlights: "为什么这样组合",
    workspaceApps: "工作台配备",
    appRoles: "应用分工",
    quickFlows: "推荐流程",
    copyUseCases: "复制 use cases",
    runFlow: "运行流程",
    dashboard: "行业首页面板",
    shortcuts: "高频快捷入口",
    runShortcut: "执行快捷入口",
    workspaceBuilder: "工作台配置器",
    workspaceBuilderDesc: "选择要放到桌面和 Dock 的 app，把行业模板微调成你自己的工作台。",
    desktopSelection: "桌面应用",
    dockSelection: "Dock 应用",
    applyCustomWorkspace: "应用自定义工作台",
    resetTemplate: "恢复推荐模板",
    addToDesktop: "桌面",
    pinToDock: "Dock",
    required: "必选",
    selectedCount: "已选",
    templates: "套模板",
    todaysFocus: "今日推荐动作",
    launchSequence: "默认启动顺序",
  };
}

function getShortcutAccentClasses(accent: "slate" | "blue" | "emerald" | "amber" | "rose") {
  switch (accent) {
    case "blue":
      return {
        wrap: "border-blue-200 bg-blue-50",
        button: "bg-blue-600 hover:bg-blue-700",
      };
    case "emerald":
      return {
        wrap: "border-emerald-200 bg-emerald-50",
        button: "bg-emerald-600 hover:bg-emerald-700",
      };
    case "amber":
      return {
        wrap: "border-amber-200 bg-amber-50",
        button: "bg-amber-500 hover:bg-amber-600",
      };
    case "rose":
      return {
        wrap: "border-rose-200 bg-rose-50",
        button: "bg-rose-600 hover:bg-rose-700",
      };
    default:
      return {
        wrap: "border-gray-200 bg-gray-50",
        button: "bg-gray-900 hover:bg-black",
      };
  }
}

const REQUIRED_DESKTOP_APPS: AppId[] = ["industry_hub", "settings"];
const REQUIRED_DOCK_APPS: AppId[] = ["industry_hub"];

function uniqueAppIds(appIds: AppId[]) {
  return appIds.filter((appId, index) => appIds.indexOf(appId) === index);
}

export function IndustryHubAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(
    defaultSettings.personalization.interfaceLanguage,
  );
  const [industryId, setIndustryId] = useState<IndustryId>("creator_media");
  const [selectedBundleId, setSelectedBundleId] = useState("creator-command");
  const [selectedDesktopApps, setSelectedDesktopApps] = useState<AppId[]>([]);
  const [selectedDockApps, setSelectedDockApps] = useState<AppId[]>([]);
  const { toast, showToast } = useTimedToast(1800);
  const displayLanguage = getDisplayLanguage(interfaceLanguage);
  const copy = useMemo(() => getCopy(interfaceLanguage), [interfaceLanguage]);

  useEffect(() => {
    const sync = () => setInterfaceLanguage(loadSettings().personalization.interfaceLanguage);
    sync();
    window.addEventListener("openclaw:settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("openclaw:settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const bundles = useMemo(() => listBundlesByIndustry(industryId), [industryId]);
  const selectedBundle = useMemo(
    () => bundles.find((bundle) => bundle.id === selectedBundleId) ?? bundles[0] ?? null,
    [bundles, selectedBundleId],
  );

  useEffect(() => {
    if (!bundles.some((bundle) => bundle.id === selectedBundleId)) {
      setSelectedBundleId(bundles[0]?.id ?? selectedBundleId);
    }
  }, [bundles, selectedBundleId]);

  useEffect(() => {
    if (!selectedBundle) return;
    setSelectedDesktopApps(uniqueAppIds([...selectedBundle.desktopApps, ...REQUIRED_DESKTOP_APPS]));
    setSelectedDockApps(uniqueAppIds([...selectedBundle.dockApps, ...REQUIRED_DOCK_APPS]));
  }, [selectedBundle]);

  const builderApps = useMemo(() => {
    if (!selectedBundle) return [] as AppId[];
    return uniqueAppIds([
      ...selectedBundle.desktopApps,
      ...selectedBundle.dockApps,
      ...selectedBundle.featuredApps,
      ...selectedBundle.launchSequence,
      ...selectedBundle.appSpotlights.map((item) => item.appId),
      ...REQUIRED_DESKTOP_APPS,
    ]);
  }, [selectedBundle]);

  const builderGroups = useMemo(() => {
    const appCategoryMap = new Map(appCatalog.map((item) => [item.id, item.category]));
    const grouped = new Map<string, AppId[]>();
    builderApps.forEach((appId) => {
      const category = appCategoryMap.get(appId) ?? "workflow";
      const list = grouped.get(category) ?? [];
      grouped.set(category, [...list, appId]);
    });
    return Array.from(grouped.entries()).map(([category, apps]) => ({
      category,
      label: getCategoryLabel(category as Parameters<typeof getCategoryLabel>[0], interfaceLanguage),
      apps,
    }));
  }, [builderApps, interfaceLanguage]);

  const applyWorkspace = (bundleId: string, desktopApps?: AppId[], dockApps?: AppId[]) => {
    const bundle = getIndustryBundle(bundleId);
    if (!bundle) return;
    const nextDesktopApps = uniqueAppIds([
      ...(desktopApps ?? bundle.desktopApps),
      ...REQUIRED_DESKTOP_APPS,
    ]);
    const nextDockApps = uniqueAppIds([
      ...(dockApps ?? bundle.dockApps).filter((appId) => nextDesktopApps.includes(appId)),
      ...REQUIRED_DOCK_APPS,
    ]);
    const settings = loadSettings();
    saveSettings({
      ...settings,
      personalization: {
        ...settings.personalization,
        activeIndustry: mapIndustryToWorkspaceIndustry(bundle.industryId),
        useCustomWorkspace: true,
        activeScenarioId: bundle.id,
        customDesktopApps: nextDesktopApps,
        customDockApps: nextDockApps,
      },
    });
    showToast(copy.workspaceResult, "ok");
  };

  const openCoreApps = (apps: AppId[]) => {
    apps.slice(0, 4).forEach((appId, index) => {
      window.setTimeout(() => requestOpenApp(appId), index * 90);
    });
    showToast(copy.openedApps, "ok");
  };

  const launchIndustryDesk = () => {
    if (!selectedBundle) return;
    applyWorkspace(selectedBundle.id);
    selectedBundle.launchSequence.forEach((appId, index) => {
      window.setTimeout(() => requestOpenApp(appId), 120 + index * 90);
    });
    showToast(copy.openedApps, "ok");
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(displayLanguage === "en" ? "Copied" : displayLanguage === "ja" ? "コピーしました" : "已复制", "ok");
    } catch {
      showToast(displayLanguage === "en" ? "Copy failed" : displayLanguage === "ja" ? "コピー失敗" : "复制失败", "error");
    }
  };

  const runActions = (actions: PlaybookAction[]) => {
    actions.forEach((action, index) => {
      window.setTimeout(() => {
        if (action.type === "open_app") requestOpenApp(action.appId);
        if (action.type === "copy") void copyText(action.text);
      }, index * 90);
    });
  };

  const toggleDesktopApp = (appId: AppId) => {
    if (REQUIRED_DESKTOP_APPS.includes(appId)) return;
    const nextDesktopApps = selectedDesktopApps.includes(appId)
      ? selectedDesktopApps.filter((item) => item !== appId)
      : [...selectedDesktopApps, appId];
    const normalizedDesktopApps = uniqueAppIds([...nextDesktopApps, ...REQUIRED_DESKTOP_APPS]);
    setSelectedDesktopApps(normalizedDesktopApps);
    setSelectedDockApps((current) => current.filter((item) => normalizedDesktopApps.includes(item)));
  };

  const toggleDockApp = (appId: AppId) => {
    setSelectedDesktopApps((desktopCurrent) =>
      desktopCurrent.includes(appId)
        ? desktopCurrent
        : uniqueAppIds([...desktopCurrent, appId, ...REQUIRED_DESKTOP_APPS]),
    );
    setSelectedDockApps((current) => {
      if (REQUIRED_DOCK_APPS.includes(appId)) return uniqueAppIds([...current, ...REQUIRED_DOCK_APPS]);
      return current.includes(appId)
        ? current.filter((item) => item !== appId)
        : uniqueAppIds([...current, appId, ...REQUIRED_DOCK_APPS]);
    });
  };

  const resetBuilder = () => {
    if (!selectedBundle) return;
    setSelectedDesktopApps(uniqueAppIds([...selectedBundle.desktopApps, ...REQUIRED_DESKTOP_APPS]));
    setSelectedDockApps(uniqueAppIds([...selectedBundle.dockApps, ...REQUIRED_DOCK_APPS]));
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title={copy.title}
      icon={BriefcaseBusiness}
      widthClassName="w-[1220px]"
      storageKey="openclaw.window.industry_hub"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">{copy.title}</div>
              <div className="mt-1 text-sm text-gray-500">{copy.subtitle}</div>
            </div>
            <button
              type="button"
              onClick={() => requestOpenApp("solutions_hub")}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              <Layers className="h-4 w-4" />
              {copy.openSolutions}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {industries.map((industry) => {
              const selected = industry.id === industryId;
              const bundleCount = listBundlesByIndustry(industry.id).length;
              return (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => setIndustryId(industry.id)}
                  className={[
                    "w-full rounded-2xl border p-4 text-left transition-colors",
                    selected
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold">{industry.title}</div>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        selected ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {bundleCount} {copy.templates}
                    </span>
                  </div>
                  <div className={["mt-1 text-xs", selected ? "text-white/75" : "text-gray-500"].join(" ")}>
                    {industry.desc}
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {bundles.map((bundle) => {
                const selected = bundle.id === selectedBundle?.id;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setSelectedBundleId(bundle.id)}
                    className={[
                      "rounded-2xl border p-5 text-left transition-colors",
                      selected
                        ? "border-blue-500 bg-blue-50/70"
                        : "border-gray-200 bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{bundle.title}</div>
                        <div className="mt-1 text-sm text-gray-600">{bundle.summary}</div>
                      </div>
                      <Sparkles className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bundle.sourceUseCases.slice(0, 3).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBundle ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{selectedBundle.title}</div>
                    <div className="mt-1 text-sm text-gray-600">{selectedBundle.summary}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyWorkspace(selectedBundle.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {copy.applyWorkspace}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCoreApps(selectedBundle.featuredApps)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Rocket className="h-4 w-4" />
                      {copy.openCore}
                    </button>
                    <button
                      type="button"
                      onClick={launchIndustryDesk}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <PlayCircle className="h-4 w-4" />
                      {copy.launchDesk}
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.shortcuts}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                    {selectedBundle.shortcutButtons.map((shortcut) => {
                      const accent = getShortcutAccentClasses(shortcut.accent);
                      return (
                        <div
                          key={`${selectedBundle.id}:${shortcut.title}`}
                          className={[
                            "rounded-2xl border p-4",
                            accent.wrap,
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{shortcut.title}</div>
                              <div className="mt-1 text-sm text-gray-600">{shortcut.caption}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => runActions(shortcut.actions)}
                              className={[
                                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors",
                                accent.button,
                              ].join(" ")}
                            >
                              <PlayCircle className="h-4 w-4" />
                              {copy.runShortcut}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {shortcut.actions.map((action) => (
                              <span
                                key={`${shortcut.title}:${action.label}`}
                                className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                              >
                                {action.type === "open_app"
                                  ? getAppDisplayName(action.appId, action.appId, interfaceLanguage)
                                  : action.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.dashboard}</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {selectedBundle.dashboardCards.map((card) => (
                      <div
                        key={`${selectedBundle.id}:${card.label}`}
                        className="rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {card.label}
                        </div>
                        <div className="mt-2 text-lg font-bold text-gray-900">{card.value}</div>
                        <div className="mt-1 text-xs text-gray-500">{card.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{copy.workspaceBuilder}</div>
                      <div className="mt-1 text-sm text-gray-600">{copy.workspaceBuilderDesc}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={resetBuilder}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                      >
                        {copy.resetTemplate}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          selectedBundle &&
                          applyWorkspace(selectedBundle.id, selectedDesktopApps, selectedDockApps)
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {copy.applyCustomWorkspace}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                      {builderGroups.map((group) => (
                        <div key={group.category} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                            {group.label}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {group.apps.map((appId) => {
                              const inDesktop = selectedDesktopApps.includes(appId);
                              const inDock = selectedDockApps.includes(appId);
                              const requiredDesktop = REQUIRED_DESKTOP_APPS.includes(appId);
                              const requiredDock = REQUIRED_DOCK_APPS.includes(appId);
                              return (
                                <div
                                  key={`${selectedBundle.id}:builder:${appId}`}
                                  className="rounded-2xl border border-gray-200 bg-white p-4"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {getAppDisplayName(appId, appId, interfaceLanguage)}
                                      </div>
                                      {(requiredDesktop || requiredDock) ? (
                                        <div className="mt-1 text-xs font-semibold text-gray-500">
                                          {copy.required}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleDesktopApp(appId)}
                                      disabled={requiredDesktop}
                                      className={[
                                        "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                        inDesktop
                                          ? "bg-gray-900 text-white hover:bg-black"
                                          : "border border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100",
                                        requiredDesktop ? "cursor-default opacity-70" : "",
                                      ].join(" ")}
                                    >
                                      {copy.addToDesktop}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleDockApp(appId)}
                                      disabled={requiredDock}
                                      className={[
                                        "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                                        inDock
                                          ? "bg-blue-600 text-white hover:bg-blue-700"
                                          : "border border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100",
                                        requiredDock ? "cursor-default opacity-70" : "",
                                      ].join(" ")}
                                    >
                                      {copy.pinToDock}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">{copy.desktopSelection}</div>
                      <div className="mt-2 text-xs text-gray-500">
                        {selectedDesktopApps.length} {copy.selectedCount}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDesktopApps.map((appId) => (
                          <span
                            key={`${selectedBundle.id}:desktop:${appId}`}
                            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                          >
                            {getAppDisplayName(appId, appId, interfaceLanguage)}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 text-sm font-semibold text-gray-900">{copy.dockSelection}</div>
                      <div className="mt-2 text-xs text-gray-500">
                        {selectedDockApps.length} {copy.selectedCount}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedDockApps.map((appId) => (
                          <span
                            key={`${selectedBundle.id}:dock:${appId}`}
                            className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700"
                          >
                            {getAppDisplayName(appId, appId, interfaceLanguage)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.sourceCases}</div>
                    <div className="mt-3 space-y-2">
                      {selectedBundle.sourceUseCases.map((item) => (
                        <div key={item} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.packagedApps}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBundle.featuredApps.map((appId) => (
                        <button
                          key={appId}
                          type="button"
                          onClick={() => requestOpenApp(appId)}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 text-sm font-semibold text-gray-900">{copy.workspaceApps}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBundle.desktopApps.map((appId) => (
                        <span
                          key={appId}
                          className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.highlights}</div>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
                      {selectedBundle.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.todaysFocus}</div>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
                      {selectedBundle.todayChecklist.map((item) => (
                        <li key={`${selectedBundle.id}:${item}`}>{item}</li>
                      ))}
                    </ol>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedBundle.launchSequence.map((appId) => (
                        <button
                          key={`${selectedBundle.id}:launch:${appId}`}
                          type="button"
                          onClick={() => requestOpenApp(appId)}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                        >
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900">{copy.appRoles}</div>
                      <button
                        type="button"
                        onClick={() => copyText(selectedBundle.sourceUseCases.join("\n"))}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                      >
                        <Copy className="h-4 w-4" />
                        {copy.copyUseCases}
                      </button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedBundle.appSpotlights.map((item) => (
                        <div
                          key={`${selectedBundle.id}:${item.appId}`}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {getAppDisplayName(item.appId, item.appId, interfaceLanguage)}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-gray-500">
                                {item.role}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => requestOpenApp(item.appId)}
                              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                            >
                              {displayLanguage === "en" ? "Open" : displayLanguage === "ja" ? "開く" : "打开"}
                            </button>
                          </div>
                          <div className="mt-2 text-sm text-gray-600">{item.outcome}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-sm font-semibold text-gray-900">{copy.quickFlows}</div>
                    <div className="mt-3 space-y-3">
                      {selectedBundle.quickActions.map((flow) => (
                        <div
                          key={`${selectedBundle.id}:${flow.title}`}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{flow.title}</div>
                              <div className="mt-1 text-sm text-gray-600">{flow.desc}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => runActions(flow.actions)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                            >
                              <PlayCircle className="h-4 w-4" />
                              {copy.runFlow}
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {flow.actions.map((action) => (
                              <span
                                key={`${flow.title}:${action.label}`}
                                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                              >
                                {action.type === "open_app"
                                  ? getAppDisplayName(action.appId, action.appId, interfaceLanguage)
                                  : action.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">{copy.launchSequence}</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {selectedBundle.launchSequence.map((appId, index) => (
                      <div
                        key={`${selectedBundle.id}:sequence:${appId}`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-900">
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-gray-800">
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
