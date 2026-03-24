import type {
  WorkflowRunRecord,
  WorkflowRunState,
  WorkflowStageRun,
  WorkflowStageRunState,
  WorkflowTriggerType,
} from "@/lib/workflow-runs";
import {
  readJsonFile,
  readModifyWrite,
  writeJsonFile,
} from "@/lib/server/json-store";

const FILE_NAME = "workflow-runs.json";
const MAX_ITEMS = 160;
const RUN_STATES = new Set<WorkflowRunState>([
  "idle",
  "running",
  "awaiting_human",
  "completed",
  "error",
]);
const STAGE_STATES = new Set<WorkflowStageRunState>([
  "pending",
  "running",
  "awaiting_human",
  "completed",
  "error",
]);
const TRIGGERS = new Set<WorkflowTriggerType>([
  "manual",
  "schedule",
  "inbound_message",
  "web_form",
]);

export type WorkflowRunStoreTombstone = {
  id: string;
  scenarioId: string;
  updatedAt: number;
  deletedAt: number;
};

type WorkflowRunStoreEntry = WorkflowRunRecord | WorkflowRunStoreTombstone;

function normalizeStageRun(input: unknown): WorkflowStageRun | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const title = typeof item.title === "string" && item.title.trim() ? item.title : null;
  const mode = typeof item.mode === "string" ? item.mode : null;
  if (!id || !title || !mode) return null;
  return {
    id,
    title,
    mode: mode as WorkflowStageRun["mode"],
    state:
      typeof item.state === "string" && STAGE_STATES.has(item.state as WorkflowStageRunState)
        ? (item.state as WorkflowStageRunState)
        : "pending",
  };
}

function normalizeRun(input: unknown): WorkflowRunRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const scenarioId =
    typeof item.scenarioId === "string" && item.scenarioId.trim() ? item.scenarioId : null;
  const scenarioTitle =
    typeof item.scenarioTitle === "string" && item.scenarioTitle.trim()
      ? item.scenarioTitle
      : null;
  if (!id || !scenarioId || !scenarioTitle) return null;

  const stageRuns = Array.isArray(item.stageRuns)
    ? item.stageRuns
        .map(normalizeStageRun)
        .filter((stage): stage is WorkflowStageRun => Boolean(stage))
    : [];
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
    scenarioId,
    scenarioTitle,
    triggerType:
      typeof item.triggerType === "string" && TRIGGERS.has(item.triggerType as WorkflowTriggerType)
        ? (item.triggerType as WorkflowTriggerType)
        : "manual",
    state:
      typeof item.state === "string" && RUN_STATES.has(item.state as WorkflowRunState)
        ? (item.state as WorkflowRunState)
        : "idle",
    currentStageId:
      typeof item.currentStageId === "string" && item.currentStageId.trim()
        ? item.currentStageId
        : undefined,
    stageRuns,
    createdAt,
    updatedAt,
  };
}

function normalizeWorkflowRunTombstone(input: unknown): WorkflowRunStoreTombstone | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
  const scenarioId =
    typeof item.scenarioId === "string" && item.scenarioId.trim() ? item.scenarioId : null;
  const deletedAt =
    typeof item.deletedAt === "number" && Number.isFinite(item.deletedAt)
      ? item.deletedAt
      : null;
  if (!id || !scenarioId || deletedAt === null) return null;
  const updatedAt =
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : deletedAt;
  return {
    id,
    scenarioId,
    updatedAt,
    deletedAt,
  };
}

function isWorkflowRunTombstone(
  entry: WorkflowRunStoreEntry,
): entry is WorkflowRunStoreTombstone {
  return "deletedAt" in entry;
}

function normalizeEntry(input: unknown): WorkflowRunStoreEntry | null {
  return normalizeWorkflowRunTombstone(input) ?? normalizeRun(input);
}

function compareWorkflowRunPriority(left: WorkflowRunRecord, right: WorkflowRunRecord) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt - right.updatedAt;
  }
  return left.id.localeCompare(right.id, "en");
}

function normalizeEntries(raw: unknown): WorkflowRunStoreEntry[] {
  if (!Array.isArray(raw)) return [];

  const byId = new Map<string, WorkflowRunStoreEntry>();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry) continue;
    const existing = byId.get(entry.id);
    if (!existing || existing.updatedAt < entry.updatedAt) {
      byId.set(entry.id, entry);
      continue;
    }
    if (
      existing.updatedAt === entry.updatedAt &&
      !isWorkflowRunTombstone(existing) &&
      isWorkflowRunTombstone(entry)
    ) {
      byId.set(entry.id, entry);
    }
  }

  const liveByScenario = new Map<string, WorkflowRunRecord>();
  for (const entry of byId.values()) {
    if (isWorkflowRunTombstone(entry)) continue;
    const existing = liveByScenario.get(entry.scenarioId);
    if (!existing || compareWorkflowRunPriority(existing, entry) < 0) {
      liveByScenario.set(entry.scenarioId, entry);
    }
  }

  const next: WorkflowRunStoreEntry[] = [];
  const tombstones = new Map<string, WorkflowRunStoreTombstone>();

  for (const entry of byId.values()) {
    if (isWorkflowRunTombstone(entry)) {
      const existing = tombstones.get(entry.id);
      if (!existing || existing.updatedAt <= entry.updatedAt) {
        tombstones.set(entry.id, entry);
      }
      continue;
    }

    const activeScenarioRun = liveByScenario.get(entry.scenarioId);
    if (activeScenarioRun?.id === entry.id) {
      next.push(entry);
      continue;
    }

    const deletedAt = Math.max(entry.updatedAt, activeScenarioRun?.createdAt ?? entry.updatedAt);
    const tombstone: WorkflowRunStoreTombstone = {
      id: entry.id,
      scenarioId: entry.scenarioId,
      updatedAt: deletedAt,
      deletedAt,
    };
    const existing = tombstones.get(entry.id);
    if (!existing || existing.updatedAt <= tombstone.updatedAt) {
      tombstones.set(entry.id, tombstone);
    }
  }

  return [...next, ...tombstones.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_ITEMS);
}

function liveWorkflowRuns(entries: WorkflowRunStoreEntry[]) {
  return entries.filter((entry): entry is WorkflowRunRecord => !isWorkflowRunTombstone(entry));
}

function workflowRunTombstones(entries: WorkflowRunStoreEntry[]) {
  return entries.filter(isWorkflowRunTombstone);
}

export async function listWorkflowRunsFromStore() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return liveWorkflowRuns(normalizeEntries(raw));
}

export async function listWorkflowRunStoreSnapshot() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  const entries = normalizeEntries(raw);
  return {
    workflowRuns: liveWorkflowRuns(entries),
    tombstones: workflowRunTombstones(entries),
  };
}

export async function writeWorkflowRunsToStore(input: unknown) {
  const normalized = liveWorkflowRuns(normalizeEntries(input));
  await writeJsonFile(FILE_NAME, normalized);
  return normalized;
}

export async function upsertWorkflowRunInStore(input: unknown) {
  const candidate = normalizeRun(input);
  if (!candidate) {
    return { workflowRun: null, tombstone: null, accepted: false };
  }

  let storedRun: WorkflowRunRecord | null = candidate;
  let storedTombstone: WorkflowRunStoreTombstone | null = null;
  let accepted = true;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === candidate.id) ?? null;
    if (existing && isWorkflowRunTombstone(existing)) {
      accepted = false;
      storedRun = null;
      storedTombstone = existing;
      return entries;
    }

    if (
      existing &&
      !isWorkflowRunTombstone(existing) &&
      existing.updatedAt > candidate.updatedAt
    ) {
      accepted = false;
      storedRun = existing;
      storedTombstone = null;
      return entries;
    }

    const activeScenarioRun =
      entries.find(
        (entry): entry is WorkflowRunRecord =>
          !isWorkflowRunTombstone(entry) &&
          entry.scenarioId === candidate.scenarioId &&
          entry.id !== candidate.id,
      ) ?? null;

    if (activeScenarioRun && compareWorkflowRunPriority(activeScenarioRun, candidate) >= 0) {
      accepted = false;
      storedRun = activeScenarioRun;
      storedTombstone = null;
      return entries;
    }

    const next = normalizeEntries([
      candidate,
      ...entries.filter((entry) => entry.id !== candidate.id),
    ]);
    const nextScenarioWinner =
      next.find(
        (entry): entry is WorkflowRunRecord =>
          !isWorkflowRunTombstone(entry) && entry.scenarioId === candidate.scenarioId,
      ) ?? null;
    const nextCandidateTombstone =
      next.find(
        (entry): entry is WorkflowRunStoreTombstone =>
          isWorkflowRunTombstone(entry) && entry.id === candidate.id,
      ) ?? null;

    if (nextCandidateTombstone) {
      accepted = false;
      storedRun = null;
      storedTombstone = nextCandidateTombstone;
      return next;
    }

    storedRun = nextScenarioWinner?.id === candidate.id ? nextScenarioWinner : candidate;
    storedTombstone = null;
    return next;
  });

  return { workflowRun: storedRun, tombstone: storedTombstone, accepted };
}

export async function removeWorkflowRunFromStore(runId: string, updatedAt?: number | null) {
  const normalizedId = runId.trim();
  if (!normalizedId) {
    return { removed: false, conflict: false, workflowRun: null, tombstone: null };
  }

  let removed = false;
  let conflict = false;
  let currentRun: WorkflowRunRecord | null = null;
  let currentTombstone: WorkflowRunStoreTombstone | null = null;

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const entries = normalizeEntries(current);
    const existing = entries.find((entry) => entry.id === normalizedId) ?? null;
    if (!existing) {
      return entries;
    }

    if (isWorkflowRunTombstone(existing)) {
      currentTombstone = existing;
      return entries;
    }

    currentRun = existing;
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
      scenarioId: existing.scenarioId,
      updatedAt: deletedAt,
      deletedAt,
    };
    removed = true;
    return normalizeEntries([
      currentTombstone,
      ...entries.filter((entry) => entry.id !== normalizedId),
    ]);
  });

  return {
    removed,
    conflict,
    workflowRun: currentRun,
    tombstone: currentTombstone,
  };
}
