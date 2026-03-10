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

let tasks: TaskRecord[] = [
  {
    id: "seed-1",
    name: "Assistant - Extract cover & highlights",
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "seed-2",
    name: "Assistant - Generate & distribute multilingual copy",
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const cancelById = new Map<TaskId, () => void>();
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeTasks(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTasks() {
  return tasks.slice().sort((a, b) => b.updatedAt - a.updatedAt);
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
  tasks = [task, ...tasks];
  emit();
  return id;
}

export function updateTask(taskId: TaskId, patch: Partial<Omit<TaskRecord, "id" | "createdAt">>) {
  const now = Date.now();
  tasks = tasks.map((t) =>
    t.id === taskId
      ? {
          ...t,
          ...patch,
          updatedAt: now,
        }
      : t,
  );
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
  tasks = tasks.filter((t) => t.id !== taskId);
  emit();
}
