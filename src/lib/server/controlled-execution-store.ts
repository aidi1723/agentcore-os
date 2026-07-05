import type { ExecutionPlan } from "@/lib/executor/contracts";
import type {
  ControlledApprovalRecord,
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
  ControlledRunAuditEvent,
} from "@/lib/executor/runtime/types";
import { redactSensitiveText } from "@/lib/executor/redaction";
import { readJsonFile, readModifyWrite } from "@/lib/server/json-store";

const FILE_NAME = "controlled-execution-runs.json";
const MAX_RUNS = 400;

function now() {
  return Date.now();
}

function clipError(value?: string) {
  if (!value) return undefined;
  const redacted = redactSensitiveText(value).trim();
  return redacted ? redacted.slice(0, 4_000) : undefined;
}

function normalizeStep(input: ControlledExecutionStepRecord): ControlledExecutionStepRecord {
  return {
    stepId: String(input.stepId),
    state: input.state || "pending",
    startedAt: Number.isFinite(input.startedAt) ? input.startedAt : undefined,
    finishedAt: Number.isFinite(input.finishedAt) ? input.finishedAt : undefined,
    input: input.input ?? null,
    output: input.output ?? null,
    error: clipError(input.error),
    attempts: Number.isFinite(input.attempts) ? Math.max(0, Math.floor(input.attempts)) : 0,
    toolCallResults: Array.isArray(input.toolCallResults) ? input.toolCallResults : [],
    approval: input.approval,
    schemaValidation: input.schemaValidation,
    writebackReceipts: Array.isArray(input.writebackReceipts) ? input.writebackReceipts : [],
  };
}

function normalizeAuditEvent(input: unknown): ControlledRunAuditEvent | null {
  if (!input || typeof input !== "object") return null;
  const item = input as ControlledRunAuditEvent;
  if (!item.id || item.type !== "console_retry_requested" || item.actor !== "local_user") {
    return null;
  }
  return {
    id: String(item.id),
    type: "console_retry_requested",
    stepId: item.stepId ? String(item.stepId) : undefined,
    message: clipError(item.message),
    createdAt: Number.isFinite(item.createdAt) ? item.createdAt : now(),
    actor: "local_user",
  };
}

function normalizeRun(input: unknown): ControlledExecutionRunRecord | null {
  if (!input || typeof input !== "object") return null;
  const item = input as ControlledExecutionRunRecord;
  if (!item.id || !item.requestId || !item.sessionId || !item.playbookId || !item.plan) {
    return null;
  }

  return {
    id: String(item.id),
    requestId: String(item.requestId),
    sessionId: String(item.sessionId),
    workflowRunId: item.workflowRunId ? String(item.workflowRunId) : undefined,
    scenarioId: item.scenarioId ? String(item.scenarioId) : undefined,
    playbookId: String(item.playbookId),
    playbookVersion: String(item.playbookVersion || ""),
    planId: String(item.planId || item.plan.id),
    state: item.state || "running",
    currentStepId: item.currentStepId,
    createdAt: Number.isFinite(item.createdAt) ? item.createdAt : now(),
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : now(),
    finishedAt: Number.isFinite(item.finishedAt) ? item.finishedAt : undefined,
    error: clipError(item.error),
    auditEvents: Array.isArray(item.auditEvents)
      ? item.auditEvents
          .map(normalizeAuditEvent)
          .filter((event): event is ControlledRunAuditEvent => Boolean(event))
      : [],
    plan: item.plan,
    steps: Array.isArray(item.steps) ? item.steps.map(normalizeStep) : [],
  };
}

async function readRuns() {
  const raw = await readJsonFile<unknown[]>(FILE_NAME, []);
  return raw
    .map(normalizeRun)
    .filter((item): item is ControlledExecutionRunRecord => Boolean(item))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_RUNS);
}

function buildInitialSteps(plan: ExecutionPlan): ControlledExecutionStepRecord[] {
  return plan.steps.map((step) => ({
    stepId: step.id,
    state: "pending",
    input: null,
    output: null,
    attempts: 0,
    toolCallResults: [],
    writebackReceipts: [],
  }));
}

export async function createControlledExecutionRun(input: {
  id: string;
  requestId: string;
  sessionId: string;
  workflowRunId?: string;
  scenarioId?: string;
  playbookId: string;
  playbookVersion: string;
  plan: ExecutionPlan;
}) {
  const timestamp = now();
  const run: ControlledExecutionRunRecord = {
    id: input.id,
    requestId: input.requestId,
    sessionId: input.sessionId,
    workflowRunId: input.workflowRunId,
    scenarioId: input.scenarioId,
    playbookId: input.playbookId,
    playbookVersion: input.playbookVersion,
    planId: input.plan.id,
    state: "running",
    createdAt: timestamp,
    updatedAt: timestamp,
    auditEvents: [],
    plan: input.plan,
    steps: buildInitialSteps(input.plan),
  };

  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) => {
    const runs = current
      .map(normalizeRun)
      .filter((item): item is ControlledExecutionRunRecord => Boolean(item))
      .filter((item) => item.id !== run.id && item.requestId !== run.requestId);
    return [run, ...runs].slice(0, MAX_RUNS);
  });

  return run;
}

export async function getControlledExecutionRun(id: string) {
  return (await readRuns()).find((run) => run.id === id) ?? null;
}

export async function findControlledExecutionRunByRequestId(requestId: string) {
  return (await readRuns()).find((run) => run.requestId === requestId) ?? null;
}

export async function listControlledExecutionRuns(filter?: {
  workflowRunId?: string;
  sessionId?: string;
  playbookId?: string;
}) {
  const runs = await readRuns();
  return runs.filter((run) => {
    if (filter?.workflowRunId && run.workflowRunId !== filter.workflowRunId) return false;
    if (filter?.sessionId && run.sessionId !== filter.sessionId) return false;
    if (filter?.playbookId && run.playbookId !== filter.playbookId) return false;
    return true;
  });
}

export async function updateControlledExecutionRun(
  id: string,
  patch: Partial<Pick<ControlledExecutionRunRecord, "state" | "currentStepId" | "error">>,
) {
  const timestamp = now();
  let updated: ControlledExecutionRunRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) =>
    current.map((raw) => {
      const run = normalizeRun(raw);
      if (!run || run.id !== id) return raw;
      updated = {
        ...run,
        ...patch,
        error: clipError(patch.error) ?? run.error,
        updatedAt: timestamp,
        finishedAt:
          patch.state === "completed" || patch.state === "failed" || patch.state === "cancelled"
            ? timestamp
            : run.finishedAt,
      };
      return updated;
    }),
  );
  return updated;
}

export async function appendControlledRunAuditEvent(
  id: string,
  event: ControlledRunAuditEvent,
) {
  const normalizedEvent = normalizeAuditEvent(event);
  if (!normalizedEvent) return null;
  let updated: ControlledExecutionRunRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) =>
    current.map((raw) => {
      const run = normalizeRun(raw);
      if (!run || run.id !== id) return raw;
      updated = {
        ...run,
        auditEvents: [...run.auditEvents, normalizedEvent],
        updatedAt: now(),
      };
      return updated;
    }),
  );
  return updated;
}

export async function updateControlledExecutionStep(
  executionId: string,
  stepId: string,
  patch: Partial<ControlledExecutionStepRecord>,
) {
  const timestamp = now();
  let updatedStep: ControlledExecutionStepRecord | null = null;
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) =>
    current.map((raw) => {
      const run = normalizeRun(raw);
      if (!run || run.id !== executionId) return raw;
      const steps = run.steps.map((step) => {
        if (step.stepId !== stepId) return step;
        updatedStep = normalizeStep({
          ...step,
          ...patch,
          error: clipError(patch.error) ?? step.error,
          startedAt:
            patch.state === "running" && !step.startedAt
              ? timestamp
              : (patch.startedAt ?? step.startedAt),
          finishedAt:
            patch.state === "completed" || patch.state === "failed" || patch.state === "skipped"
              ? timestamp
              : (patch.finishedAt ?? step.finishedAt),
        });
        return updatedStep;
      });
      return {
        ...run,
        steps,
        currentStepId: stepId,
        updatedAt: timestamp,
      };
    }),
  );
  return updatedStep;
}

export async function requestControlledApproval(executionId: string, stepId: string) {
  const timestamp = now();
  const approval: ControlledApprovalRecord = {
    executionId,
    stepId,
    state: "pending",
    requestedAt: timestamp,
  };
  await readModifyWrite<unknown[]>(FILE_NAME, [], (current) =>
    current.map((raw) => {
      const run = normalizeRun(raw);
      if (!run || run.id !== executionId) return raw;
      const isTerminal =
        run.state === "completed" || run.state === "failed" || run.state === "cancelled";
      const steps = run.steps.map((step) => {
        if (step.stepId !== stepId) return step;
        if (step.approval && step.approval.state !== "pending") {
          return step;
        }
        return normalizeStep({
          ...step,
          state: "awaiting_approval",
          approval,
        });
      });
      return {
        ...run,
        steps,
        state: isTerminal ? run.state : "awaiting_approval",
        currentStepId: stepId,
        updatedAt: timestamp,
      };
    }),
  );
  return approval;
}

export async function resolveControlledApproval(
  executionId: string,
  stepId: string,
  input: { approved: boolean; feedback?: string },
) {
  const timestamp = now();
  const approval: ControlledApprovalRecord = {
    executionId,
    stepId,
    state: input.approved ? "approved" : "rejected",
    requestedAt: timestamp,
    resolvedAt: timestamp,
    feedback: clipError(input.feedback),
    approver: "local_user",
  };
  await updateControlledExecutionStep(executionId, stepId, {
    approval,
  });
  if (!input.approved) {
    await updateControlledExecutionRun(executionId, {
      state: "failed",
      error: input.feedback || "User rejected step",
    });
  }
  return approval;
}
