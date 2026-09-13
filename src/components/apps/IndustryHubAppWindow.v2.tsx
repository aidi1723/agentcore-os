"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  Layers,
  PlayCircle,
  Rocket,
  Sparkles,
  UserRound,
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
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import type { PlaybookAction } from "@/lib/playbooks";
import { defaultSettings, loadSettings, saveSettings, type InterfaceLanguage } from "@/lib/settings";
import { requestOpenApp, type IndustryHubPrefill } from "@/lib/ui-events";
import {
  industrySolutionStarters,
  runIndustrySolutionStarterActions,
  type IndustrySolutionStarter,
} from "@/lib/solution-starters";
import {
  getWorkspaceScenario,
  workspaceRoleDesks,
  type WorkspaceRoleId,
} from "@/lib/workspace-presets";
import {
  getWorkflowRuns,
  startWorkflowRun,
  subscribeWorkflowRuns,
} from "@/lib/workflow-runs";
import { Button } from "@/design-system/components/Button";
import { Badge } from "@/design-system/components/Badge";

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
  roleDesks: string;
  roleDesksDesc: string;
  roleFocus: string;
  applyRoleDesk: string;
  workflowMap: string;
  workflowMapDesc: string;
  resultAssets: string;
  startPoint: string;
  modeAuto: string;
  modeAssist: string;
  modeReview: string;
  modeManual: string;
  triggers: string;
  triggerDesc: string;
  startWorkflow: string;
  advanceWorkflow: string;
  holdForReview: string;
  completeWorkflow: string;
  failWorkflow: string;
  runtimeState: string;
  stateIdle: string;
  stateRunning: string;
  stateAwaitingHuman: string;
  stateCompleted: string;
  stateError: string;
  solutionStarters: string;
  solutionStartersDesc: string;
  starterTrigger: string;
  starterOutcome: string;
  starterAssets: string;
  launchStarter: string;
  starterLaunched: string;
};

function getCopy(language: InterfaceLanguage): CopySet {
  if (language === "en-US") {
    return {
      title: "Industry App Center",
      subtitle:
        "Package mature workflow patterns into ready-to-run industry workbenches and apply them directly to your desktop.",
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
      roleDesks: "Role desks",
      roleDesksDesc: "Enter from your role first, then let the system bring in the matching scenario, apps, and launch order.",
      roleFocus: "Focus",
      applyRoleDesk: "Enter role desk",
      workflowMap: "Default workflow",
      workflowMapDesc: "This is the recommended operating sequence for the selected role desk. It shows where AI assists, where people confirm, and what assets should be retained.",
      resultAssets: "Result assets",
      startPoint: "Start here",
      modeAuto: "Auto",
      modeAssist: "AI assist",
      modeReview: "Human review",
      modeManual: "Manual",
      triggers: "Triggers",
      triggerDesc: "A workflow should not depend only on manual clicking. These are the concrete events that can start the chain.",
      startWorkflow: "Start workflow",
      advanceWorkflow: "Advance",
      holdForReview: "Hold for review",
      completeWorkflow: "Mark complete",
      failWorkflow: "Mark failed",
      runtimeState: "Runtime state",
      stateIdle: "Idle",
      stateRunning: "Running",
      stateAwaitingHuman: "Awaiting human",
      stateCompleted: "Completed",
      stateError: "Error",
      solutionStarters: "Solution starters",
      solutionStartersDesc: "These are runnable industry entry points with seeded context, default apps, and expected outputs.",
      starterTrigger: "Trigger",
      starterOutcome: "Outcome",
      starterAssets: "Assets",
      launchStarter: "Launch starter",
      starterLaunched: "Starter launched",
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
      roleDesks: "ロール別デスク",
      roleDesksDesc: "まず自分の役割から入り、対応するシナリオ、アプリ構成、起動順序をまとめて適用します。",
      roleFocus: "注力ポイント",
      applyRoleDesk: "このデスクに入る",
      workflowMap: "既定ワークフロー",
      workflowMapDesc: "選択中のロール別デスクに対する推奨進行順です。AI が補助する箇所、人が確認すべき箇所、残すべき資産を示します。",
      resultAssets: "残す資産",
      startPoint: "開始地点",
      modeAuto: "自動",
      modeAssist: "AI 補助",
      modeReview: "人の確認",
      modeManual: "手動",
      triggers: "トリガー",
      triggerDesc: "ワークフローは手動クリックだけに依存すべきではありません。ここでは開始イベントを定義します。",
      startWorkflow: "ワークフロー開始",
      advanceWorkflow: "次へ進める",
      holdForReview: "確認待ちにする",
      completeWorkflow: "完了にする",
      failWorkflow: "失敗にする",
      runtimeState: "実行状態",
      stateIdle: "待機中",
      stateRunning: "実行中",
      stateAwaitingHuman: "人の確認待ち",
      stateCompleted: "完了",
      stateError: "失敗",
      solutionStarters: "ソリューションスターター",
      solutionStartersDesc: "業界別の起点をそのまま走らせるための入口です。初期コンテキスト、標準アプリ、期待成果をまとめて適用します。",
      starterTrigger: "トリガー",
      starterOutcome: "成果物",
      starterAssets: "残る資産",
      launchStarter: "起動する",
      starterLaunched: "スターターを起動しました",
    };
  }
  return {
    title: "行业应用中心",
    subtitle:
      "把成熟的落地场景按行业打包成可直接使用的工作台和 app 组合。",
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
    roleDesks: "角色工作台入口",
    roleDesksDesc: "先按角色进入，再让系统带出对应场景、默认应用组合和启动顺序，比先找 App 更接近真实业务入口。",
    roleFocus: "核心关注",
    applyRoleDesk: "进入这个角色工作台",
    workflowMap: "默认工作流",
    workflowMapDesc: "这里定义的是该角色进入后的推荐执行顺序，也标明了 AI 辅助、人工确认和最终该沉淀的业务资产。",
    resultAssets: "结果资产",
    startPoint: "建议起点",
    modeAuto: "自动执行",
    modeAssist: "AI 辅助",
    modeReview: "待人工确认",
    modeManual: "人工收口",
    triggers: "触发器",
    triggerDesc: "工作流不应该只靠手动点开。这里定义它会因什么事件被拉起。",
    startWorkflow: "启动这条流程",
    advanceWorkflow: "推进到下一步",
    holdForReview: "标记待确认",
    completeWorkflow: "标记已完成",
    failWorkflow: "标记失败",
    runtimeState: "运行状态",
    stateIdle: "待启动",
    stateRunning: "运行中",
    stateAwaitingHuman: "等待人工确认",
    stateCompleted: "已完成",
    stateError: "失败",
    solutionStarters: "行业解决方案 Starter",
    solutionStartersDesc: "这里不是再列一组 App，而是给每个行业一个可以直接启动的样板方案，带预填上下文、默认应用和预期结果。",
    starterTrigger: "触发场景",
    starterOutcome: "预期交付",
    starterAssets: "会沉淀的资产",
    launchStarter: "一键启动方案",
    starterLaunched: "已启动解决方案",
  };
}

function getWorkflowModeMeta(
  mode: "auto" | "assist" | "review" | "manual",
  copy: CopySet,
) {
  switch (mode) {
    case "auto":
      return {
        label: copy.modeAuto,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: Bot,
      };
    case "assist":
      return {
        label: copy.modeAssist,
        className: "border-blue-200 bg-blue-50 text-blue-700",
        icon: Sparkles,
      };
    case "review":
      return {
        label: copy.modeReview,
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: UserRound,
      };
    default:
      return {
        label: copy.modeManual,
        className: "border-gray-200 bg-gray-50 text-gray-700",
        icon: BriefcaseBusiness,
      };
  }
}

function getRunStateMeta(state: "idle" | "running" | "awaiting_human" | "completed" | "error", copy: CopySet) {
  switch (state) {
    case "running":
      return { label: copy.stateRunning, className: "border-blue-200 bg-blue-50 text-blue-700" };
    case "awaiting_human":
      return { label: copy.stateAwaitingHuman, className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "completed":
      return { label: copy.stateCompleted, className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "error":
      return { label: copy.stateError, className: "border-red-200 bg-red-50 text-red-700" };
    default:
      return { label: copy.stateIdle, className: "border-gray-200 bg-gray-50 text-gray-700" };
  }
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

function getStarterAccentClasses(accent: IndustrySolutionStarter["accent"]) {
  switch (accent) {
    case "blue":
      return {
        card: "border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#eef2ff_100%)]",
        pill: "border-blue-200 bg-blue-50 text-blue-700",
        button: "bg-blue-600 hover:bg-blue-700",
      };
    case "emerald":
      return {
        card: "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#f0fdf4_100%)]",
        pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
        button: "bg-emerald-600 hover:bg-emerald-700",
      };
    case "amber":
      return {
        card: "border-amber-200 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_55%,#fff7ed_100%)]",
        pill: "border-amber-200 bg-amber-50 text-amber-700",
        button: "bg-amber-500 hover:bg-amber-600",
      };
    case "rose":
      return {
        card: "border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_55%,#fff7ed_100%)]",
        pill: "border-rose-200 bg-rose-50 text-rose-700",
        button: "bg-rose-600 hover:bg-rose-700",
      };
    default:
      return {
        card: "border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#f1f5f9_100%)]",
        pill: "border-slate-200 bg-slate-50 text-slate-700",
        button: "bg-slate-900 hover:bg-black",
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
  const [selectedRoleId, setSelectedRoleId] = useState<WorkspaceRoleId>("creator");
  const [selectedDesktopApps, setSelectedDesktopApps] = useState<AppId[]>([]);
  const [selectedDockApps, setSelectedDockApps] = useState<AppId[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState(getWorkflowRuns());
  const { toast, showToast } = useTimedToast(1800);
  const displayLanguage = getDisplayLanguage(interfaceLanguage);
  const copy = useMemo(() => getCopy(interfaceLanguage), [interfaceLanguage]);

  useEffect(() => {
    const sync = () => setInterfaceLanguage(loadSettings().personalization.interfaceLanguage);
    sync();
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, sync);
    window.addEventListener("storage", sync);
    return () => {
      removeSettingsListener();
      window.removeEventListener("storage", sync);
    };
  }, []);

  const focusWorkflowRun = useCallback(
    (detail?: IndustryHubPrefill | null) => {
      const workflowRunId = detail?.workflowRunId?.trim();
      const scenarioId = detail?.scenarioId?.trim();
      const runs = getWorkflowRuns();
      const run =
        (workflowRunId ? runs.find((item) => item.id === workflowRunId) ?? null : null) ??
        (scenarioId ? runs.find((item) => item.scenarioId === scenarioId) ?? null : null);
      if (!run) {
        showToast("未找到对应 workflow run", "error");
        return;
      }
      const role = workspaceRoleDesks.find((item) => item.scenarioId === run.scenarioId);
      if (role) {
        setSelectedRoleId(role.id);
      }
      const scenario = getWorkspaceScenario(run.scenarioId);
      const industry = industries.find(
        (item) => mapIndustryToWorkspaceIndustry(item.id) === scenario?.industryId,
      );
      if (industry) {
        setIndustryId(industry.id);
      }
      setWorkflowRuns(runs);
      showToast("已定位 workflow run", "ok");
    },
    [showToast],
  );

  useEffect(() => {
    const sync = () => setWorkflowRuns(getWorkflowRuns());
    sync();
    const unsub = subscribeWorkflowRuns(sync);
    window.addEventListener("storage", sync);
    return () => {
      unsub();
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const onPrefill = (event: Event) => {
      focusWorkflowRun((event as CustomEvent<IndustryHubPrefill>).detail);
    };
    window.addEventListener("openclaw:industry-hub-prefill", onPrefill);
    return () => window.removeEventListener("openclaw:industry-hub-prefill", onPrefill);
  }, [focusWorkflowRun]);

  const bundles = useMemo(() => listBundlesByIndustry(industryId), [industryId]);
  const selectedBundle = useMemo(
    () => bundles.find((bundle) => bundle.id === selectedBundleId) ?? bundles[0] ?? null,
    [bundles, selectedBundleId],
  );
  const selectedRoleDesk = useMemo(
    () => workspaceRoleDesks.find((role) => role.id === selectedRoleId) ?? workspaceRoleDesks[0] ?? null,
    [selectedRoleId],
  );
  const selectedRoleScenario = useMemo(
    () => getWorkspaceScenario(selectedRoleDesk?.scenarioId ?? ""),
    [selectedRoleDesk],
  );
  const selectedWorkflowRun = useMemo(
    () => (selectedRoleScenario ? workflowRuns.find((run) => run.scenarioId === selectedRoleScenario.id) ?? null : null),
    [selectedRoleScenario, workflowRuns],
  );
  const starterCards = useMemo(() => {
    return industrySolutionStarters
      .slice()
      .sort((a, b) => {
        if (a.industryId === industryId && b.industryId !== industryId) return -1;
        if (b.industryId === industryId && a.industryId !== industryId) return 1;
        return a.title.localeCompare(b.title);
      });
  }, [industryId]);

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

  const applyRoleDesk = (scenarioId: string) => {
    const scenario = getWorkspaceScenario(scenarioId);
    if (!scenario) return;
    const settings = loadSettings();
    saveSettings({
      ...settings,
      personalization: {
        ...settings.personalization,
        activeIndustry: scenario.industryId,
        useCustomWorkspace: true,
        activeScenarioId: scenario.id,
        customDesktopApps: uniqueAppIds([...scenario.desktopApps, ...REQUIRED_DESKTOP_APPS]),
        customDockApps: uniqueAppIds([...scenario.dockApps, ...REQUIRED_DOCK_APPS]),
      },
    });
    scenario.dockApps.slice(0, 4).forEach((appId, index) => {
      window.setTimeout(() => requestOpenApp(appId), index * 90);
    });
    showToast(copy.workspaceResult, "ok");
  };

  const startSelectedWorkflow = (triggerId?: string) => {
    if (!selectedRoleScenario) return;
    const trigger = selectedRoleScenario.triggers.find((item) => item.id === triggerId) ?? selectedRoleScenario.triggers[0];
    startWorkflowRun(selectedRoleScenario, trigger?.type ?? "manual");
    showToast(copy.startWorkflow, "ok");
  };

  const launchSolutionStarter = (starter: IndustrySolutionStarter) => {
    setIndustryId(starter.industryId);
    setSelectedBundleId(starter.bundleId);
    if (starter.roleId) {
      setSelectedRoleId(starter.roleId);
    }
    applyWorkspace(starter.bundleId);
    const scenario = getWorkspaceScenario(starter.scenarioId);
    if (scenario) {
      startWorkflowRun(scenario, starter.triggerType);
    }
    runIndustrySolutionStarterActions(starter.actions);
    showToast(copy.starterLaunched, "ok");
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
      <div className="relative bg-slate-50">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-base font-bold text-gray-900">{copy.title}</h1>
              <p className="mt-1 text-sm text-gray-500">{copy.subtitle}</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Layers className="h-4 w-4" />}
              onClick={() => requestOpenApp("solutions_hub")}
            >
              {copy.openSolutions}
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[260px_minmax(0,1fr)] xl:overflow-hidden">
          <aside className="min-h-0 space-y-2 xl:overflow-y-auto">
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
                    <Badge
                      variant={selected ? "default" : "default"}
                      size="sm"
                    >
                      {bundleCount} {copy.templates}
                    </Badge>
                  </div>
                  <div className={["mt-1 text-xs", selected ? "text-white/75" : "text-gray-500"].join(" ")}>
                    {industry.desc}
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="min-h-0 space-y-4 xl:overflow-y-auto">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {bundles.map((bundle) => {
                const active = bundle.id === selectedBundleId;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setSelectedBundleId(bundle.id)}
                    className={[
                      "rounded-2xl border p-4 text-left transition-colors",
                      active
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-900">{bundle.title}</div>
                      <Badge variant="info" size="sm">
                        {bundle.featuredApps.length}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{bundle.summary}</div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {bundle.featuredApps.slice(0, 6).map((appId) => (
                        <Badge key={appId} variant="default" size="sm">
                          {getAppDisplayName(appId, appId, interfaceLanguage)}
                        </Badge>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedBundle && (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">{selectedBundle.title}</h2>
                      <p className="mt-1 text-sm text-gray-500">{selectedBundle.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        size="md"
                        icon={<CheckCircle2 className="h-4 w-4" />}
                        onClick={() => applyWorkspace(selectedBundle.id)}
                      >
                        {copy.applyWorkspace}
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => openCoreApps(selectedBundle.featuredApps)}
                      >
                        {copy.openCore}
                      </Button>
                      <Button
                        variant="success"
                        size="md"
                        icon={<Rocket className="h-4 w-4" />}
                        onClick={launchIndustryDesk}
                      >
                        {copy.launchDesk}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {copy.sourceCases}
                      </div>
                      <div className="space-y-1">
                        {selectedBundle.sourceUseCases.map((useCase, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                            <div className="text-xs text-gray-700">{useCase}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {copy.packagedApps}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedBundle.featuredApps.map((appId) => (
                          <Badge key={appId} variant="info" size="md">
                            {getAppDisplayName(appId, appId, interfaceLanguage)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {selectedBundle.highlights.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {copy.highlights}
                      </div>
                      <div className="space-y-2">
                        {selectedBundle.highlights.map((highlight, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-900"
                          >
                            {highlight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBundle.appSpotlights.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {copy.appRoles}
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {selectedBundle.appSpotlights.map((spotlight, index) => (
                          <div
                            key={index}
                            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="default" size="sm">
                                {getAppDisplayName(spotlight.appId, spotlight.appId, interfaceLanguage)}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-gray-600">{spotlight.role}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBundle.quickActions && selectedBundle.quickActions.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                        {copy.quickFlows}
                      </div>
                      <div className="space-y-2">
                        {selectedBundle.quickActions.map((flow, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="text-sm font-medium text-gray-900">{flow.title}</div>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<PlayCircle className="h-4 w-4" />}
                              onClick={() => runActions(flow.actions)}
                            >
                              {copy.runFlow}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{copy.workspaceBuilder}</h3>
                      <p className="mt-1 text-xs text-gray-500">{copy.workspaceBuilderDesc}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={resetBuilder}>
                        {copy.resetTemplate}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => applyWorkspace(selectedBundle.id, selectedDesktopApps, selectedDockApps)}
                      >
                        {copy.applyCustomWorkspace}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {builderGroups.map((group) => (
                      <div key={group.category}>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {group.label}
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                          {group.apps.map((appId) => {
                            const onDesktop = selectedDesktopApps.includes(appId);
                            const onDock = selectedDockApps.includes(appId);
                            const required = REQUIRED_DESKTOP_APPS.includes(appId);
                            return (
                              <div
                                key={appId}
                                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                              >
                                <div className="mb-2 text-xs font-medium text-gray-900">
                                  {getAppDisplayName(appId, appId, interfaceLanguage)}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleDesktopApp(appId)}
                                    disabled={required}
                                    className={[
                                      "flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                                      onDesktop
                                        ? "border-blue-500 bg-blue-100 text-blue-700"
                                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100",
                                      required ? "cursor-not-allowed opacity-50" : "",
                                    ].join(" ")}
                                  >
                                    {copy.addToDesktop}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleDockApp(appId)}
                                    disabled={REQUIRED_DOCK_APPS.includes(appId)}
                                    className={[
                                      "flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                                      onDock
                                        ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100",
                                      REQUIRED_DOCK_APPS.includes(appId) ? "cursor-not-allowed opacity-50" : "",
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
                </div>
              </>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">{copy.roleDesks}</h3>
                <p className="mt-1 text-xs text-gray-500">{copy.roleDesksDesc}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {workspaceRoleDesks.map((role) => {
                  const active = role.id === selectedRoleId;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className={[
                        "rounded-xl border p-4 text-left transition-colors",
                        active
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-900">{role.title}</div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyRoleDesk(role.scenarioId);
                          }}
                        >
                          {copy.applyRoleDesk}
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-gray-600">{role.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedRoleScenario && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-gray-900">{copy.workflowMap}</h3>
                  <p className="mt-1 text-xs text-gray-500">{copy.workflowMapDesc}</p>
                </div>

                <div className="space-y-3">
                  {selectedRoleScenario.workflowStages.map((stage, index) => {
                    const modeMeta = getWorkflowModeMeta(stage.mode, copy);
                    const Icon = modeMeta.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className={["rounded-full border p-2", modeMeta.className].join(" ")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">{stage.title}</div>
                            <Badge variant="default" size="sm">
                              {modeMeta.label}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-gray-600">{stage.desc}</div>
                          {stage.appIds && stage.appIds.length > 0 && (
                            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                              Apps: {stage.appIds.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    {copy.triggers}
                  </div>
                  <p className="mb-3 text-xs text-gray-600">{copy.triggerDesc}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {selectedRoleScenario.triggers.map((trigger) => (
                      <button
                        key={trigger.id}
                        type="button"
                        onClick={() => startSelectedWorkflow(trigger.id)}
                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50"
                      >
                        <div className="text-sm font-medium text-gray-900">{trigger.title}</div>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<PlayCircle className="h-4 w-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            startSelectedWorkflow(trigger.id);
                          }}
                        >
                          {copy.startWorkflow}
                        </Button>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedWorkflowRun && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
                          {copy.runtimeState}
                        </div>
                        <div className="mt-1 text-sm text-amber-900">
                          {selectedRoleScenario.title} · {selectedWorkflowRun.currentStageId}
                        </div>
                      </div>
                      <Badge
                        variant="warning"
                        size="md"
                      >
                        {getRunStateMeta(selectedWorkflowRun.state, copy).label}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">{copy.solutionStarters}</h3>
                <p className="mt-1 text-xs text-gray-500">{copy.solutionStartersDesc}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {starterCards.map((starter) => {
                  const classes = getStarterAccentClasses(starter.accent);
                  return (
                    <div
                      key={starter.id}
                      className={["rounded-2xl border p-5", classes.card].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{starter.title}</div>
                          <div className="mt-1 text-xs text-gray-600">{starter.summary}</div>
                        </div>
                        <Badge variant="default" size="sm">
                          {industries.find((i) => i.id === starter.industryId)?.title.slice(0, 8)}
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div>
                          <div className="text-xs font-semibold text-gray-500">{copy.starterTrigger}</div>
                          <div className="mt-1 text-xs text-gray-700">{starter.triggerLabel}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500">{copy.starterOutcome}</div>
                          <div className="mt-1 text-xs text-gray-700">{starter.outcomeLabel}</div>
                        </div>
                        {starter.assets.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500">{copy.starterAssets}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {starter.assets.map((asset, index) => (
                                <div
                                  key={index}
                                  className={["rounded-full border px-2 py-1 text-xs", classes.pill].join(" ")}
                                >
                                  {asset}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        icon={<Rocket className="h-4 w-4" />}
                        onClick={() => launchSolutionStarter(starter)}
                        className="mt-4"
                      >
                        {copy.launchStarter}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
