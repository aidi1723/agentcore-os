import { describe, expect, it } from "vitest";

import {
  getControlledPlaybook,
  getControlledPlaybookForScenario,
} from "@/lib/executor/playbooks/catalog";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";

describe("supportResolutionPlaybook", () => {
  it("defines the stable support controlled runtime workflow", () => {
    expect(supportResolutionPlaybook.id).toBe("support-resolution-v1");
    expect(supportResolutionPlaybook.scenarioId).toBe("support-ops");
    expect(supportResolutionPlaybook.resultAssets).toEqual([
      "support_asset",
      "knowledge_asset",
      "draft",
      "workflow_run",
    ]);
    expect(supportResolutionPlaybook.steps.map((step) => step.id)).toEqual([
      "intake",
      "classify",
      "draft_reply",
      "human_review",
      "writeback",
    ]);
  });

  it("registers in the controlled playbook catalog", () => {
    expect(getControlledPlaybook("support-resolution-v1")).toBe(supportResolutionPlaybook);
    expect(getControlledPlaybookForScenario("support-ops")).toBe(supportResolutionPlaybook);
  });

  it("keeps review and manual stages behind approval", () => {
    const approvalSteps = supportResolutionPlaybook.steps.filter((step) => step.requiresApproval);
    expect(approvalSteps.map((step) => step.id)).toEqual(["human_review", "writeback"]);
    expect(
      supportResolutionPlaybook.steps
        .filter((step) => step.mode === "review" || step.mode === "manual")
        .every((step) => step.requiresApproval),
    ).toBe(true);
  });

  it("declares schemas and allowed tools for every step", () => {
    for (const step of supportResolutionPlaybook.steps) {
      expect(step.inputSchema).toMatchObject({ type: "object" });
      expect(step.outputSchema).toMatchObject({ type: "object" });
      expect(step.allowedTools.length).toBeGreaterThan(0);
      expect(step.acceptanceCriteria.length).toBeGreaterThan(0);
    }
  });

  it("converts the playbook into a deterministic execution plan", () => {
    const plan = resolveExecutionPlanFromPlaybook(supportResolutionPlaybook);

    expect(plan.goal).toBe("Support Resolution Controlled Runtime");
    expect(plan.totalSteps).toBe(5);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "classify",
      "draft_reply",
      "human_review",
      "writeback",
    ]);
    expect(plan.steps[1].dependsOn).toEqual(["intake"]);
    expect(plan.steps[3].mode).toBe("review");
    expect(plan.steps[4].mode).toBe("manual");
  });
});
