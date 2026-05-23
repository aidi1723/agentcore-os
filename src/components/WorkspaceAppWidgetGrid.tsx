"use client";

import { useMemo } from "react";

import type { AppId, AppState } from "@/apps/types";
import { getApp } from "@/apps/registry";
import {
  getAppDisplayName,
  getAppCategory,
  getCategoryMeta,
} from "@/lib/app-display";
import type { InterfaceLanguage } from "@/lib/settings";
import { getAppShortName, workspaceCategoryOrder } from "@/lib/desktop-helpers";

export function WorkspaceAppWidgetGrid({
  appIds,
  dockApps,
  language,
  appStateById,
  onOpenApp,
}: {
  appIds: AppId[];
  dockApps: AppId[];
  language: InterfaceLanguage;
  appStateById: Record<AppId, AppState>;
  onOpenApp: (appId: AppId) => void;
}) {
  const groupedApps = useMemo(() => {
    const grouped = new Map<(typeof workspaceCategoryOrder)[number], AppId[]>();
    for (const appId of appIds) {
      const category = getAppCategory(appId);
      const items = grouped.get(category) ?? [];
      items.push(appId);
      grouped.set(category, items);
    }

    return workspaceCategoryOrder
      .map((category) => {
        const items = grouped.get(category);
        if (!items?.length) return null;
        return {
          category,
          meta: getCategoryMeta(category, language),
          appIds: [...items].sort((left, right) => {
            const leftPinned = dockApps.includes(left) ? 1 : 0;
            const rightPinned = dockApps.includes(right) ? 1 : 0;
            if (leftPinned !== rightPinned) return rightPinned - leftPinned;
            return getAppDisplayName(left, left, language).localeCompare(
              getAppDisplayName(right, right, language),
              language === "zh-CN" ? "zh-CN" : language === "ja-JP" ? "ja-JP" : "en-US",
            );
          }),
        };
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
  }, [appIds, dockApps, language]);

  const dockCount = new Set(dockApps).size;

  return (
    <section className="mt-5 rounded-[30px] bg-[linear-gradient(145deg,rgba(6,10,18,0.58)_0%,rgba(15,23,42,0.5)_100%)] p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.14)] backdrop-blur-2xl sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Apps
          </div>
          <div className="mt-2 text-lg font-semibold text-white">桌面应用</div>
          <div className="mt-1 text-sm text-white/62">
            按工作类型分区展示，减少重复标签和桌面噪音。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
            {appIds.length} 个工作组件
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">
            {groupedApps.length} 个分区
          </div>
          <div className="rounded-full bg-sky-400/12 px-3 py-1.5 text-xs font-semibold text-sky-100">
            Dock {dockCount}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {groupedApps.map((group) => (
          <div
            key={group.category}
            className="rounded-[26px] border border-white/10 bg-white/[0.03] p-3.5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{group.meta.label}</div>
                <div className="mt-1 text-xs leading-5 text-white/58">
                  {group.meta.description}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/75">
                  {group.appIds.length} 个应用
                </span>
                <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/60">
                  {group.meta.helper}
                </span>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {group.appIds.map((appId) => {
                const app = getApp(appId);
                const Icon = app.icon;
                const state = appStateById[appId];
                const isPinned = dockApps.includes(appId);
                const isActive = state === "open" || state === "opening";
                const isRunning = state !== "closed" && state !== "closing";

                return (
                  <button
                    key={appId}
                    type="button"
                    onClick={() => onOpenApp(appId)}
                    className={[
                      "group flex h-full flex-col rounded-[22px] p-3 text-left transition-all",
                      isActive
                        ? "bg-white/14 shadow-[0_14px_42px_rgba(0,0,0,0.18)] ring-1 ring-white/18"
                        : "bg-black/12 hover:bg-white/10 hover:ring-1 hover:ring-white/12",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/10 text-white shadow-lg transition-transform group-hover:scale-[1.03]">
                        <Icon className="h-4.5 w-4.5 text-white/88" />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {isPinned ? (
                          <span className="rounded-full bg-sky-400/12 px-2 py-0.5 text-[10px] font-semibold text-sky-100">
                            Dock
                          </span>
                        ) : null}
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            运行中
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2.5 text-[13px] font-semibold text-white">
                      {getAppShortName(appId, language)}
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-white/55">
                      {isActive
                        ? "已展开，继续回到当前任务"
                        : isPinned
                          ? "已固定到 Dock，点击快速打开"
                          : "点击打开"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

