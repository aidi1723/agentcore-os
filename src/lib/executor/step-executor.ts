import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
  ExecutionPlan,
  ExecutionStep,
  GuardrailConfig,
  MultiStepTrace,
  StepResult,
  ToolCallResult,
} from "@/lib/executor/contracts";
import type { ControlledPlaybookSchema } from "@/lib/executor/playbooks/types";
import { getTool } from "@/lib/executor/tools";
import type { ToolContext } from "@/lib/executor/tools/registry";
import { executorLog } from "@/lib/executor/logger";
import { shouldRequireApproval } from "@/lib/executor/guardrails";
import { buildControlledStepInput } from "@/lib/executor/runtime/step-input";
import { validateControlledOutput } from "@/lib/executor/runtime/schema";
import {
  updateControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";

const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxTotalTokens: 50_000,
  maxSteps: 10,
  maxToolCallsPerStep: 5,
  maxDurationMs: 300_000,
  forbiddenTools: [],
  requireApprovalFor: ["file_write", "code_execute"],
};

function allDependenciesMet(step: ExecutionStep, results: StepResult[]): boolean {
  if (step.dependsOn.length === 0) return true;
  const completed = new Set(
    results.filter((r) => r.status === "completed").map((r) => r.stepId),
  );
  return step.dependsOn.every((dep) => completed.has(dep));
}

function hasToolLevelApprovalRequirement(step: ExecutionStep) {
  return step.toolCalls.some((toolSpec) => getTool(toolSpec.toolName)?.requiresApproval);
}

function mustAwaitApproval(step: ExecutionStep, config: GuardrailConfig, approvalMode: string) {
  const guardedTool = hasToolLevelApprovalRequirement(step);
  if (guardedTool) return true;
  return approvalMode === "each-review-step" && shouldRequireApproval(step, config);
}

async function executeSingleStep(
  step: ExecutionStep,
  request: AgentCoreTaskRequest,
  callbacks: ExecutionCallbacks,
  guardrails: GuardrailConfig,
  abortSignal?: AbortSignal,
): Promise<StepResult> {
  const start = Date.now();
  const toolCallResults: ToolCallResult[] = [];
  let totalTokens = 0;

  const ctx: ToolContext = {
    sessionId: request.session.id,
    requestId: request.metadata.requestId,
    baseUrl: request.executionPolicy?.baseUrl || process.env.AGENTCORE_BASE_URL,
    abortSignal,
  };

  for (const toolSpec of step.toolCalls.slice(0, guardrails.maxToolCallsPerStep)) {
    if (abortSignal?.aborted) break;

    const tool = getTool(toolSpec.toolName);
    if (!tool) {
      toolCallResults.push({
        toolName: toolSpec.toolName,
        success: false,
        output: null,
        durationMs: 0,
        sideEffects: [`Tool not found: ${toolSpec.toolName}`],
      });
      continue;
    }

    if (guardrails.forbiddenTools.includes(toolSpec.toolName)) {
      toolCallResults.push({
        toolName: toolSpec.toolName,
        success: false,
        output: null,
        durationMs: 0,
        sideEffects: [`Tool forbidden by guardrails: ${toolSpec.toolName}`],
      });
      continue;
    }

    callbacks.onStepProgress(step.id, {
      type: "tool_call_start",
      toolName: toolSpec.toolName,
    });

    const result = await tool.execute(
      {
        prompt: step.description,
        description: toolSpec.description,
        ...(toolSpec.params ?? {}),
      },
      ctx,
    );
    toolCallResults.push(result);

    callbacks.onStepProgress(step.id, {
      type: "tool_call_complete",
      toolName: toolSpec.toolName,
      success: result.success,
    });

    if (!result.success) break;
  }

  const allSucceeded = toolCallResults.length > 0
    ? toolCallResults.every((r) => r.success)
    : true;

  totalTokens = toolCallResults.reduce((sum, r) => sum + (r.tokensUsed ?? 0), 0);

  return {
    stepId: step.id,
    status: allSucceeded ? "completed" : "failed",
    output: toolCallResults[toolCallResults.length - 1]?.output ?? null,
    toolCallResults,
    tokensUsed: totalTokens,
    durationMs: Date.now() - start,
    error: allSucceeded ? undefined : toolCallResults.find((r) => !r.success)?.sideEffects?.[0],
  };
}

export async function executeMultiStep(
  plan: ExecutionPlan,
  request: AgentCoreTaskRequest,
  callbacks: ExecutionCallbacks,
  guardrails?: Partial<GuardrailConfig>,
): Promise<MultiStepTrace> {
  const config: GuardrailConfig = { ...DEFAULT_GUARDRAILS, ...guardrails };
  const executionStart = Date.now();
  const abortController = new AbortController();
  const reqId = request.metadata.requestId;
  const shouldPersistControlledTrace = Boolean(request.controlledPlaybookId);

  executorLog("info", "execution_start", { requestId: reqId, detail: `${plan.totalSteps} steps` });

  const trace: MultiStepTrace = {
    source: request.metadata.source,
    engine: "agentcore_executor",
    provider: request.modelConfig?.provider,
    model: request.modelConfig?.model,
    sessionId: request.session.id,
    requestId: request.metadata.requestId,
    idempotencyKey: request.metadata.idempotencyKey,
    startedAt: executionStart,
    finishedAt: 0,
    durationMs: 0,
    attemptCount: 0,
    fallbackUsed: false,
    attempts: [],
    skillReceipts: [],
    success: false,
    plan,
    stepResults: [],
    currentStepIndex: 0,
  };

  callbacks.onPlanReady(plan);

  let consecutiveFailures = 0;

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    trace.currentStepIndex = i;

    // Check time budget
    if (Date.now() - executionStart > config.maxDurationMs) {
      callbacks.onError("Execution time limit exceeded");
      break;
    }

    // Check dependencies
    if (!allDependenciesMet(step, trace.stepResults)) {
      trace.stepResults.push({
        stepId: step.id,
        status: "skipped",
        output: null,
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 0,
        error: "Dependencies not met",
      });
      continue;
    }

    // Human approval gate
    const approvalMode = request.controlledPlaybookId
      ? "each-review-step"
      : request.multiStep?.approvalMode ?? "each-review-step";
    if (mustAwaitApproval(step, config, approvalMode)) {
      callbacks.onAwaitingApproval(step);
      const approval = await callbacks.waitForApproval(step.id);
      if (!approval.approved) {
        const rejectedResult: StepResult = {
          stepId: step.id,
          status: "failed",
          output: null,
          toolCallResults: [],
          tokensUsed: 0,
          durationMs: 0,
          error: approval.feedback ?? "User rejected step",
        };
        trace.stepResults.push(rejectedResult);
        trace.error = rejectedResult.error;
        callbacks.onStepComplete(rejectedResult);
        callbacks.onError(rejectedResult.error ?? "User rejected step");
        break;
      }
    }

    // Execute step
    executorLog("info", "step_start", { requestId: reqId, stepId: step.id });
    callbacks.onStepStart(step, i);
    const stepInput = buildControlledStepInput({
      request,
      step,
      stepIndex: i,
      previousResults: trace.stepResults,
    });
    if (shouldPersistControlledTrace) {
      await updateControlledExecutionRun(reqId, {
        state: "running",
        currentStepId: step.id,
      }).catch(() => null);
      await updateControlledExecutionStep(reqId, step.id, {
        state: "running",
        input: stepInput,
      }).catch(() => null);
    }
    const result = await executeSingleStep(
      step,
      request,
      callbacks,
      config,
      abortController.signal,
    );
    if (result.status === "completed" && step.outputSchema) {
      const validation = validateControlledOutput(
        result.output,
        step.outputSchema as ControlledPlaybookSchema,
      );
      if (shouldPersistControlledTrace) {
        await updateControlledExecutionStep(reqId, step.id, {
          schemaValidation: { ...validation, checkedAt: Date.now() },
        }).catch(() => null);
      }
      if (!validation.valid) {
        result.status = "failed";
        result.error = validation.errors.join("; ");
      }
    }
    trace.stepResults.push(result);
    if (shouldPersistControlledTrace) {
      await updateControlledExecutionStep(reqId, step.id, {
        state: result.status,
        output: result.output,
        error: result.error,
        toolCallResults: result.toolCallResults,
      }).catch(() => null);
    }
    callbacks.onStepComplete(result);

    // Failure tracking
    if (result.status === "failed") {
      executorLog("warn", "step_failed", { requestId: reqId, stepId: step.id, detail: result.error, durationMs: result.durationMs });
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        executorLog("error", "execution_abort", { requestId: reqId, detail: "3 consecutive failures" });
        callbacks.onError("3 consecutive step failures — aborting execution");
        break;
      }
    } else {
      consecutiveFailures = 0;
    }

    trace.attemptCount++;
  }

  trace.finishedAt = Date.now();
  trace.durationMs = trace.finishedAt - trace.startedAt;
  trace.success = trace.stepResults.every(
    (r) => r.status === "completed" || r.status === "skipped",
  );
  if (!trace.success && !trace.error) {
    trace.error = trace.stepResults.find((result) => result.status === "failed")?.error;
  }

  if (shouldPersistControlledTrace) {
    await updateControlledExecutionRun(reqId, {
      state: trace.success ? "completed" : "failed",
      error: trace.error,
    }).catch(() => null);
  }

  executorLog("info", "execution_done", {
    requestId: reqId,
    durationMs: trace.durationMs,
    detail: `success=${trace.success} steps=${trace.stepResults.length}`,
  });

  return trace;
}
