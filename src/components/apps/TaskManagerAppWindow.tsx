"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Square } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import {
  cancelTask,
  clearFinishedTasks,
  getTasks,
  removeTask,
  subscribeTasks,
  type TaskRecord,
  type TaskStatus,
} from "@/lib/tasks";

function statusBadge(status: TaskStatus) {
  switch (status) {
    case "running":
      return {
        text: "🔄 执行中",
        className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
      };
    case "queued":
      return {
        text: "⏳ 排队中",
        className: "bg-sky-500/15 text-sky-200 border-sky-500/30",
      };
    case "stopped":
      return {
        text: "⛔ 已停止",
        className: "bg-red-500/15 text-red-200 border-red-500/30",
      };
    case "done":
      return {
        text: "✅ 已完成",
        className: "bg-violet-500/15 text-violet-200 border-violet-500/30",
      };
    case "error":
      return {
        text: "❌ 失败",
        className: "bg-red-500/15 text-red-200 border-red-500/30",
      };
  }
}

export function TaskManagerAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>(() => getTasks());

  const runningCount = useMemo(
    () => tasks.filter((t) => t.status === "running").length,
    [tasks],
  );

  useEffect(() => {
    if (state === "minimized" || state === "closing") return;
    setTasks(getTasks());
    return subscribeTasks(() => setTasks(getTasks()));
  }, [state]);

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="任务调度中心"
      icon={Activity}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.task_manager"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="bg-[#0b0f18] text-white">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold tracking-tight">
                活动监视器
              </div>
              <div className="text-sm text-white/60 mt-1">
                当前运行中：{runningCount} 个 AI 任务
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/60">系统</div>
              <div className="mt-1 font-mono text-sm text-white/90">
                openclaw-taskd
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-sm font-semibold text-white/90">任务列表</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-white/50">{tasks.length} 项</div>
                <button
                  type="button"
                  onClick={() => clearFinishedTasks()}
                  disabled={!tasks.some((task) => task.status !== "running" && task.status !== "queued")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  清理已结束
                </button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-sm font-semibold text-white/80">还没有任务</div>
                <div className="mt-2 text-xs text-white/45">
                  从 Spotlight、AI 文案、视觉工坊或发布中心触发动作后，这里会出现任务记录。
                </div>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {tasks.map((task) => {
                  const badge = statusBadge(task.status);
                  return (
                    <div key={task.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-mono text-sm text-white/95 truncate">
                            {task.name}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={[
                                "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold",
                                badge.className,
                              ].join(" ")}
                            >
                              {badge.text}
                              {task.status === "running" && typeof task.progress === "number"
                                ? ` ${task.progress}%`
                                : ""}
                            </span>
                            {task.status === "running" && (
                              <span className="text-xs text-white/50">
                                | pipeline: openclaw
                              </span>
                            )}
                            {task.status === "error" && task.detail && (
                              <span className="text-xs text-red-200/80">
                                | {task.detail}
                              </span>
                            )}
                          </div>
                        </div>

                        {task.status === "running" ? (
                          <button
                            type="button"
                            onClick={() => cancelTask(task.id)}
                            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-semibold hover:bg-red-500/20 transition-colors"
                            title="停止任务"
                          >
                            <Square className="h-4 w-4" />
                            停止
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeTask(task.id)}
                            className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10"
                          >
                            移除
                          </button>
                        )}
                      </div>

                      {task.status === "running" && typeof task.progress === "number" && (
                        <div className="mt-3">
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-500"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div className="mt-2 text-xs text-white/50 font-mono">
                            ETA: {Math.max(1, Math.round((100 - task.progress) / 2))}s
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-xs text-white/45 font-mono">
            提示：任务来自前端全局任务总线；后续可替换为 OpenClaw 服务端事件流。
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
