import type { TaskRecord, TaskStatus } from "@/lib/tasks";
import type { WorkflowTriggerType } from "@/lib/workflow-runs";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "tasks.json";
const MAX_ITEMS = 240;
const STATUSES = new Set<TaskStatus>(["running", "queued", "done", "error", "stopped"]);
const TRIGGERS = new Set<WorkflowTriggerType>([
  "manual",
  "schedule",
  "inbound_message",
  "web_form",
]);

function normalizeText(input: unknown) {
  return typeof input === "string" && input.trim() ? input.trim() : undefined;
}

export type TaskStoreTombstone = {
  id: string;
  updatedAt: number;
  deletedAt: number;
};

type TaskStoreEntry = TaskRecord | TaskStoreTombstone;

function normalizeTask(input: unknown): TaskRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  if (!id) return null;
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : createdAt;
  return {
    id,
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "未命名任务",
    status:
      typeof item.status === "string" && STATUSES.has(item.status as TaskStatus)
        ? (item.status as TaskStatus)
        : "queued",
    progress:
      typeof item.progress === "number" && Number.isFinite(item.progress)
        ? Math.max(0, Math.min(100, item.progress))
        : undefined,
    detail: typeof item.detail === "string" ? item.detail : undefined,
    workflowRunId: normalizeText(item.workflowRunId),
    workflowScenarioId: normalizeText(item.workflowScenarioId),
    workflowStageId: normalizeText(item.workflowStageId),
    workflowSource: normalizeText(item.workflowSource),
    workflowNextStep: normalizeText(item.workflowNextStep),
    workflowTriggerType:
      typeof item.workflowTriggerType === "string" &&
      TRIGGERS.has(item.workflowTriggerType as WorkflowTriggerType)
        ? (item.workflowTriggerType as WorkflowTriggerType)
        : undefined,
    createdAt,
    updatedAt,
  };
}

function normalizeTaskTombstone(input: unknown): TaskStoreTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return {
    id,
    updatedAt,
    deletedAt,
  };
}

function isTaskTombstone(entry: TaskStoreEntry): entry is TaskStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): TaskStoreEntry | null {
  return normalizeTaskTombstone(input) ?? normalizeTask(input);
}

function normalizeEntries(raw: unknown): TaskStoreEntry[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Map<string, TaskStoreEntry>();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    const existing = deduped.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      deduped.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isTaskTombstone(existing) &&
      isTaskTombstone(entry)
    ) {
      deduped.set(entry.id, entry);
    }
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveTasks(entries: TaskStoreEntry[]) {
  return entries.filter((entry): entry is TaskRecord => !isTaskTombstone(entry));
}

function taskTombstones(entries: TaskStoreEntry[]) {
  return entries.filter(isTaskTombstone);
}

export async function listTaskStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    tasks: liveTasks(entries),
    tombstones: taskTombstones(entries),
  };
}

export async function writeTasksToStore(input: unknown) {
  const normalized = liveTasks(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertTaskInStore(input: unknown) {
  const candidate = normalizeTask(input);
  if (!candidate) {
    return { task: null, tombstone: null, accepted: false };
  }

  let storedTask: TaskRecord | null = candidate;
  let storedTombstone: TaskStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id);
    if (
      existing &&
      (existing.updatedAt > candidate.updatedAt ||
        (existing.updatedAt === candidate.updatedAt && isTaskTombstone(existing)))
    ) {
      accepted = false;
      if (isTaskTombstone(existing)) {
        storedTask = null;
        storedTombstone = existing;
      } else {
        storedTask = existing;
      }
      return entries;
    }

    const next = [candidate, ...entries.filter((entry) => entry.id !== candidate.id)]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_ITEMS);
    storedTask =
      next.find((entry): entry is TaskRecord => entry.id === candidate.id && !isTaskTombstone(entry)) ??
      candidate;
    storedTombstone = null;
    return next;
  });

  return { task: storedTask, tombstone: storedTombstone, accepted };
}

export async function removeTaskFromStore(taskId: string, updatedAt?: number | null) {
  const normalizedId = taskId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, task: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentTask: TaskRecord | null = null;
  let currentTombstone: TaskStoreTombstone | null = null;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      const deletedAt = Date.now();
      currentTombstone = {
        id: normalizedId,
        updatedAt: deletedAt,
        deletedAt,
      };
      removed = true;
      return [currentTombstone, ...entries].slice(0, MAX_ITEMS);
    }

    if (isTaskTombstone(existing)) {
      currentTombstone = existing;
      if (
        typeof updatedAt === "number" &&
        Number.isFinite(updatedAt) &&
        existing.updatedAt > updatedAt
      ) {
        conflict = true;
      }
      return entries;
    }

    currentTask = existing;

    if (
      typeof updatedAt === "number" &&
      Number.isFinite(updatedAt) &&
      existing.updatedAt > updatedAt
    ) {
      conflict = true;
      return entries;
    }

    const deletedAt = Date.now();
    currentTombstone = {
      id: normalizedId,
      updatedAt: deletedAt,
      deletedAt,
    };
    removed = true;
    return [currentTombstone, ...entries.filter((entry) => entry.id !== normalizedId)].slice(
      0,
      MAX_ITEMS,
    );
  });

  return {
    removed,
    conflict,
    task: currentTask,
    tombstone: currentTombstone,
  };
}
