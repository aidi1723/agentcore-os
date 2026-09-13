"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Square, Trash2 } from "lucide-react";
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
import { Button, Card, Badge } from "@/design-system";
import { CardHeader, CardBody, CardDivider } from "@/design-system";

function getStatusBadgeVariant(status: TaskStatus): { variant: "success" | "info" | "danger" | "primary" | "default"; text: string } {
  switch (status) {
    case "running":
      return { variant: "success", text: "🔄 执行中" };
    case "queued":
      return { variant: "info", text: "⏳ 排队中" };
    case "stopped":
      return { variant: "danger", text: "⛔ 已停止" };
    case "done":
      return { variant: "primary", text: "✅ 已完成" };
    case "error":
      return { variant: "danger", text: "❌ 失败" };
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

  const stats = useMemo(
    () => ({
      running: tasks.filter((t) => t.status === "running").length,
      total: tasks.length,
      finished: tasks.filter((t) => t.status === "done" || t.status === "error" || t.status === "stopped").length,
    }),
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
      <div className="relative bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">活动监视器</h1>
              <p className="mt-2 text-sm text-gray-600">
                当前运行中：{stats.running} 个 AI 任务
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" size="lg">
                总任务 {stats.total} 项
              </Badge>
              <Badge variant="success" size="lg">
                运行中 {stats.running} 项
              </Badge>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-xs text-gray-500">系统</div>
                <div className="mt-1 font-mono text-sm text-gray-900">
                  task runtime
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6">
          <Card padding="md">
            <CardHeader
              title="任务列表"
              subtitle={`${tasks.length} 项任务`}
              actions={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => clearFinishedTasks()}
                  disabled={stats.finished === 0}
                >
                  清理已结束
                </Button>
              }
            />

            <CardDivider />

            <CardBody spacing="none">
              {tasks.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-900">还没有任务</div>
                    <div className="mt-2 max-w-md text-xs text-gray-500">
                      从 Spotlight、AI 文案、视觉工坊或发布中心触发动作后，这里会出现任务记录。
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {tasks.map((task) => {
                    const badgeConfig = getStatusBadgeVariant(task.status);
                    return (
                      <div key={task.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-sm font-semibold text-gray-900">
                              {task.name}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant={badgeConfig.variant} size="sm">
                                {badgeConfig.text}
                                {task.status === "running" && typeof task.progress === "number"
                                  ? ` ${task.progress}%`
                                  : ""}
                              </Badge>
                              {task.status === "running" && (
                                <span className="text-xs text-gray-500">
                                  pipeline: agentcore
                                </span>
                              )}
                              {task.status === "error" && task.detail && (
                                <span className="text-xs text-red-600">
                                  {task.detail}
                                </span>
                              )}
                            </div>
                          </div>

                          {task.status === "running" ? (
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<Square className="h-4 w-4" />}
                              onClick={() => cancelTask(task.id)}
                              aria-label="停止任务"
                            >
                              停止
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => removeTask(task.id)}
                              aria-label="移除任务"
                            >
                              移除
                            </Button>
                          )}
                        </div>

                        {task.status === "running" && typeof task.progress === "number" && (
                          <div className="mt-4">
                            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-[width] duration-500"
                                style={{ width: `${task.progress}%` }}
                                role="progressbar"
                                aria-valuenow={task.progress}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              />
                            </div>
                            <div className="mt-2 font-mono text-xs text-gray-500">
                              ETA: {Math.max(1, Math.round((100 - task.progress) / 2))}s
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-mono text-xs text-gray-600">
              任务记录会同步到运行状态层，便于统一追踪与回看。
            </p>
          </div>
        </div>
      </div>
    </AppWindowShell>
  );
}
