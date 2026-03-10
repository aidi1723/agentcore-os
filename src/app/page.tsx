"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, Wifi, Volume1, Volume2, VolumeX } from "lucide-react";

import type { AppId, AppState, AppWindowState, ModeId } from "@/apps/types";
import { getMode, modes } from "@/apps/modes";
import { getApp, listApps } from "@/apps/registry";
import { DesktopIcon } from "@/components/DesktopIcon";
import { StatusClock } from "@/components/StatusClock";
import { SystemTrayWindows } from "@/components/SystemTrayWindows";
import {
  loadSettings,
  saveSettings,
  type LlmProviderId,
  type PersonalizationSettings,
} from "@/lib/settings";
import { Spotlight } from "@/components/Spotlight";

export default function Home() {
  const [volumeLevel, setVolumeLevel] = useState(2);
  const [modeId, setModeId] = useState<ModeId>("creator");
  const [desktopBackground, setDesktopBackground] = useState<
    PersonalizationSettings["desktopBackground"]
  >("aurora");
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<LlmProviderId>("kimi");
  const [activeWindow, setActiveWindow] = useState<AppId | null>(null);

  const [appStateById, setAppStateById] = useState<Record<AppId, AppState>>({
    solo_ops: "closed",
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
      setDesktopBackground(settings.personalization.desktopBackground);
      setActiveProvider(settings.llm.activeProvider);
    };
    apply();
    window.addEventListener("openclaw:settings", apply);
    window.addEventListener("storage", apply);
    const onOpenApp = (e: Event) => {
      const detail = (e as CustomEvent<{ appId?: AppId }>).detail;
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
    };
    window.addEventListener("openclaw:open-app", onOpenApp);
    return () => {
      window.removeEventListener("openclaw:settings", apply);
      window.removeEventListener("storage", apply);
      window.removeEventListener("openclaw:open-app", onOpenApp);
    };
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
    return map[desktopBackground];
  }, [desktopBackground]);

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* iPad 风格壁纸背景（可由设置切换） */}
      <div className={["absolute inset-0", wallpaperClassName].join(" ")} />
      <div className="absolute inset-0 bg-black/10" />

      {/* 状态栏 */}
      <div className="absolute top-0 left-0 right-0 h-12 px-6 flex items-center justify-between z-20">
        <div className="flex items-baseline gap-2 text-white/95 drop-shadow">
          <button
            type="button"
            className="mr-1 inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setSpotlightOpen(true)}
            title="搜索 (⌘K / Ctrl+K)"
            aria-label="搜索"
          >
            <Search className="w-4 h-4 text-white/90" />
          </button>
          <StatusClock locale="en-US" />
        </div>
        <ModelCapsule
          value={activeProvider}
          onChange={(next) => {
            const settings = loadSettings();
            saveSettings({
              ...settings,
              llm: { ...settings.llm, activeProvider: next },
            });
          }}
        />
        <div className="flex items-center gap-2 text-white/90">
          <div className="flex items-center gap-3">
            <ModeSwitcher value={modeId} onChange={setModeId} />
            <SystemTrayWindows
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
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors text-xs font-semibold text-white/90 border border-white/15"
              onClick={() => openApp("settings")}
            >
              设置
            </button>
          </div>
          <Wifi className="w-4 h-4" />
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setVolumeLevel((prev) => (prev + 1) % 3)}
            title="音量"
            aria-label="音量"
          >
            {getVolumeIcon()}
          </button>
          <div className="h-4 w-7 rounded-md border border-white/40 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-4 bg-white/80" />
          </div>
        </div>
      </div>

      {/* 主屏图标网格 */}
      <div className="absolute inset-0 pt-16 pb-28 px-8 z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-4 sm:grid-cols-6 gap-x-6 gap-y-7 place-items-center">
          {mode.desktopApps.map((appId) => {
            const app = getApp(appId);
            const Icon = app.icon;
            return (
              <DesktopIcon
                key={appId}
                icon={<Icon className="w-9 h-9 text-white/90" />}
                name={app.name}
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
        <div className="bg-white/15 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl px-4 py-3 flex items-center gap-3">
          {mode.dockApps.map((appId) => {
            const app = getApp(appId);
            const Icon = app.icon;
            const state = appStateById[appId];
            const running = state !== "closed" && state !== "closing";
            const active = state === "open" || state === "opening";
            return (
              <DockIcon
                key={appId}
                title={app.name}
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
        apps={listApps().map((a) => ({ id: a.id, name: a.name }))}
        onOpenApp={(appId) => openApp(appId as AppId)}
      />
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

function ModelCapsule({
  value,
  onChange,
}: {
  value: LlmProviderId;
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
          "px-4 py-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-xl",
          "shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
          "text-xs font-semibold text-white/95 hover:bg-white/15 transition-colors",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ✨ 引擎: {providerLabel(value)} ▾
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
                      当前
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
  onChange,
}: {
  value: ModeId;
  onChange: (next: ModeId) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModeId)}
        className="appearance-none bg-white/10 hover:bg-white/15 transition-colors text-white/90 text-xs font-semibold border border-white/15 rounded-full pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/30"
        aria-label="切换桌面模式"
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id} className="text-black">
            {mode.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/80">
        <span className="text-[10px]">▼</span>
      </div>
    </div>
  );
}
