"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Globe2, Search, Wifi, Volume1, Volume2, VolumeX } from "lucide-react";

import type { AppId, AppState, AppWindowState, ModeId } from "@/apps/types";
import { getMode, modes } from "@/apps/modes";
import { getApp, listApps } from "@/apps/registry";
import { DesktopIcon } from "@/components/DesktopIcon";
import { StatusClock } from "@/components/StatusClock";
import { SystemTrayWindows } from "@/components/SystemTrayWindows";
import {
  getAppDisplayName,
  getDisplayLanguage,
  getModeDisplayName,
  getShellLabel,
  resolveLanguageLocale,
} from "@/lib/app-display";
import { getLanguageLabel } from "@/lib/language";
import {
  defaultSettings,
  hasSavedSettings,
  loadSettings,
  saveSettings,
  type InterfaceLanguage,
  type LlmProviderId,
  type PersonalizationSettings,
} from "@/lib/settings";
import { Spotlight } from "@/components/Spotlight";
import type {
  ContentRepurposerPrefill,
  CreatorRadarPrefill,
  DealDeskPrefill,
  EmailAssistantPrefill,
  KnowledgeVaultPrefill,
  MorningBriefPrefill,
  PersonalCrmPrefill,
  SettingsTargetTab,
} from "@/lib/ui-events";
import { getWorkspaceScenario } from "@/lib/workspace-presets";
import { requestOpenSettings } from "@/lib/ui-events";

export default function Home() {
  const languageWelcomeKey = "openclaw.language_welcome.v1";
  const [volumeLevel, setVolumeLevel] = useState(2);
  const [modeId, setModeId] = useState<ModeId>("creator");
  const [personalization, setPersonalization] = useState<PersonalizationSettings>(
    () => defaultSettings.personalization,
  );
  const [showLanguageWelcome, setShowLanguageWelcome] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<LlmProviderId>("kimi");
  const [activeWindow, setActiveWindow] = useState<AppId | null>(null);

  const [appStateById, setAppStateById] = useState<Record<AppId, AppState>>({
    industry_hub: "closed",
    recruiting_desk: "closed",
    project_ops: "closed",
    deep_research_hub: "closed",
    financial_document_bot: "closed",
    social_media_autopilot: "closed",
    website_seo_studio: "closed",
    language_learning_desk: "closed",
    tech_news_digest: "closed",
    morning_brief: "closed",
    meeting_copilot: "closed",
    personal_crm: "closed",
    inbox_declutter: "closed",
    support_copilot: "closed",
    second_brain: "closed",
    email_assistant: "closed",
    deal_desk: "closed",
    family_calendar: "closed",
    habit_tracker: "closed",
    health_tracker: "closed",
    creator_radar: "closed",
    content_repurposer: "closed",
    solo_ops: "closed",
    solutions_hub: "closed",
    media_ops: "closed",
    creative_studio: "closed",
    knowledge_vault: "closed",
    account_center: "closed",
    task_manager: "closed",
    openclaw_console: "closed",
    publisher: "closed",
    settings: "closed",
  });
  const [appZOrder, setAppZOrder] = useState<AppId[]>([]);

  const spotlightOpenRef = useRef(spotlightOpen);
  const appStateByIdRef = useRef(appStateById);
  const appZOrderRef = useRef(appZOrder);
  const activeWindowRef = useRef(activeWindow);

  useEffect(() => {
    spotlightOpenRef.current = spotlightOpen;
  }, [spotlightOpen]);
  useEffect(() => {
    appStateByIdRef.current = appStateById;
  }, [appStateById]);
  useEffect(() => {
    appZOrderRef.current = appZOrder;
  }, [appZOrder]);
  useEffect(() => {
    activeWindowRef.current = activeWindow;
  }, [activeWindow]);

  useEffect(() => {
    const apply = () => {
      const settings = loadSettings();
      setPersonalization(settings.personalization);
      setActiveProvider(settings.llm.activeProvider);
    };
    apply();
    window.addEventListener("openclaw:settings", apply);
    window.addEventListener("storage", apply);
    const onOpenApp = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          appId?: AppId;
          settingsTab?: SettingsTargetTab;
          dealPrefill?: DealDeskPrefill;
          emailDraft?: EmailAssistantPrefill;
          crmPrefill?: PersonalCrmPrefill;
          vaultPrefill?: KnowledgeVaultPrefill;
          repurposerPrefill?: ContentRepurposerPrefill;
          creatorRadarPrefill?: CreatorRadarPrefill;
          morningBriefPrefill?: MorningBriefPrefill;
        }>
      ).detail;
      const appId = detail?.appId;
      if (!appId) return;
      setAppStateById((prev) => {
        const cur = prev[appId];
        if (cur === "closed") return { ...prev, [appId]: "opening" };
        if (cur === "minimized") return { ...prev, [appId]: "open" };
        if (cur === "closing") return { ...prev, [appId]: "opening" };
        return { ...prev, [appId]: "open" };
      });
      setAppZOrder((prev) => [...prev.filter((id) => id !== appId), appId]);
      setActiveWindow(appId);
      if (appId === "settings" && detail?.settingsTab) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:settings-focus", {
              detail: { tab: detail.settingsTab },
            }),
          );
        }, 0);
      }
      if (appId === "deal_desk" && detail?.dealPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:deal-desk-prefill", {
              detail: detail.dealPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "email_assistant" && detail?.emailDraft) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:email-assistant-prefill", {
              detail: detail.emailDraft,
            }),
          );
        }, 80);
      }
      if (appId === "personal_crm" && detail?.crmPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:crm-prefill", {
              detail: detail.crmPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "knowledge_vault" && detail?.vaultPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:vault-prefill", {
              detail: detail.vaultPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "content_repurposer" && detail?.repurposerPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:content-repurposer-prefill", {
              detail: detail.repurposerPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "creator_radar" && detail?.creatorRadarPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:creator-radar-prefill", {
              detail: detail.creatorRadarPrefill,
            }),
          );
        }, 80);
      }
      if (appId === "morning_brief" && detail?.morningBriefPrefill) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("openclaw:morning-brief-prefill", {
              detail: detail.morningBriefPrefill,
            }),
          );
        }, 80);
      }
    };
    window.addEventListener("openclaw:open-app", onOpenApp);
    return () => {
      window.removeEventListener("openclaw:settings", apply);
      window.removeEventListener("storage", apply);
      window.removeEventListener("openclaw:open-app", onOpenApp);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const hasSeenWelcome = window.localStorage.getItem(languageWelcomeKey) === "1";
      if (!hasSeenWelcome && !hasSavedSettings()) {
        setShowLanguageWelcome(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return false;
    };

    const getVisibleWindows = () => {
      const states = appStateByIdRef.current;
      return appZOrderRef.current.filter((appId) => {
        const s = states[appId];
        return s === "open" || s === "opening";
      });
    };

    const getTopWindow = () => {
      const states = appStateByIdRef.current;
      const active = activeWindowRef.current;
      if (active && (states[active] === "open" || states[active] === "opening")) {
        return active;
      }
      return (
        [...appZOrderRef.current]
          .reverse()
          .find((appId) => {
            const s = states[appId];
            return s === "open" || s === "opening";
          }) ?? null
      );
    };

    const onGlobalKeys = (e: KeyboardEvent) => {
      // Spotlight toggle always available.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
        return;
      }

      if (spotlightOpenRef.current) return;

      // Window tiling (desktop UX).
      if ((e.metaKey || e.ctrlKey) && e.altKey) {
        if (isTypingTarget(e.target)) return;
        const top = getTopWindow();
        if (!top) return;
        const storageKey = `openclaw.window.${top}`;

        const key = e.key;
        if (key === "ArrowLeft") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "tile_left" },
            }),
          );
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "tile_right" },
            }),
          );
          return;
        }
        if (key === "ArrowUp") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "maximize" },
            }),
          );
          return;
        }
        if (key === "ArrowDown") {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent("openclaw:window-command", {
              detail: { storageKey, command: "restore" },
            }),
          );
          return;
        }
      }

      if (e.key === "Escape") {
        const top = getTopWindow();
        if (!top) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setAppStateById((prev) => ({ ...prev, [top]: "closing" }));
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "w") {
        const top = getTopWindow();
        if (!top) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setAppStateById((prev) => ({ ...prev, [top]: "closing" }));
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        if (e.shiftKey) {
          // Restore all minimized windows.
          setAppStateById((prev) => {
            const next = { ...prev };
            for (const id of Object.keys(next) as AppId[]) {
              if (next[id] === "minimized") next[id] = "open";
            }
            return next;
          });
        } else {
          const top = getTopWindow();
          if (!top) return;
          setAppStateById((prev) => ({ ...prev, [top]: "minimized" }));
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "[" || e.key === "]")) {
        if (isTypingTarget(e.target)) return;
        const visible = getVisibleWindows();
        if (visible.length <= 1) return;
        e.preventDefault();

        const cur = getTopWindow();
        const idx = cur ? visible.indexOf(cur) : visible.length - 1;
        const dir = e.key === "]" ? 1 : -1;
        const next = visible[(idx + dir + visible.length) % visible.length];
        setAppZOrder((prev) => [...prev.filter((id) => id !== next), next]);
        setActiveWindow(next);
      }
    };

    window.addEventListener("keydown", onGlobalKeys);
    return () => window.removeEventListener("keydown", onGlobalKeys);
  }, []);

  const getVolumeIcon = () => {
    if (volumeLevel === 0) return <VolumeX className="w-4 h-4" />;
    if (volumeLevel === 1) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  const openApp = (appId: AppId) => {
    setAppStateById((prev) => {
      const cur = prev[appId];
      if (cur === "closed") return { ...prev, [appId]: "opening" };
      if (cur === "minimized") return { ...prev, [appId]: "open" };
      if (cur === "closing") return { ...prev, [appId]: "opening" };
      return { ...prev, [appId]: "open" };
    });
    focusApp(appId);
  };

  const restoreApp = (appId: AppId) => openApp(appId);

  const minimizeApp = (appId: AppId) =>
    setAppStateById((prev) => ({ ...prev, [appId]: "minimized" }));
  const closeApp = (appId: AppId) =>
    setAppStateById((prev) => ({ ...prev, [appId]: "closing" }));

  const focusApp = (appId: AppId) => {
    setAppZOrder((prev) => [...prev.filter((id) => id !== appId), appId]);
    setActiveWindow(appId);
  };

  const toggleAppFromDock = (appId: AppId) => {
    const cur = appStateById[appId];
    const next: AppState =
      cur === "closed"
        ? "opening"
        : cur === "minimized"
          ? "open"
          : cur === "open"
            ? "minimized"
            : cur === "closing"
              ? "opening"
              : "open";

    setAppStateById((prev) => ({ ...prev, [appId]: next }));
    if (next === "open" || next === "opening") focusApp(appId);
  };

  useEffect(() => {
    const ids = Object.keys(appStateById) as AppId[];
    const timers: number[] = [];
    const rafIds: number[] = [];

    for (const appId of ids) {
      const state = appStateById[appId];
      if (state === "opening") {
        const rafId = window.requestAnimationFrame(() => {
          setAppStateById((prev) =>
            prev[appId] === "opening" ? { ...prev, [appId]: "open" } : prev,
          );
        });
        const timeoutId = window.setTimeout(() => {
          setAppStateById((prev) =>
            prev[appId] === "opening" ? { ...prev, [appId]: "open" } : prev,
          );
        }, 120);
        rafIds.push(rafId);
        timers.push(timeoutId);
      } else if (state === "closing") {
        const timeoutId = window.setTimeout(() => {
          setAppStateById((prev) =>
            prev[appId] === "closing" ? { ...prev, [appId]: "closed" } : prev,
          );
          setAppZOrder((prev) => prev.filter((id) => id !== appId));
        }, 200);
        timers.push(timeoutId);
      }
    }

    return () => {
      for (const id of rafIds) window.cancelAnimationFrame(id);
      for (const id of timers) window.clearTimeout(id);
    };
  }, [appStateById]);

  useEffect(() => {
    const nextActive =
      [...appZOrder]
        .reverse()
        .find((appId) => {
          const s = appStateById[appId];
          return s === "open" || s === "opening";
        }) ?? null;

    setActiveWindow((prev) => (prev === nextActive ? prev : nextActive));
  }, [appZOrder, appStateById]);

  const mode = useMemo(() => getMode(modeId), [modeId]);
  const workspaceScenario = useMemo(
    () => getWorkspaceScenario(personalization.activeScenarioId),
    [personalization.activeScenarioId],
  );
  const interfaceLanguage = personalization.interfaceLanguage;
  const desktopApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.desktopApps;
    if (personalization.customDesktopApps.length > 0) {
      return personalization.customDesktopApps;
    }
    return workspaceScenario?.desktopApps ?? mode.desktopApps;
  }, [mode.desktopApps, personalization, workspaceScenario]);
  const dockApps = useMemo(() => {
    if (!personalization.useCustomWorkspace) return mode.dockApps;
    if (personalization.customDockApps.length > 0) {
      return personalization.customDockApps;
    }
    return workspaceScenario?.dockApps ?? mode.dockApps;
  }, [mode.dockApps, personalization, workspaceScenario]);
  const isAnyAppVisible = Object.values(appStateById).some(
    (s) => s === "opening" || s === "open",
  );

  const wallpaperClassName = useMemo(() => {
    const map: Record<PersonalizationSettings["desktopBackground"], string> = {
      aurora:
        "bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(135deg,#0b1220_0%,#1a1f3b_35%,#3a1c63_70%,#0b1220_100%)]",
      ocean:
        "bg-[radial-gradient(900px_circle_at_25%_15%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(1100px_circle_at_80%_45%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#06131f_0%,#0b3a5a_35%,#0b6aa6_65%,#06131f_100%)]",
      sunset:
        "bg-[radial-gradient(1100px_circle_at_20%_10%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(900px_circle_at_85%_35%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#1a0b1a_0%,#6a1b2d_35%,#ff6a00_70%,#1a0b1a_100%)]",
    };
    return map[personalization.desktopBackground];
  }, [personalization.desktopBackground]);

  const applyLanguage = (next: InterfaceLanguage) => {
    const settings = loadSettings();
    if (next === "custom" && !settings.personalization.customLanguageLabel.trim()) {
      requestOpenSettings("personalization");
      return;
    }
    saveSettings({
      ...settings,
      personalization: {
        ...settings.personalization,
        interfaceLanguage: next,
      },
    });
    try {
      window.localStorage.setItem(languageWelcomeKey, "1");
    } catch {
      // ignore
    }
    setShowLanguageWelcome(false);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* iPad 风格壁纸背景（可由设置切换） */}
      <div className={["absolute inset-0", wallpaperClassName].join(" ")} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,rgba(8,11,18,0.18),rgba(8,11,18,0.5))]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:120px_120px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />

      {/* 状态栏 */}
      <div className="absolute left-0 right-0 top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="rounded-[28px] border border-white/15 bg-black/15 px-3 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-white/95 drop-shadow">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setSpotlightOpen(true)}
            title={`${getShellLabel("search", interfaceLanguage)} (⌘K / Ctrl+K)`}
            aria-label={getShellLabel("search", interfaceLanguage)}
          >
            <Search className="w-4 h-4 text-white/90" />
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
                value={activeProvider}
                language={interfaceLanguage}
                onChange={(next) => {
                  const settings = loadSettings();
                  saveSettings({
                    ...settings,
                    llm: { ...settings.llm, activeProvider: next },
                  });
                }}
              />
              <div className="flex items-center gap-2 text-white/90">
                <Wifi className="hidden h-4 w-4 sm:block" />
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  onClick={() => setVolumeLevel((prev) => (prev + 1) % 3)}
                  title="音量"
                  aria-label="音量"
                >
                  {getVolumeIcon()}
                </button>
                <div className="relative hidden h-4 w-7 overflow-hidden rounded-md border border-white/40 sm:block">
                  <div className="absolute inset-y-0 left-0 w-4 bg-white/80" />
                </div>
              </div>
            </div>

            <div className="order-2 flex flex-1 items-center justify-end gap-2 text-white/90 sm:order-3 sm:flex-none">
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
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
                onClick={() => requestOpenSettings("personalization")}
              >
                {getShellLabel("workspace", interfaceLanguage)}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15"
                onClick={() => openApp("settings")}
              >
                {getShellLabel("settings", interfaceLanguage)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主屏图标网格 */}
      <div className="absolute inset-0 z-10 px-4 pb-28 pt-28 sm:px-8 sm:pt-24">
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-7 lg:grid-cols-6">
          {desktopApps.map((appId) => {
            const app = getApp(appId);
            const Icon = app.icon;
            return (
              <DesktopIcon
                key={appId}
                icon={<Icon className="w-9 h-9 text-white/90" />}
                name={getAppDisplayName(appId, app.name, interfaceLanguage)}
                onClick={() => openApp(appId)}
              />
            );
          })}
        </div>
      </div>

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

      {/* Dock */}
      <div className="absolute bottom-3 left-1/2 z-30 w-[calc(100%-20px)] max-w-max -translate-x-1/2 sm:bottom-4">
        <div className="flex items-center gap-2 overflow-x-auto rounded-[28px] border border-white/20 bg-white/15 px-3 py-3 shadow-2xl backdrop-blur-2xl sm:gap-3 sm:px-4">
          {dockApps.map((appId) => {
            const app = getApp(appId);
            const Icon = app.icon;
            const state = appStateById[appId];
            const running = state !== "closed" && state !== "closing";
            const active = state === "open" || state === "opening";
            return (
              <DockIcon
                key={appId}
                title={getAppDisplayName(appId, app.name, interfaceLanguage)}
                active={active}
                running={running}
                onClick={() => toggleAppFromDock(appId)}
              >
                <Icon className="w-7 h-7 text-white/90" />
              </DockIcon>
            );
          })}
        </div>
      </div>

      <Spotlight
        open={spotlightOpen}
        onClose={() => setSpotlightOpen(false)}
        apps={listApps().map((a) => ({
          id: a.id,
          name: getAppDisplayName(a.id, a.name, interfaceLanguage),
        }))}
        onOpenApp={(appId) => openApp(appId as AppId)}
      />

      {showLanguageWelcome ? (
        <LanguageWelcomeCard
          customLanguageLabel={personalization.customLanguageLabel}
          onSelect={applyLanguage}
          onOpenSettings={() => {
            try {
              window.localStorage.setItem(languageWelcomeKey, "1");
            } catch {
              // ignore
            }
            setShowLanguageWelcome(false);
            requestOpenSettings("personalization");
          }}
        />
      ) : null}
    </div>
  );
}

function providerLabel(id: LlmProviderId) {
  const map: Record<LlmProviderId, string> = {
    kimi: "Kimi (Moonshot)",
    deepseek: "DeepSeek",
    openai: "OpenAI",
    qwen: "通义千问",
  };
  return map[id];
}

function detectWelcomeLanguage(): InterfaceLanguage {
  if (typeof navigator === "undefined") return "en-US";
  const language = navigator.language.toLowerCase();
  if (language.startsWith("zh")) return "zh-CN";
  if (language.startsWith("ja")) return "ja-JP";
  return "en-US";
}

function getWelcomeCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "ja") {
    return {
      eyebrow: "Language",
      title: "使用する言語を選択",
      desc: "最初に表示言語を選びます。あとから上部バーでいつでも変更できます。",
      badge: "Global first",
      zhDesc: "中国語ユーザー向け",
      enDesc: "For global users",
      jaDesc: "日本語ユーザー向け",
    };
  }
  if (displayLanguage === "zh") {
    return {
      eyebrow: "语言",
      title: "选择你的语言",
      desc: "先选择界面语言，之后也可以随时从顶部栏切换。",
      badge: "全球优先",
      zhDesc: "适合中文用户",
      enDesc: "适合全球用户",
      jaDesc: "适合日语用户",
    };
  }
  return {
    eyebrow: "Language",
    title: "Choose your language",
    desc: "Pick the interface language first. You can change it anytime from the top bar.",
    badge: "Global first",
    zhDesc: "For Chinese users",
    enDesc: "For global users",
    jaDesc: "For Japanese users",
  };
}

function LanguageCapsule({
  value,
  customLanguageLabel,
  onChange,
}: {
  value: InterfaceLanguage;
  customLanguageLabel: string;
  onChange: (next: InterfaceLanguage) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const items: Array<{ id: InterfaceLanguage; label: string; hint?: string }> = [
    { id: "zh-CN", label: "中文" },
    { id: "en-US", label: "English" },
    { id: "ja-JP", label: "日本語" },
    {
      id: "custom",
      label: customLanguageLabel.trim() || getShellLabel("customLanguage", value),
      hint: customLanguageLabel.trim()
        ? getShellLabel("customLanguageSet", value)
        : getShellLabel("openSettings", value),
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={[
          "max-w-[56vw] truncate rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/95 backdrop-blur-xl transition-colors hover:bg-white/15 sm:max-w-none sm:px-4",
          "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Globe2 className="h-3.5 w-3.5" />
          {getLanguageLabel(value, customLanguageLabel)} ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 mt-2 w-[220px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0f18]/70 shadow-2xl backdrop-blur-2xl"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 text-[11px] font-semibold text-white/70">
            {getShellLabel("interfaceLanguage", value)}
          </div>
          <div className="space-y-1 p-2">
            {items.map((item) => {
              const active = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {active ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80">
                      {getShellLabel("current", value)}
                    </span>
                  ) : item.hint ? (
                    <span className="text-[10px] text-white/45">{item.hint}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LanguageWelcomeCard({
  customLanguageLabel,
  onSelect,
  onOpenSettings,
}: {
  customLanguageLabel: string;
  onSelect: (next: InterfaceLanguage) => void;
  onOpenSettings: () => void;
}) {
  const welcomeLanguage = useMemo(() => detectWelcomeLanguage(), []);
  const copy = useMemo(() => getWelcomeCopy(welcomeLanguage), [welcomeLanguage]);
  const items: Array<{ id: InterfaceLanguage; title: string; desc: string }> = [
    { id: "zh-CN", title: "中文", desc: copy.zhDesc },
    { id: "en-US", title: "English", desc: copy.enDesc },
    { id: "ja-JP", title: "日本語", desc: copy.jaDesc },
  ];

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/15 bg-[#0b0f18]/75 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              {copy.eyebrow}
            </div>
            <div className="mt-2 text-2xl font-bold text-white">{copy.title}</div>
            <div className="mt-2 text-sm text-white/70">
              {copy.desc}
            </div>
          </div>
          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/65">
            {copy.badge}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="rounded-3xl border border-white/15 bg-white/5 p-5 text-left transition-colors hover:bg-white/10"
            >
              <div className="text-lg font-semibold text-white">{item.title}</div>
              <div className="mt-2 text-sm text-white/65">{item.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {customLanguageLabel.trim() || getShellLabel("customLanguage", welcomeLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelCapsule({
  value,
  language,
  onChange,
}: {
  value: LlmProviderId;
  language: InterfaceLanguage;
  onChange: (next: LlmProviderId) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const items: LlmProviderId[] = ["kimi", "deepseek", "openai", "qwen"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={[
          "max-w-[68vw] truncate px-3 py-2 sm:max-w-none sm:px-4 rounded-full border border-white/15 bg-white/10 backdrop-blur-xl",
          "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
          "text-xs font-semibold text-white/95 hover:bg-white/15 transition-colors",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ✨ {getShellLabel("engine", language)}: {providerLabel(value)} ▾
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 mt-2 w-[260px] rounded-2xl border border-white/15 bg-[#0b0f18]/70 backdrop-blur-2xl shadow-2xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 text-[11px] font-semibold text-white/70">
            一键切换全局大模型
          </div>
          <div className="p-2 space-y-1">
            {items.map((id) => {
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={[
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>{providerLabel(id)}</span>
                  {active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/80">
                      {getShellLabel("current", language)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-3 text-[11px] text-white/55">
            配置 Key/Base URL 请到「设置 → 大模型与助手」。
          </div>
        </div>
      )}
    </div>
  );
}

function DockIcon({
  title,
  active,
  running,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  running?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
        active ? "bg-white/20" : "hover:bg-white/10",
      ].join(" ")}
    >
      {children}
      {running && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-4 rounded-full bg-white/70" />
      )}
    </button>
  );
}

function ModeSwitcher({
  value,
  language,
  onChange,
}: {
  value: ModeId;
  language: InterfaceLanguage;
  onChange: (next: ModeId) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModeId)}
        className="appearance-none rounded-full border border-white/15 bg-white/10 py-1.5 pl-3 pr-8 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
        aria-label={getShellLabel("switchMode", language)}
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id} className="text-black">
            {getModeDisplayName(mode.id, mode.name, language)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/80">
        <span className="text-[10px]">▼</span>
      </div>
    </div>
  );
}
