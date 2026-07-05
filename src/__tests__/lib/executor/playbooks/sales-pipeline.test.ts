import { describe, expect, it } from "vitest";

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
});
