import { describe, it, expect } from "vitest";
import {
  validatePlan,
  shouldRequireApproval,
  checkTokenBudget,
  checkTimeBudget,
  decideRecovery,
  DEFAULT_GUARDRAILS,
} from "@/lib/executor/guardrails";
import type { ExecutionPlan, ExecutionStep, StepResult } from "@/lib/executor/contracts";

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: "step_1",
    title: "Test step",
    description: "desc",
    toolCalls: [],
    dependsOn: [],
    mode: "auto",
    ...overrides,
  };
}

function makePlan(steps: ExecutionStep[]): ExecutionPlan {
  return {
    id: "plan_test",
    goal: "test",
    steps,
    totalSteps: steps.length,
    requiresApproval: false,
  };
}

describe("guardrails", () => {
  describe("validatePlan", () => {
    it("accepts a valid plan", () => {
      const plan = makePlan([makeStep()]);
      expect(validatePlan(plan, DEFAULT_GUARDRAILS).valid).toBe(true);
    });

    it("rejects plan exceeding maxSteps", () => {
      const steps = Array.from({ length: 15 }, (_, i) => makeStep({ id: `s${i}` }));
      const plan = makePlan(steps);
      const result = validatePlan(plan, { ...DEFAULT_GUARDRAILS, maxSteps: 5 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("15 steps");
    });

    it("rejects step with forbidden tools", () => {
      const step = makeStep({
        toolCalls: [{ toolName: "dangerous_tool" }],
      });
      const plan = makePlan([step]);
      const result = validatePlan(plan, {
        ...DEFAULT_GUARDRAILS,
        forbiddenTools: ["dangerous_tool"],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("dangerous_tool");
    });

    it("rejects step exceeding maxToolCallsPerStep", () => {
      const step = makeStep({
        toolCalls: Array.from({ length: 10 }, (_, i) => ({ toolName: `t${i}` })),
      });
      const plan = makePlan([step]);
      const result = validatePlan(plan, { ...DEFAULT_GUARDRAILS, maxToolCallsPerStep: 3 });
      expect(result.valid).toBe(false);
    });
  });

  describe("shouldRequireApproval", () => {
    it("returns true for review mode", () => {
      expect(shouldRequireApproval(makeStep({ mode: "review" }), DEFAULT_GUARDRAILS)).toBe(true);
    });

    it("returns true for manual mode", () => {
      expect(shouldRequireApproval(makeStep({ mode: "manual" }), DEFAULT_GUARDRAILS)).toBe(true);
    });

    it("returns true when tool is in requireApprovalFor", () => {
      const step = makeStep({ toolCalls: [{ toolName: "file_write" }] });
      expect(shouldRequireApproval(step, DEFAULT_GUARDRAILS)).toBe(true);
    });

    it("returns false for auto mode with safe tools", () => {
      const step = makeStep({ toolCalls: [{ toolName: "llm_generate" }] });
      expect(shouldRequireApproval(step, DEFAULT_GUARDRAILS)).toBe(false);
    });
  });

  describe("checkTokenBudget", () => {
    it("reports within budget", () => {
      const results: StepResult[] = [
        { stepId: "s1", status: "completed", output: null, toolCallResults: [], tokensUsed: 1000, durationMs: 100 },
      ];
      const check = checkTokenBudget(results, DEFAULT_GUARDRAILS);
      expect(check.withinBudget).toBe(true);
      expect(check.used).toBe(1000);
    });

    it("reports over budget", () => {
      const results: StepResult[] = [
        { stepId: "s1", status: "completed", output: null, toolCallResults: [], tokensUsed: 60000, durationMs: 100 },
      ];
      const check = checkTokenBudget(results, DEFAULT_GUARDRAILS);
      expect(check.withinBudget).toBe(false);
    });
  });

  describe("checkTimeBudget", () => {
    it("reports within budget for recent start", () => {
      const check = checkTimeBudget(Date.now() - 1000, DEFAULT_GUARDRAILS);
      expect(check.withinBudget).toBe(true);
    });

    it("reports over budget for old start", () => {
      const check = checkTimeBudget(Date.now() - 400_000, DEFAULT_GUARDRAILS);
      expect(check.withinBudget).toBe(false);
    });
  });

  describe("decideRecovery", () => {
    it("aborts after 3 consecutive failures", () => {
      const decision = decideRecovery(3);
      expect(decision.canContinue).toBe(false);
      expect(decision.action).toBe("abort");
    });

    it("retries on timeout error", () => {
      const decision = decideRecovery(1, "request timeout");
      expect(decision.canContinue).toBe(true);
      expect(decision.action).toBe("retry");
    });

    it("replans on non-retryable first failure", () => {
      const decision = decideRecovery(1, "invalid input");
      expect(decision.canContinue).toBe(true);
      expect(decision.action).toBe("replan");
    });
  });
});
