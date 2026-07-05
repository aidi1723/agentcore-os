import { describe, expect, it } from "vitest";

import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";

describe("salesPipelinePlaybook", () => {
  it("defines the stable first controlled runtime workflow", () => {
    expect(salesPipelinePlaybook.id).toBe("sales-pipeline-v1");
    expect(salesPipelinePlaybook.scenarioId).toBe("sales-pipeline");
    expect(salesPipelinePlaybook.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
  });

  it("keeps review and manual stages behind approval", () => {
    const approvalSteps = salesPipelinePlaybook.steps.filter((step) => step.requiresApproval);
    expect(approvalSteps.map((step) => step.id)).toEqual(["human_review", "writeback"]);
    expect(
      salesPipelinePlaybook.steps
        .filter((step) => step.mode === "review" || step.mode === "manual")
        .every((step) => step.requiresApproval),
    ).toBe(true);
  });

  it("declares schemas and allowed tools for every step", () => {
    for (const step of salesPipelinePlaybook.steps) {
      expect(step.inputSchema).toMatchObject({ type: "object" });
      expect(step.outputSchema).toMatchObject({ type: "object" });
      expect(step.allowedTools.length).toBeGreaterThan(0);
      expect(step.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });

  it("converts the playbook into a deterministic execution plan", () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);

    expect(plan.goal).toBe("Sales Pipeline Controlled Runtime");
    expect(plan.totalSteps).toBe(5);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(plan.steps[1].dependsOn).toEqual(["intake"]);
    expect(plan.steps[3].mode).toBe("review");
    expect(plan.steps[4].mode).toBe("manual");
  });
});
