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
  appendControlledRunAuditEvent,
  getControlledExecutionRun,
  requestControlledApproval,
  updateControlledExecutionRun,
  updateControlledExecutionStep,
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

export type RetryControlledExecutionRunResult =
  | {
      ok: true;
      status: 200;
      run: ControlledExecutionRunRecord;
      retriedStepIds: string[];
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

function buildRequestFromRun(
  run: ControlledExecutionRunRecord,
  source = "controlled-run-resume",
): AgentCoreTaskRequest {
  return {
    taskInput: { userMessage: run.plan.goal },
    session: { id: run.sessionId },
    metadata: { requestId: run.id, source },
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

function findFirstFailedStepIndex(run: ControlledExecutionRunRecord) {
  return run.plan.steps.findIndex((step) => {
    const record = run.steps.find((item) => item.stepId === step.id);
    return record?.state === "failed";
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
  if (startRecord?.state === "failed" && startStep.onFailure?.action !== "retry") {
    return {
      ok: false,
      status: 409,
      error: `Cannot resume failed step ${startStep.id}`,
      run,
      state: run.state,
      currentStepId: startStep.id,
    };
  }
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
    const updatedRun = await updateControlledExecutionRun(run.id, {
      state: "failed",
      error: startRecord.approval.feedback ?? "Controlled run approval was rejected",
    });
    return {
      ok: false,
      status: 409,
      error: "Controlled run approval was rejected",
      run: updatedRun ?? run,
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
  const trace = await executeMultiStep(
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
  if (!trace.success && updatedRun?.state === "failed") {
    return {
      ok: false,
      status: 409,
      error: trace.error ?? updatedRun.error ?? "Controlled run failed during resume",
      run: updatedRun,
      state: updatedRun.state,
      currentStepId: updatedRun.currentStepId,
    };
  }

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

export async function retryControlledExecutionRun(
  runId: string,
): Promise<RetryControlledExecutionRunResult> {
  const run = await getControlledExecutionRun(runId);
  if (!run) {
    return { ok: false, status: 404, error: "Controlled run not found" };
  }

  if (run.state !== "failed") {
    return {
      ok: false,
      status: 409,
      error: `Cannot retry ${run.state} controlled run`,
      run,
      state: run.state,
      currentStepId: run.currentStepId,
    };
  }

  const startStepIndex = findFirstFailedStepIndex(run);
  if (startStepIndex < 0) {
    return {
      ok: false,
      status: 409,
      error: "Cannot retry failed controlled run without a failed step",
      run,
      state: run.state,
      currentStepId: run.currentStepId,
    };
  }

  const startStep = run.plan.steps[startStepIndex];
  const startRecord = run.steps.find((step) => step.stepId === startStep.id);
  if (startStep.onFailure?.action !== "retry") {
    return {
      ok: false,
      status: 409,
      error: `Failed step ${startStep.id} is not retryable`,
      run,
      state: run.state,
      currentStepId: startStep.id,
    };
  }
  if (startRecord?.approval?.state === "rejected") {
    return {
      ok: false,
      status: 409,
      error: `Cannot retry rejected approval step ${startStep.id}`,
      run,
      state: run.state,
      currentStepId: startStep.id,
    };
  }

  await appendControlledRunAuditEvent(run.id, {
    id: `controlled-run-retry:${run.id}:${startStep.id}:${Date.now()}`,
    type: "console_retry_requested",
    stepId: startStep.id,
    message: "Retry requested from Runtime Console",
    createdAt: Date.now(),
    actor: "local_user",
  });
  await updateControlledExecutionRun(run.id, {
    state: "running",
    currentStepId: startStep.id,
    error: undefined,
  });
  await updateControlledExecutionStep(run.id, startStep.id, {
    state: "pending",
    error: undefined,
  });

  const retryRun = (await getControlledExecutionRun(run.id)) ?? run;
  const initialStepResults = retryRun.steps
    .map(toStepResult)
    .filter((item): item is StepResult => Boolean(item));
  const approvedStepIds = retryRun.steps
    .filter((step) => step.approval?.state === "approved")
    .map((step) => step.stepId);
  const newlyStarted: string[] = [];
  const trace = await executeMultiStep(
    retryRun.plan,
    buildRequestFromRun(retryRun, "controlled-run-retry"),
    buildCallbacks(retryRun.id, newlyStarted),
    undefined,
    {
      initialStepResults,
      startStepIndex,
      approvedStepIds,
      pauseOnApprovalRequired: true,
      suppressPlanReady: true,
    },
  );
  const updatedRun = await getControlledExecutionRun(retryRun.id);
  if (!trace.success && updatedRun?.state === "failed") {
    return {
      ok: false,
      status: 409,
      error: trace.error ?? updatedRun.error ?? "Controlled run failed during retry",
      run: updatedRun,
      state: updatedRun.state,
      currentStepId: updatedRun.currentStepId,
    };
  }

  return {
    ok: true,
    status: 200,
    run: updatedRun ?? retryRun,
    retriedStepIds: newlyStarted.filter((stepId) => stepId === startStep.id),
  };
}
