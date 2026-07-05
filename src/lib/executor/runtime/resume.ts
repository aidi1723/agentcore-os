import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
  StepResult,
} from "@/lib/executor/contracts";
import type {
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
} from "@/lib/executor/runtime/types";
import { executeMultiStep } from "@/lib/executor/step-executor";
import {
  getControlledExecutionRun,
  requestControlledApproval,
} from "@/lib/server/controlled-execution-store";

export type ResumeControlledExecutionRunResult =
  | {
      ok: true;
      status: 200;
      run: ControlledExecutionRunRecord;
      resumedStepIds: string[];
    }
  | {
      ok: false;
      status: 404 | 409;
      error: string;
      run?: ControlledExecutionRunRecord;
      state?: ControlledExecutionRunRecord["state"];
      currentStepId?: string;
    };

function stepDurationMs(step: ControlledExecutionStepRecord) {
  if (typeof step.startedAt === "number" && typeof step.finishedAt === "number") {
    return Math.max(0, step.finishedAt - step.startedAt);
  }
  return 0;
}

function toStepResult(step: ControlledExecutionStepRecord): StepResult | null {
  if (step.state !== "completed" && step.state !== "skipped") return null;
  return {
    stepId: step.stepId,
    status: step.state,
    output: step.output,
    toolCallResults: step.toolCallResults,
    tokensUsed: step.toolCallResults.reduce((sum, item) => sum + (item.tokensUsed ?? 0), 0),
    durationMs: stepDurationMs(step),
    error: step.error,
  };
}

function buildRequestFromRun(run: ControlledExecutionRunRecord): AgentCoreTaskRequest {
  return {
    taskInput: { userMessage: run.plan.goal },
    session: { id: run.sessionId },
    metadata: { requestId: run.id, source: "controlled-run-resume" },
    context: {
      systemPrompt: "",
      workspace: {
        workflowRunId: run.workflowRunId,
        activeScenarioId: run.scenarioId,
      },
    },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {
      timeoutSeconds: 60,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
    multiStep: {
      enabled: true,
      maxSteps: run.plan.totalSteps,
      approvalMode: "each-review-step",
    },
    controlledPlaybookId: run.playbookId,
    controlledPlan: run.plan,
  };
}

function findStartIndex(run: ControlledExecutionRunRecord) {
  return run.plan.steps.findIndex((step) => {
    const record = run.steps.find((item) => item.stepId === step.id);
    return record?.state !== "completed" && record?.state !== "skipped";
  });
}

function buildCallbacks(runId: string, newlyStarted: string[]): ExecutionCallbacks {
  return {
    onPlanReady() {},
    onStepStart(step) {
      newlyStarted.push(step.id);
    },
    onStepProgress() {},
    onStepComplete() {},
    onAwaitingApproval(step) {
      void requestControlledApproval(runId, step.id).catch(() => null);
    },
    async waitForApproval(stepId) {
      return { approved: false, feedback: `Awaiting approval for ${stepId}` };
    },
    onError() {},
  };
}

export async function resumeControlledExecutionRun(
  runId: string,
): Promise<ResumeControlledExecutionRunResult> {
  const run = await getControlledExecutionRun(runId);
  if (!run) {
    return { ok: false, status: 404, error: "Controlled run not found" };
  }

  if (run.state === "completed" || run.state === "failed" || run.state === "cancelled") {
    return {
      ok: false,
      status: 409,
      error: `Cannot resume ${run.state} controlled run`,
      run,
      state: run.state,
      currentStepId: run.currentStepId,
    };
  }

  const startStepIndex = findStartIndex(run);
  if (startStepIndex < 0) {
    return {
      ok: false,
      status: 409,
      error: "Cannot resume completed controlled run",
      run,
      state: "completed",
      currentStepId: run.currentStepId,
    };
  }

  const startStep = run.plan.steps[startStepIndex];
  const startRecord = run.steps.find((step) => step.stepId === startStep.id);
  const startApprovalState = startRecord?.approval?.state;
  const isAwaitingApprovalWithoutDecision =
    startApprovalState === "pending" ||
    startApprovalState === "timed_out" ||
    (startRecord?.state === "awaiting_approval" && !startRecord.approval);
  if (isAwaitingApprovalWithoutDecision) {
    return {
      ok: false,
      status: 409,
      error: "Controlled run is awaiting approval",
      run,
      state: "awaiting_approval",
      currentStepId: startStep.id,
    };
  }
  if (startRecord?.approval?.state === "rejected") {
    return {
      ok: false,
      status: 409,
      error: "Controlled run approval was rejected",
      run,
      state: "failed",
      currentStepId: startStep.id,
    };
  }

  const initialStepResults = run.steps
    .map(toStepResult)
    .filter((item): item is StepResult => Boolean(item));
  const approvedStepIds = run.steps
    .filter((step) => step.approval?.state === "approved")
    .map((step) => step.stepId);
  const newlyStarted: string[] = [];
  await executeMultiStep(
    run.plan,
    buildRequestFromRun(run),
    buildCallbacks(run.id, newlyStarted),
    undefined,
    {
      initialStepResults,
      startStepIndex,
      approvedStepIds,
      pauseOnApprovalRequired: true,
      suppressPlanReady: true,
    },
  );
  const updatedRun = await getControlledExecutionRun(run.id);

  return {
    ok: true,
    status: 200,
    run: updatedRun ?? run,
    resumedStepIds: newlyStarted.filter((stepId) => {
      const previous = run.steps.find((step) => step.stepId === stepId);
      return previous?.state !== "completed" && previous?.state !== "skipped";
    }),
  };
}
