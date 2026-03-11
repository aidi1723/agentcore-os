"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Minus, X } from "lucide-react";

import type { AppId, AppState } from "@/apps/types";
import { getApp } from "@/apps/registry";
import { getAppDisplayName, getShellLabel } from "@/lib/app-display";
import type { InterfaceLanguage } from "@/lib/settings";

function stateLabel(state: AppState, language: InterfaceLanguage) {
  switch (state) {
    case "open":
    case "opening":
      return {
        text: getShellLabel("running", language),
        className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
      };
    case "minimized":
      return {
        text: getShellLabel("minimized", language),
        className: "bg-sky-500/15 text-sky-200 border-sky-500/30",
      };
    case "closing":
      return {
        text: getShellLabel("closing", language),
        className: "bg-amber-500/15 text-amber-200 border-amber-500/30",
      };
    case "closed":
      return {
        text: getShellLabel("closed", language),
        className: "bg-gray-500/15 text-gray-200 border-gray-500/30",
      };
  }
}

export function SystemTrayWindows({
  language,
  appStateById,
  appZOrder,
  activeWindow,
  onRestore,
  onMinimize,
  onClose,
  onFocus,
}: {
  language: InterfaceLanguage;
  appStateById: Record<AppId, AppState>;
  appZOrder: AppId[];
  activeWindow: AppId | null;
  onRestore: (appId: AppId) => void;
  onMinimize: (appId: AppId) => void;
  onClose: (appId: AppId) => void;
  onFocus: (appId: AppId) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    window.addEventListener("pointerdown", onDoc);
    return () => window.removeEventListener("pointerdown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const runningIds = useMemo(() => {
    const ids = Object.keys(appStateById) as AppId[];
    return ids.filter((id) => appStateById[id] !== "closed");
  }, [appStateById]);

  const list = useMemo(() => {
    const base = new Set(runningIds);
    const ordered = [
      ...appZOrder.filter((id) => base.has(id)),
      ...runningIds.filter((id) => !appZOrder.includes(id)),
    ];
    return ordered
      .slice()
      .reverse()
      .map((id) => ({ id, state: appStateById[id] }));
  }, [appStateById, appZOrder, runningIds]);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 transition-colors text-xs font-semibold text-white/90 border border-white/15"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={getShellLabel("windowManager", language)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={getShellLabel("windowManager", language)}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="tabular-nums">{runningIds.length}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[min(360px,calc(100vw-24px))] rounded-2xl border border-white/15 bg-[#0b0f18]/70 backdrop-blur-2xl shadow-2xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold text-white/70">
              {getShellLabel("runningWindows", language)}
            </div>
            <button
              type="button"
              className="text-[11px] font-semibold text-white/60 hover:text-white/80"
              onClick={() => setOpen(false)}
            >
              {getShellLabel("close", language)}
            </button>
          </div>
          <div className="h-px bg-white/10" />

          {list.length === 0 ? (
            <div className="px-4 py-4 text-xs text-white/55">
              {getShellLabel("noWindows", language)}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {list.map(({ id, state }) => {
                const app = getApp(id);
                const Icon = app.icon;
                const badge = stateLabel(state, language);
                const isActive = activeWindow === id && (state === "open" || state === "opening");
                const canRestore = state === "minimized" || state === "closing";
                const canMinimize = state === "open" || state === "opening";
                const appTitle = getAppDisplayName(id, app.name, language);

                return (
                  <div
                    key={id}
                    className={[
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                      isActive ? "border-white/20 bg-white/10" : "border-white/10 hover:bg-white/5",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex items-center gap-3 text-left"
                      onClick={() => {
                        onFocus(id);
                        if (state === "minimized") onRestore(id);
                        setOpen(false);
                      }}
                      title={appTitle}
                    >
                      <span className="h-9 w-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-white/85" />
                      </span>
                      <span className="min-w-0">
                        <div className="text-sm font-semibold text-white/90 truncate">
                          {appTitle}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={[
                              "inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                              badge.className,
                            ].join(" ")}
                          >
                            {badge.text}
                          </span>
                          {isActive && (
                            <span className="text-[11px] text-white/60">
                              {getShellLabel("current", language)}
                            </span>
                          )}
                        </div>
                      </span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!canMinimize}
                        onClick={() => {
                          onMinimize(id);
                          setOpen(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        title={getShellLabel("minimize", language)}
                        aria-label={getShellLabel("minimize", language)}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={!canRestore}
                        onClick={() => {
                          onRestore(id);
                          setOpen(false);
                        }}
                        className="px-2.5 h-8 rounded-xl text-[11px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                        title={getShellLabel("restore", language)}
                        aria-label={getShellLabel("restore", language)}
                      >
                        {getShellLabel("restore", language)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose(id);
                          setOpen(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/20 text-red-200 hover:bg-red-500/25 transition-colors"
                        title={getShellLabel("close", language)}
                        aria-label={getShellLabel("close", language)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-4 py-3 text-[11px] text-white/55">
            {getShellLabel("shortcuts", language)}：<span className="font-mono">Esc</span> 关闭顶层 ·{" "}
            <span className="font-mono">⌘[</span>/<span className="font-mono">⌘]</span> 切换窗口 ·{" "}
            <span className="font-mono">⌘K</span> Spotlight
          </div>
        </div>
      )}
    </div>
  );
}
