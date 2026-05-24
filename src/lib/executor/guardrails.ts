import type { ExecutionPlan, ExecutionStep, GuardrailConfig, StepResult } from "./contracts";

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxTotalTokens: 50_000,
  maxSteps: 10,
  maxToolCallsPerStep: 5,
  maxDurationMs: 300_000,
  forbiddenTools: [],
  requireApprovalFor: ["file_write", "code_execute"],
};

export function validatePlan(
  plan: ExecutionPlan,
  config: GuardrailConfig,
): { valid: boolean; reason?: string } {
  if (plan.steps.length > config.maxSteps) {
    return { valid: false, reason: `Plan has ${plan.steps.length} steps, max is ${config.maxSteps}` };
  }

  for (const step of plan.steps) {
    if (step.toolCalls.length > config.maxToolCallsPerStep) {
      return {
        valid: false,
        reason: `Step "${step.id}" has ${step.toolCalls.length} tool calls, max is ${config.maxToolCallsPerStep}`,
      };
    }

    const forbidden = step.toolCalls.filter((tc) =>
      config.forbiddenTools.includes(tc.toolName),
    );
    if (forbidden.length > 0) {
      return {
        valid: false,
        reason: `Step "${step.id}" uses forbidden tools: ${forbidden.map((t) => t.toolName).join(", ")}`,
      };
    }
  }

  return { valid: true };
}

export function shouldRequireApproval(
  step: ExecutionStep,
  config: GuardrailConfig,
): boolean {
  if (step.mode === "review" || step.mode === "manual") return true;
  return step.toolCalls.some((tc) =>
    config.requireApprovalFor.includes(tc.toolName),
  );
}

export function checkTokenBudget(
  results: StepResult[],
  config: GuardrailConfig,
): { withinBudget: boolean; used: number; remaining: number } {
  const used = results.reduce((sum, r) => sum + r.tokensUsed, 0);
  return {
    withinBudget: used < config.maxTotalTokens,
    used,
    remaining: Math.max(0, config.maxTotalTokens - used),
  };
}

export function checkTimeBudget(
  startedAt: number,
  config: GuardrailConfig,
): { withinBudget: boolean; elapsedMs: number; remainingMs: number } {
  const elapsed = Date.now() - startedAt;
  return {
    withinBudget: elapsed < config.maxDurationMs,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, config.maxDurationMs - elapsed),
  };
}

export type RecoveryDecision = {
  canContinue: boolean;
  action: "retry" | "replan" | "abort";
  reason: string;
};

export function decideRecovery(
  consecutiveFailures: number,
  lastError?: string,
): RecoveryDecision {
  if (consecutiveFailures >= 3) {
    return {
      canContinue: false,
      action: "abort",
      reason: "3 consecutive failures — aborting",
    };
  }

  const isRetryable =
    lastError?.includes("timeout") ||
    lastError?.includes("ECONNREFUSED") ||
    lastError?.includes("503") ||
    lastError?.includes("429");

  if (isRetryable && consecutiveFailures <= 2) {
    return {
      canContinue: true,
      action: "retry",
      reason: `Retryable error (attempt ${consecutiveFailures}): ${lastError}`,
    };
  }

  if (consecutiveFailures === 1) {
    return {
      canContinue: true,
      action: "replan",
      reason: `Non-retryable failure, attempting replan: ${lastError}`,
    };
  }

  return {
    canContinue: false,
    action: "abort",
    reason: `Repeated non-retryable failure: ${lastError}`,
  };
}
