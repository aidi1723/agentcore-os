import {
  createServerBackedListState,
  type SyncTombstoneRecord,
} from "@/lib/server-backed-list-state";
import type { WorkspaceScenario } from "@/lib/workspace-presets";

export type WorkflowTriggerType = "manual" | "schedule" | "inbound_message" | "web_form";

export type WorkflowRunState = "idle" | "running" | "awaiting_human" | "completed" | "error";

export type WorkflowStageRunState = "pending" | "running" | "awaiting_human" | "completed" | "error";

export type WorkflowStageRun = {
  id: string;
  title: string;
  mode: WorkspaceScenario["workflowStages"][number]["mode"];
  state: WorkflowStageRunState;
};

export type WorkflowRunRecord = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  triggerType: WorkflowTriggerType;
  state: WorkflowRunState;
  currentStageId?: string;
  stageRuns: WorkflowStageRun[];
  createdAt: number;
  updatedAt: number;
};

type Listener = () => void;
type WorkflowRunTombstone = SyncTombstoneRecord & {
  scenarioId?: string;
};

const STORAGE_KEY = "openclaw.workflow-runs.v1";
const MAX_WORKFLOW_RUNS = 60;

function compareWorkflowRunPriority(left: WorkflowRunRecord, right: WorkflowRunRecord) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt - right.updatedAt;
  }
  return left.id.localeCompare(right.id, "en");
}

function dedupeWorkflowRuns(items: WorkflowRunRecord[]) {
  const byId = new Map<string, WorkflowRunRecord>();
  for (const run of items) {
    const existing = byId.get(run.id);
    if (!existing || existing.updatedAt <= run.updatedAt) {
      byId.set(run.id, run);
    }
  }

  const next: WorkflowRunRecord[] = [];
  const byScenario = new Map<string, WorkflowRunRecord>();
  for (const run of byId.values()) {
    const existing = byScenario.get(run.scenarioId);
    if (!existing || compareWorkflowRunPriority(existing, run) < 0) {
      byScenario.set(run.scenarioId, run);
    }
  }
  for (const run of Array.from(byScenario.values()).sort((a, b) => b.updatedAt - a.updatedAt)) {
    next.push(run);
    if (next.length >= MAX_WORKFLOW_RUNS) break;
  }
  return next;
}

const workflowRunState = createServerBackedListState<
  WorkflowRunRecord,
  WorkflowRunTombstone
>({
  statusId: "workflow-runs",
  statusLabel: "工作流运行",
  storageKey: STORAGE_KEY,
  eventName: "openclaw:workflow-runs",
  maxItems: MAX_WORKFLOW_RUNS,
  listPath: "/api/runtime/state/workflow-runs",
  deletePath: (runId) => `/api/runtime/state/workflow-runs/${encodeURIComponent(runId)}`,
  itemBodyKey: "workflowRun",
  sortItems: dedupeWorkflowRuns,
  parseHydrateData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            workflowRuns?: WorkflowRunRecord[];
            tombstones?: WorkflowRunTombstone[];
          };
        };
    return {
      items: Array.isArray(payload?.data?.workflowRuns) ? payload.data.workflowRuns : null,
      tombstones: Array.isArray(payload?.data?.tombstones) ? payload.data.tombstones : [],
    };
  },
  parseUpsertData: (data) => {
    const payload = data as
      | null
      | {
          ok?: boolean;
          data?: {
            workflowRun?: WorkflowRunRecord | null;
            tombstone?: WorkflowRunTombstone | null;
            accepted?: boolean;
          };
        };
    return {
      item: payload?.data?.workflowRun ?? null,
      tombstone: payload?.data?.tombstone ?? null,
    };
  },
  mergeItems: (localItems, serverItems) => dedupeWorkflowRuns([...serverItems, ...localItems]),
  applyTombstones: (items, tombstones) => {
    if (tombstones.length === 0) return items;
    const tombstoneIds = new Set(tombstones.map((tombstone) => tombstone.id));
    return items.filter((item) => !tombstoneIds.has(item.id));
  },
  shouldResyncLocalItem: (item, context) => {
    const tombstone = context.tombstoneById.get(item.id);
    if (tombstone && tombstone.deletedAt >= item.createdAt) {
      return false;
    }
    const serverRun = context.serverById.get(item.id);
    const serverScenarioRun = context.serverItems.find(
      (candidate) => candidate.scenarioId === item.scenarioId,
    );
    if (
      serverScenarioRun &&
      serverScenarioRun.id !== item.id &&
      compareWorkflowRunPriority(item, serverScenarioRun) <= 0
    ) {
      return false;
    }
    if (!serverScenarioRun || compareWorkflowRunPriority(serverScenarioRun, item) < 0) {
      return true;
    }
    return Boolean(serverRun && item.updatedAt > serverRun.updatedAt);
  },
});

export async function hydrateWorkflowRunsFromServer(force = false) {
  return workflowRunState.hydrateFromServer(force);
}

function sortRuns(items: WorkflowRunRecord[]) {
  return dedupeWorkflowRuns(items);
}

export function subscribeWorkflowRuns(listener: Listener) {
  return workflowRunState.subscribe(listener);
}

export function getWorkflowRuns() {
  return workflowRunState.getItems();
}

export function getWorkflowRun(runId: string) {
  return getWorkflowRuns().find((run) => run.id === runId) ?? null;
}

export function getLatestWorkflowRunForScenario(scenarioId: string) {
  return getWorkflowRuns().find((run) => run.scenarioId === scenarioId) ?? null;
}

export function startWorkflowRun(
  scenario: WorkspaceScenario,
  triggerType: WorkflowTriggerType,
) {
  const now = Date.now();
  const stageRuns: WorkflowStageRun[] = scenario.workflowStages.map((stage, index) => ({
    id: stage.id,
    title: stage.title,
    mode: stage.mode,
    state:
      index === 0
        ? stage.mode === "review" || stage.mode === "manual"
          ? "awaiting_human"
          : "running"
        : "pending",
  }));

  const run: WorkflowRunRecord = {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    triggerType,
    state: stageRuns[0]?.state === "awaiting_human" ? "awaiting_human" : "running",
    currentStageId: stageRuns[0]?.id,
    stageRuns,
    createdAt: now,
    updatedAt: now,
  };

  workflowRunState.saveLocal([
    run,
    ...workflowRunState.load().filter((item) => item.scenarioId !== scenario.id),
  ]);
  workflowRunState.emit();
  void workflowRunState.syncItemToServer(run);
  return run.id;
}

export function advanceWorkflowRun(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  workflowRunState.saveLocal(
    workflowRunState.load().map((run) => {
      if (run.id !== runId) return run;
      const currentIndex = run.stageRuns.findIndex((stage) => stage.id === run.currentStageId);
      if (currentIndex === -1) return run;
      const nextIndex = currentIndex + 1;
      const stageRuns: WorkflowStageRun[] = run.stageRuns.map((stage, index) => {
        if (index === currentIndex) return { ...stage, state: "completed" as const };
        if (index === nextIndex) {
          return {
            ...stage,
            state: (stage.mode === "review" || stage.mode === "manual"
              ? "awaiting_human"
              : "running") as WorkflowStageRunState,
          };
        }
        return stage;
      });
      const nextStage = stageRuns[nextIndex];
      updated = {
        ...run,
        stageRuns,
        currentStageId: nextStage?.id,
        state: nextStage
          ? nextStage.state === "awaiting_human"
            ? "awaiting_human"
            : "running"
          : "completed",
        updatedAt: now,
      };
      return updated;
    }),
  );
  workflowRunState.emit();
  if (updated) {
    void workflowRunState.syncItemToServer(updated);
  }
  return updated;
}

export function setWorkflowRunAwaitingHuman(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  workflowRunState.saveLocal(
    workflowRunState.load().map((run) => {
      if (run.id !== runId) return run;
      const stageRuns = run.stageRuns.map((stage) =>
        stage.id === run.currentStageId ? { ...stage, state: "awaiting_human" as const } : stage,
      );
      updated = {
        ...run,
        stageRuns,
        state: "awaiting_human",
        updatedAt: now,
      };
      return updated;
    }),
  );
  workflowRunState.emit();
  if (updated) {
    void workflowRunState.syncItemToServer(updated);
  }
  return updated;
}

export function completeWorkflowRun(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  workflowRunState.saveLocal(
    workflowRunState.load().map((run) => {
      if (run.id !== runId) return run;
      updated = {
        ...run,
        state: "completed",
        stageRuns: run.stageRuns.map((stage) =>
          stage.state === "completed" ? stage : { ...stage, state: "completed" as const },
        ),
        currentStageId: undefined,
        updatedAt: now,
      };
      return updated;
    }),
  );
  workflowRunState.emit();
  if (updated) {
    void workflowRunState.syncItemToServer(updated);
  }
  return updated;
}

export function failWorkflowRun(runId: string) {
  const now = Date.now();
  let updated: WorkflowRunRecord | null = null;
  workflowRunState.saveLocal(
    workflowRunState.load().map((run) => {
      if (run.id !== runId) return run;
      updated = {
        ...run,
        state: "error",
        stageRuns: run.stageRuns.map((stage) =>
          stage.id === run.currentStageId ? { ...stage, state: "error" as const } : stage,
        ),
        updatedAt: now,
      };
      return updated;
    }),
  );
  workflowRunState.emit();
  if (updated) {
    void workflowRunState.syncItemToServer(updated);
  }
  return updated;
}
