"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Globe2,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Wifi,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

import type { AppId, AppState, AppWindowState, ModeId } from "@/apps/types";
import { getMode, modes } from "@/apps/modes";
import { getApp, listApps } from "@/apps/registry";
import { StatusClock } from "@/components/StatusClock";
import { SystemTrayWindows } from "@/components/SystemTrayWindows";
import { PublishQueueRunner } from "@/components/PublishQueueRunner";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  getAppDisplayName,
  getAppCategory,
  getCategoryMeta,
  getDisplayLanguage,
  getModeDisplayName,
  getShellLabel,
  resolveLanguageLocale,
} from "@/lib/app-display";
import { getLanguageLabel } from "@/lib/language";
import {
  buildCommandCenterAssets,
  buildCommandCenterAttentionCards,
  buildCommandCenterShortcuts,
  buildChatPromptSuggestions,
  type CommandCenterTone,
} from "@/lib/home-command-center";
import {
  addRuntimeEventListener,
  normalizeRuntimeAppId,
  RuntimeEventNames,
} from "@/lib/runtime-events";
import {
  defaultSettings,
  getActiveLlmConfig,
  loadSettings,
  saveSettings,
  type InterfaceLanguage,
  type LlmProviderId,
  type PersonalizationSettings,
} from "@/lib/settings";
import { Spotlight } from "@/components/Spotlight";
import { SolutionCenterPanel } from "@/components/SolutionCenterPanel";
import { AgentSidebar } from "@/components/AgentSidebar";
import { WorkspaceAppWidgetGrid } from "@/components/WorkspaceAppWidgetGrid";
import {
  LanguageCapsule,
  LanguageWelcomeCard,
  RuntimeOnboardingCard,
  ModelCapsule,
  ModeSwitcher,
  AgentCoreBrand,
} from "@/components/ShellUI";
import { useDesktopWindows } from "@/hooks/useDesktopWindows";
import { useDesktopScroll } from "@/hooks/useDesktopScroll";
import { useSidecarHeartbeat } from "@/hooks/useSidecarHeartbeat";
import { useDesktopStore } from "@/stores/desktop-store";
import { useWindowStore } from "@/stores/window-store";
import { getDesktopRuntimeStatusSummary } from "@/lib/desktop-runtime";
import {
  getIndustryBundle,
  mapIndustryToWorkspaceIndustry,
  type IndustryId,
} from "@/lib/industry-solutions";
import {
  industrySolutionStarters,
  runIndustrySolutionStarterActions,
  type IndustrySolutionStarter,
} from "@/lib/solution-starters";
import {
  getWorkspaceScenario,
  workspaceIndustries,
  workspaceRoleDesks,
  type WorkspaceIndustryId,
  type WorkspaceRoleDesk,
} from "@/lib/workspace-presets";
import {
  dispatchOpenAppPrefill,
  requestOpenApp,
  requestOpenSettings,
} from "@/lib/ui-events";
import {
  getWorkflowRuns,
  startWorkflowRun,
  subscribeWorkflowRuns,
  type WorkflowRunRecord,
} from "@/lib/workflow-runs";
import { createTask, updateTask } from "@/lib/tasks";
import { uniqueAppIds, providerLabel, getAppShortName, workspaceCategoryOrder } from "@/lib/desktop-helpers";

export default function Home() {
  useSidecarHeartbeat();

  const {
    volumeLevel,
    modeId,
    personalization,
    showLanguageWelcome,
    showRuntimeOnboarding,
    spotlightOpen,
    activeProvider,
    agentSidebarWidth,
    agentSidebarCollapsed,
    setModeId,
    setSpotlightOpen,
    cycleVolume,
    setPersonalization,
    setActiveProvider,
    applyLanguage,
    dismissLanguageWelcome,
    dismissRuntimeOnboarding,
    setAgentSidebarWidth,
    setAgentSidebarCollapsed,
    hydrate,
  } = useDesktopStore();

  const {
    activeWindow,
    appStateById,
    appZOrder,
    openApp,
    restoreApp,
    minimizeApp,
    closeApp,
    focusApp,
    isAnyAppVisible,
  } = useDesktopWindows({
    spotlightOpen,
    onToggleSpotlight: () => setSpotlightOpen(!spotlightOpen),
  });

  useEffect(() => {
    void hydrate();
    const apply = () => {
      const settings = loadSettings();
      setPersonalization(settings.personalization);
      setActiveProvider(settings.llm.activeProvider);
    };
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, apply);
    window.addEventListener("storage", apply);
    const onOpenApp = (e: Event) => {
      const detail = (e as CustomEvent<{ appId?: AppId }>).detail;
      const appId = detail?.appId ? normalizeRuntimeAppId(detail.appId) : undefined;
      if (!appId) return;
      openApp(appId);
      dispatchOpenAppPrefill(appId, detail);
    };
    const removeOpenAppListener = addRuntimeEventListener(RuntimeEventNames.openApp, onOpenApp);
    return () => {
      removeSettingsListener();
      window.removeEventListener("storage", apply);
      removeOpenAppListener();
    };
  }, [openApp, hydrate, setPersonalization, setActiveProvider]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedWidth = Number(window.localStorage.getItem("agentcore.desktop.agent-sidebar.width.v1") || "");
      if (Number.isFinite(savedWidth) && savedWidth >= 260 && savedWidth <= 420) {
        setAgentSidebarWidth(savedWidth);
      }
    } catch {}
  }, [setAgentSidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("agentcore.desktop.agent-sidebar.width.v1", String(agentSidebarWidth));
      window.localStorage.setItem("agentcore.desktop.agent-sidebar.collapsed.v1", agentSidebarCollapsed ? "1" : "0");
    } catch {}
  }, [agentSidebarWidth, agentSidebarCollapsed]);

  const getVolumeIcon = () => {
    if (volumeLevel === 0) return <VolumeX className="w-4 h-4" />;
    if (volumeLevel === 1) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  const mode = useMemo(() => getMode(modeId), [modeId]);
  const workspaceScenario = useMemo(
    () => getWorkspaceScenario(personalization.activeScenarioId),
    [personalization.activeScenarioId],
  );
  const interfaceLanguage = personalization.interfaceLanguage;
  const runtimeSummary = getDesktopRuntimeStatusSummary(loadSettings());
  const desktopScrollRef = useRef<HTMLDivElement | null>(null);
  const [desktopCanScrollUp, setDesktopCanScrollUp] = useState(false);
  const [desktopCanScrollDown, setDesktopCanScrollDown] = useState(false);
  const desktopApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.desktopApps;
    return personalization.customDesktopApps;
  }, [mode.desktopApps, personalization.customDesktopApps, personalization.useCustomWorkspace]);
  const dockApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.dockApps;
    return personalization.customDockApps;
  }, [mode.dockApps, personalization.customDockApps, personalization.useCustomWorkspace]);
  const desktopRightInset = 0;

  const featuredSolutionStarters = useMemo(
    () =>
      [
        "sales-inbound-quote",
        "creator-campaign-sprint",
        "support-escalation-recovery",
        "research-market-scan",
      ]
        .map((id) => industrySolutionStarters.find((starter) => starter.id === id) ?? null)
        .filter((starter): starter is IndustrySolutionStarter => Boolean(starter)),
    [],
  );

  const applyScenarioWorkspace = (scenarioId: string, industryId: IndustryId) => {
    const scenario = getWorkspaceScenario(scenarioId);
    if (!scenario) return;
    const settings = loadSettings();
    const nextPersonalization: PersonalizationSettings = {
      ...settings.personalization,
      activeIndustry: mapIndustryToWorkspaceIndustry(industryId),
      activeScenarioId: scenario.id,
      useCustomWorkspace: true,
      customDesktopApps: uniqueAppIds(scenario.desktopApps),
      customDockApps: uniqueAppIds(scenario.dockApps),
    };
    saveSettings({
      ...settings,
      personalization: nextPersonalization,
    });
    setPersonalization(nextPersonalization);
  };

  const launchFeaturedStarter = (starter: IndustrySolutionStarter) => {
    applyScenarioWorkspace(starter.scenarioId, starter.industryId);
    const scenario = getWorkspaceScenario(starter.scenarioId);
    if (scenario) {
      startWorkflowRun(scenario, starter.triggerType);
    }
    runIndustrySolutionStarterActions(starter.actions);
  };

  const enterRoleDesk = (roleDesk: WorkspaceRoleDesk, industryId: IndustryId) => {
    applyScenarioWorkspace(roleDesk.scenarioId, industryId);
    const scenario = getWorkspaceScenario(roleDesk.scenarioId);
    scenario?.dockApps.slice(0, 4).forEach((appId, index) => {
      window.setTimeout(() => openApp(appId), index * 90);
    });
  };

  const updateDesktopScrollState = () => {
    const el = desktopScrollRef.current;
    if (!el) {
      setDesktopCanScrollUp(false);
      setDesktopCanScrollDown(false);
      return;
    }
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    setDesktopCanScrollUp(el.scrollTop > 12);
    setDesktopCanScrollDown(maxScrollTop - el.scrollTop > 12);
  };

  const scrollDesktopByPage = (direction: -1 | 1) => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const distance = Math.max(240, Math.floor(el.clientHeight * 0.72)) * direction;
    el.scrollBy({ top: distance, behavior: "smooth" });
  };

  useEffect(() => {
    const el = desktopScrollRef.current;
    if (!el) return;
    const onScroll = () => updateDesktopScrollState();
    const onResize = () => updateDesktopScrollState();

    updateDesktopScrollState();
    const rafId = window.requestAnimationFrame(updateDesktopScrollState);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [desktopApps]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <PublishQueueRunner />
      <main className="sr-only">
        <h1>面向企业的智能体定制服务</h1>
        <p>
          AgentCore OS 专注智能体企业定制、企业智能体定制、企业定制智能体、
          企业定制 Agent、AI 智能体企业定制、企业 AI Agent 定制、企业智能体解决方案
          和企业智能体私有化部署，帮助企业把客服、销售、知识库、运营、招聘等业务场景
          建成可执行、可复用、可审计的专属智能体工作流。
        </p>
        <h2>企业智能体定制开发方向</h2>
        <ul>
          <li>智能体企业定制开发与企业 AI 智能体定制开发</li>
          <li>企业专属智能体定制、企业内部智能体定制和企业本地部署智能体</li>
          <li>企业客服智能体定制、企业销售智能体定制和企业知识库智能体定制</li>
          <li>企业运营智能体定制、企业招聘智能体定制和行业智能体企业定制</li>
          <li>企业 AI 工作流自动化、企业流程自动化智能体和多智能体工作流平台</li>
        </ul>
        <h2>适合咨询的长尾成交需求</h2>
        <p>
          如果正在评估智能体企业定制多少钱、企业智能体定制费用、企业智能体怎么定制、
          企业 AI Agent 定制流程或企业智能体定制方案，可以从业务流程、数据权限、
          知识库接入、工具调用、部署方式和验收指标六个维度规划项目范围。
        </p>
      </main>
      <div className="absolute inset-0 bg-[#eef1f5]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.92))]" />
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:96px_96px]" />

      {/* 状态栏 */}
      <div
        className="absolute left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-3.5"
        style={{ right: desktopRightInset }}
      >
        <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-slate-900 shadow-sm backdrop-blur-xl sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2 text-slate-900">
              <AgentCoreBrand />
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
                onClick={() => setSpotlightOpen(true)}
                title={`${getShellLabel("search", interfaceLanguage)} (⌘K / Ctrl+K)`}
                aria-label={getShellLabel("search", interfaceLanguage)}
              >
                <Search className="w-4 h-4" />
              </button>
              <StatusClock locale={resolveLanguageLocale(interfaceLanguage)} />
            </div>
            <div className="order-3 flex w-full items-center justify-between gap-2 sm:order-2 sm:w-auto sm:justify-end">
              <LanguageCapsule
                value={interfaceLanguage}
                customLanguageLabel={personalization.customLanguageLabel}
                onChange={applyLanguage}
              />
              <ModelCapsule
                value="kimi"
                language={interfaceLanguage}
                onChange={() => {
                  const settings = loadSettings();
                  saveSettings({
                    ...settings,
                    llm: { ...settings.llm, activeProvider: "kimi" },
                  });
                }}
              />
              <div className="flex items-center gap-2 text-slate-600">
                <Wifi className="hidden h-3.5 w-3.5 sm:block" />
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-100 hover:text-slate-950"
                  onClick={() => cycleVolume()}
                  title="音量"
                  aria-label="音量"
                >
                  {getVolumeIcon()}
                </button>
                <div className="relative hidden h-3.5 w-6 overflow-hidden rounded-md border border-slate-300 sm:block">
                  <div className="absolute inset-y-0 left-0 w-4 bg-slate-700" />
                </div>
              </div>
            </div>

            <div className="order-2 flex flex-1 items-center justify-end gap-1.5 text-slate-700 sm:order-3 sm:flex-none">
              <ModeSwitcher
                value={modeId}
                language={interfaceLanguage}
                onChange={setModeId}
              />
              <SystemTrayWindows
                language={interfaceLanguage}
                appStateById={appStateById}
                appZOrder={appZOrder}
                activeWindow={activeWindow}
                onRestore={restoreApp}
                onMinimize={minimizeApp}
                onClose={closeApp}
                onFocus={focusApp}
              />
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => requestOpenSettings("personalization")}
              >
                {getShellLabel("workspace", interfaceLanguage)}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => openApp("settings")}
              >
                {getShellLabel("settings", interfaceLanguage)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主屏工作区 */}
      <div
        className="absolute inset-0 z-10 px-3 pb-3 pt-20 sm:px-5 sm:pb-5 sm:pt-20"
        style={{ right: desktopRightInset }}
      >
        <div
          ref={desktopScrollRef}
          className="h-full overflow-hidden"
        >
          <div className="mx-auto h-full max-w-[1280px]">
            <SolutionCenterPanel
              language={interfaceLanguage}
              activeProvider={activeProvider}
              runtimeReady={runtimeSummary.initializationComplete}
              runtimeLabel={runtimeSummary.profileMeta.title}
              starters={featuredSolutionStarters}
              onLaunchStarter={launchFeaturedStarter}
              onEnterRoleDesk={enterRoleDesk}
              onOpenApp={openApp}
              onOpenIndustryHub={() => openApp("industry_hub")}
              onOpenSolutionsHub={() => openApp("solutions_hub")}
            />

            <div className="hidden">
              <WorkspaceAppWidgetGrid
                appIds={desktopApps}
                dockApps={dockApps}
                language={interfaceLanguage}
                appStateById={appStateById}
                onOpenApp={openApp}
              />
            </div>
          </div>
        </div>
      </div>

      {desktopCanScrollUp || desktopCanScrollDown ? (
        <div
          className="pointer-events-none absolute bottom-8 right-5 z-20 flex flex-col gap-1.5"
        >
          <button
            type="button"
            onClick={() => scrollDesktopByPage(-1)}
            disabled={!desktopCanScrollUp}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-white/15 bg-black/25 text-white/90 shadow-xl backdrop-blur-2xl transition-colors hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="向上翻页"
            title="向上翻页"
          >
            <ChevronUp className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollDesktopByPage(1)}
            disabled={!desktopCanScrollDown}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-[18px] border border-white/15 bg-black/25 text-white/90 shadow-xl backdrop-blur-2xl transition-colors hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="向下翻页"
            title="向下翻页"
          >
            <ChevronDown className="h-4.5 w-4.5" />
          </button>
        </div>
      ) : null}

      {/* 应用打开时的遮罩（点空白可关闭） */}
      {isAnyAppVisible && (
        <div
          className="absolute inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
          onClick={() => {
            const top =
              activeWindow ??
              [...appZOrder]
                .reverse()
                .find((appId) => {
                  const s = appStateById[appId];
                  return s === "open" || s === "opening";
                }) ??
              null;

            if (top) closeApp(top);
          }}
          aria-hidden="true"
        />
      )}

      {appZOrder.map((appId, index) => {
        const state = appStateById[appId];
        if (state === "closed") return null;
        const app = getApp(appId);
        const Window = app.window;
        return (
          <Window
            key={appId}
            state={state as AppWindowState}
            zIndex={50 + index + (activeWindow === appId ? 100 : 0)}
            active={activeWindow === appId}
            onFocus={() => focusApp(appId)}
            onMinimize={() => minimizeApp(appId)}
            onClose={() => closeApp(appId)}
          />
        );
      })}

      <Spotlight
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        apps={listApps().map((a) => ({
          id: a.id,
          name: getAppDisplayName(a.id, a.name, interfaceLanguage),
        }))}
        onOpenApp={(appId) => openApp(appId as AppId)}
      />

      <div className="hidden">
        <AgentSidebar
          collapsed={agentSidebarCollapsed}
          width={agentSidebarWidth}
          language={interfaceLanguage}
          activeProvider={activeProvider}
          scenarioTitle={workspaceScenario?.title}
          contextSummary={[
            `当前工作台：${workspaceScenario?.title || "未固定"}`,
            `当前行业：${personalization.activeIndustry}`,
            `桌面应用数：${desktopApps.length}`,
            `Dock 应用数：${dockApps.length}`,
            `当前模型提供商：${providerLabel(activeProvider)}`,
          ].join("\n")}
          onToggleCollapsed={() => setAgentSidebarCollapsed(!agentSidebarCollapsed)}
          onResize={(nextWidth) =>
            setAgentSidebarWidth(nextWidth)
          }
        />
      </div>

      {showLanguageWelcome ? (
        <LanguageWelcomeCard
          customLanguageLabel={personalization.customLanguageLabel}
          onSelect={applyLanguage}
          onOpenSettings={() => {
            dismissLanguageWelcome();
            requestOpenSettings("personalization");
          }}
        />
      ) : null}

      {!showLanguageWelcome && showRuntimeOnboarding ? (
        <RuntimeOnboardingCard
          onChooseLightRuntime={() => {
            const settings = loadSettings();
            saveSettings({
              ...settings,
              runtime: {
                ...settings.runtime,
                profile: "desktop_light",
                orchestration: "none",
                autoBootLocalStack: false,
              },
            });
            dismissRuntimeOnboarding();
          }}
          onOpenEngineSettings={() => {
            requestOpenSettings("engine");
            dismissRuntimeOnboarding();
          }}
        />
      ) : null}
    </div>
  );
}

