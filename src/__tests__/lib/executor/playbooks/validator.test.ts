import { describe, expect, it } from "vitest";

import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import {
  validateControlledPlaybook,
  validateExecutionPlanAgainstPlaybook,
} from "@/lib/executor/playbooks/validator";

describe("validateExecutionPlanAgainstPlaybook", () => {
  it("accepts the plan generated from its playbook", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(plan, salesPipelinePlaybook);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects unknown steps", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: [
          ...plan.steps,
          {
            id: "surprise_step",
            title: "Unplanned action",
            description: "Should not run",
            toolCalls: [{ toolName: "llm_generate" }],
            dependsOn: [],
            mode: "auto",
          },
        ],
        totalSteps: plan.totalSteps + 1,
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unknown step: surprise_step");
  });

  it("rejects tools outside the step allowlist", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === "qualify"
            ? { ...step, toolCalls: [{ toolName: "code_execute" }] }
            : step,
        ),
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step qualify uses disallowed tool: code_execute");
  });

  it("rejects plans missing required playbook steps", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: plan.steps.filter((step) => step.id !== "human_review"),
        totalSteps: plan.totalSteps - 1,
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Plan step order must match playbook steps");
  });

  it("rejects duplicate plan step ids", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: [...plan.steps, plan.steps[0]],
        totalSteps: plan.totalSteps + 1,
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Duplicate plan step id: intake");
  });

  it("rejects plan step mode changes", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === "human_review" ? { ...step, mode: "assist" } : step,
        ),
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step human_review mode must be review");
  });

  it("rejects dependency tampering", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === "writeback" ? { ...step, dependsOn: [] } : step,
        ),
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step writeback dependsOn must be human_review");
  });

  it("returns validation errors for malformed plans instead of throwing", () => {
    expect(validateExecutionPlanAgainstPlaybook(null, salesPipelinePlaybook)).toEqual({
      valid: false,
      errors: ["Plan must be an object"],
    });

    expect(validateExecutionPlanAgainstPlaybook({ id: "bad" }, salesPipelinePlaybook)).toEqual({
      valid: false,
      errors: ["Plan steps must be an array"],
    });

    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const result = validateExecutionPlanAgainstPlaybook(
      {
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === "qualify" ? { ...step, toolCalls: null } : step,
        ),
      },
      salesPipelinePlaybook,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step qualify toolCalls must be an array");
  });

  it("rejects review and manual playbook steps without approval", () => {
    const invalidPlaybook = {
      ...salesPipelinePlaybook,
      steps: salesPipelinePlaybook.steps.map((step) =>
        step.id === "human_review" ? { ...step, requiresApproval: false } : step,
      ),
    };
    const result = validateControlledPlaybook(invalidPlaybook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step human_review must require approval");
  });

  it("rejects playbook toolCalls outside the allowed tool list", () => {
    const invalidPlaybook = {
      ...salesPipelinePlaybook,
      steps: salesPipelinePlaybook.steps.map((step) =>
        step.id === "qualify"
          ? { ...step, toolCalls: [{ toolName: "code_execute" }] }
          : step,
      ),
    };
    const result = validateControlledPlaybook(invalidPlaybook);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Step qualify declares disallowed toolCall: code_execute");
  });
});
