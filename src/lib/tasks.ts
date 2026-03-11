export type TaskId = string;

export type TaskStatus = "running" | "queued" | "done" | "error" | "stopped";

export type TaskRecord = {
  id: TaskId;
  name: string;
  status: TaskStatus;
  progress?: number; // 0-100
  detail?: string;
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
const TASKS_KEY = "openclaw.tasks.v1";

let tasks: TaskRecord[] | null = null;

const cancelById = new Map<TaskId, () => void>();
const listeners = new Set<Listener>();

function loadTasks(): TaskRecord[] {
  if (tasks) return tasks;
  if (typeof window === "undefined") {
    tasks = [];
    return tasks;
  }
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    if (!raw) {
      tasks = [];
      return tasks;
    }
    const parsed = JSON.parse(raw) as unknown;
    tasks = Array.isArray(parsed) ? (parsed as TaskRecord[]) : [];
    return tasks;
  } catch {
    tasks = [];
    return tasks;
  }
}

function saveTasks(next: TaskRecord[]) {
  tasks = next.slice(0, 120);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // ignore
  }
}

function emit() {
  for (const l of listeners) l();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("openclaw:tasks"));
  }
}

export function subscribeTasks(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTasks() {
  return loadTasks()
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createTask(input: { name: string; status?: TaskStatus; progress?: number; detail?: string }) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = Date.now();
  const task: TaskRecord = {
    id,
    name: input.name,
    status: input.status ?? "queued",
    progress: input.progress,
    detail: input.detail,
    createdAt: now,
    updatedAt: now,
  };
  saveTasks([task, ...loadTasks()]);
  emit();
  return id;
}

export function updateTask(taskId: TaskId, patch: Partial<Omit<TaskRecord, "id" | "createdAt">>) {
  const now = Date.now();
  saveTasks(loadTasks().map((t) =>
    t.id === taskId
      ? {
          ...t,
          ...patch,
          updatedAt: now,
        }
      : t,
  ));
  emit();
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
  saveTasks(loadTasks().filter((t) => t.id !== taskId));
  emit();
}

export function clearFinishedTasks() {
  saveTasks(
    loadTasks().filter((t) => t.status === "running" || t.status === "queued"),
  );
  emit();
}
