import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";
import type { WorkflowContextMeta } from "@/lib/workflow-context";

export type TaskId = string;

export type TaskStatus = "running" | "queued" | "done" | "error" | "stopped";

export type TaskRecord = {
  id: TaskId;
  name: string;
  status: TaskStatus;
  progress?: number;
  detail?: string;
  createdAt: number;
  updatedAt: number;
} & WorkflowContextMeta;

type Listener = () => void;
type TaskTombstone = SyncTombstoneRecord;

const TASKS_KEY = "openclaw.tasks.v1";
const MAX_TASKS = 120;

const cancelById = new Map<TaskId, () => void>();

function sortTasks(items: TaskRecord[]) {
  return items
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_TASKS);
}

const taskState = createServerBackedListState<TaskRecord, TaskTombstone>({
  statusId: "tasks",
  statusLabel: "任务",
  storageKey: TASKS_KEY,
  eventName: "openclaw:tasks",
  maxItems: MAX_TASKS,
  listPath: "/api/runtime/state/tasks",
  deletePath: (taskId) => `/api/runtime/state/tasks/${encodeURIComponent(taskId)}`,
  itemBodyKey: "task",
  sortItems: sortTasks,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | { ok?: boolean; data?: { tasks?: TaskRecord[]; tombstones?: TaskTombstone[] } };
    return {
      items: Array.isArray(payload?.data?.tasks) ? payload.data.tasks : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: { task?: TaskRecord | null; tombstone?: TaskTombstone | null; accepted?: boolean };
        };
    return {
      item: payload?.data?.task ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
});

export async function hydrateTasksFromServer(force = false) {
  return taskState.hydrateFromServer(force);
}

export function subscribeTasks(listener: Listener) {
  return taskState.subscribe(listener);
}

export function getTasks() {
  return taskState.getItems();
}

export function createTask(input: {
  name: string;
  status?: TaskStatus;
  progress?: number;
  detail?: string;
  workflowRunId?: string;
  workflowScenarioId?: string;
  workflowStageId?: string;
  workflowSource?: string;
  workflowNextStep?: string;
  workflowTriggerType?: WorkflowContextMeta["workflowTriggerType"];
}) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = Date.now();
  const task: TaskRecord = {
    id,
    name: input.name,
    status: input.status ?? "queued",
    progress: input.progress,
    detail: input.detail,
    workflowRunId: input.workflowRunId,
    workflowScenarioId: input.workflowScenarioId,
    workflowStageId: input.workflowStageId,
    workflowSource: input.workflowSource,
    workflowNextStep: input.workflowNextStep,
    workflowTriggerType: input.workflowTriggerType,
    createdAt: now,
    updatedAt: now,
  };
  taskState.saveLocal([task, ...taskState.load()]);
  taskState.emit();
  void taskState.syncItemToServer(task);
  return id;
}

export function updateTask(
  taskId: TaskId,
  patch: Partial<Omit<TaskRecord, "id" | "createdAt">>,
) {
  const now = Date.now();
  let nextTask: TaskRecord | null = null;
  taskState.saveLocal(
    taskState.load().map((task) => {
      if (task.id !== taskId) return task;
      nextTask = {
        ...task,
        ...patch,
        updatedAt: now,
      };
      return nextTask;
    }),
  );
  taskState.emit();
  if (nextTask) {
    void taskState.syncItemToServer(nextTask);
  }
}

export function registerTaskCancel(taskId: TaskId, cancel: () => void) {
  cancelById.set(taskId, cancel);
}

export function cancelTask(taskId: TaskId) {
  const cancel = cancelById.get(taskId);
  cancel?.();
  cancelById.delete(taskId);
  updateTask(taskId, { status: "stopped", detail: "已手动停止" });
}

export function removeTask(taskId: TaskId) {
  cancelById.delete(taskId);
  const current = taskState.load().find((task) => task.id === taskId) ?? null;
  taskState.saveLocal(taskState.load().filter((task) => task.id !== taskId));
  taskState.emit();
  if (current) {
    void taskState.removeItemOnServer(taskId, current.updatedAt);
  }
}

export function clearFinishedTasks() {
  const current = taskState.load();
  const finished = current.filter(
    (task) => task.status !== "running" && task.status !== "queued",
  );
  taskState.saveLocal(
    current.filter((task) => task.status === "running" || task.status === "queued"),
  );
  taskState.emit();
  for (const task of finished) {
    cancelById.delete(task.id);
    void taskState.removeItemOnServer(task.id, task.updatedAt);
  }
}
