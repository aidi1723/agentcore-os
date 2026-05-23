"use client";

import { memo } from "react";
import { Bot, BriefcaseBusiness } from "lucide-react";

import type { AppId } from "@/apps/types";
import { getApp } from "@/apps/registry";
import type { CommandCenterTone } from "@/lib/home-command-center";
import type { InterfaceLanguage } from "@/lib/settings";
import { commandCenterToneClass, getWorkflowModeMeta } from "@/lib/desktop-helpers";
import type { WorkflowRunRecord } from "@/lib/workflow-runs";

type CommandShortcut = {
  id: string;
  appId: AppId;
  label: string;
  detail: string;
  tone: CommandCenterTone;
};

type AttentionCard = {
  id: string;
  label: string;
  detail: string;
  value: string | number;
  tone: CommandCenterTone;
};

type WorkflowStage = {
  id: string;
  title: string;
  mode: "auto" | "assist" | "review" | "manual";
};

type StageRun = {
  id: string;
  state: string;
};

type DeskExecutionEvent = {
  id: string;
  title: string;
  detail: string;
  tone: "default" | "success" | "error";
};

export const CommandCenterSidebar = memo(function CommandCenterSidebar({
  shortcuts,
  attentionCards,
  assets,
  executionEvents,
  workflowTitle,
  workflowStages,
  selectedRun,
  copy,
  onOpenApp,
  onOpenIndustryHub,
  onOpenSolutionsHub,
}: {
  shortcuts: CommandShortcut[];
  attentionCards: AttentionCard[];
  assets: string[];
  executionEvents: DeskExecutionEvent[];
  workflowTitle: string;
  workflowStages: WorkflowStage[];
  selectedRun: { currentStageId?: string; stageRuns: StageRun[] } | null;
  copy: {
    industryHub: string;
    library: string;
    stage: string;
    deliverables: string;
    progress: string;
    openApp: string;
  };
  onOpenApp: (appId: AppId) => void;
  onOpenIndustryHub: () => void;
  onOpenSolutionsHub: () => void;
}) {
  return (
    <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto pr-0.5 lg:flex">
      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-xs font-semibold uppercase text-slate-500">Tools</div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {shortcuts.map((shortcut) => {
            const app = getApp(shortcut.appId);
            const Icon = app.icon;
            return (
              <button
                key={shortcut.id}
                type="button"
                onClick={() => onOpenApp(shortcut.appId)}
                className={[
                  "min-w-0 rounded-lg border px-2 py-2 text-left transition-colors hover:border-slate-300 hover:bg-white",
                  commandCenterToneClass(shortcut.tone),
                ].join(" ")}
                title={shortcut.detail}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-[11px] font-semibold">{shortcut.label}</span>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onOpenIndustryHub}
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-center gap-1.5">
              <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[11px] font-semibold">{copy.industryHub}</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onOpenSolutionsHub}
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[11px] font-semibold">{copy.library}</span>
            </div>
          </button>
        </div>
      </section>

      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-xs font-semibold uppercase text-slate-500">Attention</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {attentionCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenApp(card.id === "runtime" ? "runtime_console" as AppId : "task_manager" as AppId)}
              className={[
                "rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-slate-300",
                commandCenterToneClass(card.tone),
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold opacity-70">{card.label}</div>
                  <div className="mt-1 text-xs leading-5 opacity-65">{card.detail}</div>
                </div>
                <div className="text-lg font-semibold">{card.value}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-xs font-semibold uppercase text-slate-500">Workflow</div>
        <div className="mt-1 text-sm font-semibold text-slate-950">{workflowTitle}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {workflowStages.slice(0, 4).map((stage, index) => {
            const stageMeta = getWorkflowModeMeta(stage.mode);
            const isActive = selectedRun?.currentStageId === stage.id;
            const isDone = selectedRun?.stageRuns.find((item) => item.id === stage.id)?.state === "completed";
            return (
              <div
                key={stage.id}
                className={[
                  "rounded-lg border px-3 py-2",
                  isActive
                    ? "border-sky-300 bg-sky-50"
                    : isDone
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50",
                ].join(" ")}
              >
                <div className="text-[10px] font-semibold uppercase text-slate-500">
                  {copy.stage} {index + 1}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-950">{stage.title}</div>
                <div className="mt-1 text-[10px] font-semibold text-slate-500">{stageMeta.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Reusable assets</div>
            <div className="mt-1 text-sm font-semibold text-slate-950">{copy.deliverables}</div>
          </div>
          <button
            type="button"
            onClick={() => onOpenApp("knowledge_vault" as AppId)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {copy.openApp}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {assets.map((asset) => (
            <button
              key={asset}
              type="button"
              onClick={() => onOpenApp("knowledge_vault" as AppId)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-white"
            >
              {asset}
            </button>
          ))}
        </div>
      </section>

      <section className="shrink-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="text-xs font-semibold uppercase text-slate-500">{copy.progress}</div>
        <div className="mt-3 space-y-2">
          {executionEvents.slice(0, 4).map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span
                  className={[
                    "mt-1.5 h-2 w-2 rounded-full",
                    event.tone === "success"
                      ? "bg-emerald-500"
                      : event.tone === "error"
                        ? "bg-rose-500"
                        : "bg-slate-400",
                  ].join(" ")}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900">{event.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{event.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
});

