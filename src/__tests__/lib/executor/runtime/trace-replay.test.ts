import { describe, expect, it } from "vitest";
import sampleFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";

const governedSampleFixture = sampleFixture as ControlledTraceFixture;

function cloneFixture(): ControlledTraceFixture {
  return structuredClone(governedSampleFixture);
}

describe("trace replay", () => {
  it("validates a committed governed sales fixture without executing side effects", () => {
    const report = replayControlledTraceFixture(governedSampleFixture);

    expect(report).toEqual({
      ok: true,
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      checkedStepIds: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
      errors: [],
      warnings: [],
      diagnostics: {
        fixtureId: "controlled-trace-fixture:run-fixture-1",
        playbookId: "sales-pipeline-v1",
        expectedStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
        fixtureStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
        expectedPlaybookVersion: "1.0.0",
        fixturePlaybookVersion: "1.0.0",
        expectedScenarioId: "sales-pipeline",
        fixtureScenarioId: "sales-pipeline",
        expectedPlanId: "playbook:sales-pipeline-v1:1.0.0",
        fixturePlanId: "playbook:sales-pipeline-v1:1.0.0",
        expectedPlanTotalSteps: 5,
        fixturePlanTotalSteps: 5,
        expectedPlanRequiresApproval: true,
        fixturePlanRequiresApproval: true,
        planStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
        missingApprovalStepIds: [],
        missingWritebackTargets: [],
        missingCompletedStepAttempts: [],
        nonApprovedApprovalStepIds: [],
        writebackTargetsMissingStableMetadata: [],
      },
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    });
  });

  it("rejects fixtures whose step order no longer matches the current playbook", () => {
    const fixture = cloneFixture();
    fixture.steps = [fixture.steps[1], fixture.steps[0], ...fixture.steps.slice(2)];
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Fixture step order does not match current playbook sales-pipeline-v1",
    );
    expect(report.diagnostics.expectedStepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(report.diagnostics.fixtureStepOrder).toEqual([
      "qualify",
      "intake",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
  });

  it("rejects fixtures whose playbook version drifts from the current playbook", () => {
    const fixture = cloneFixture();
    fixture.playbookVersion = "0.9.0";
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Fixture playbook version does not match current playbook sales-pipeline-v1",
    );
    expect(report.diagnostics.expectedPlaybookVersion).toBe("1.0.0");
    expect(report.diagnostics.fixturePlaybookVersion).toBe("0.9.0");
  });

  it("rejects fixtures whose plan metadata drifts from the current playbook", () => {
    const fixture = cloneFixture();
    if (fixture.plan) {
      fixture.plan.id = "playbook:sales-pipeline-v1:0.9.0";
      fixture.plan.totalSteps = 4;
      fixture.plan.requiresApproval = false;
    }
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Fixture plan id does not match current playbook sales-pipeline-v1",
    );
    expect(report.errors).toContain(
      "Fixture plan totalSteps does not match current playbook sales-pipeline-v1",
    );
    expect(report.errors).toContain(
      "Fixture plan requiresApproval does not match current playbook sales-pipeline-v1",
    );
    expect(report.diagnostics).toMatchObject({
      expectedPlanId: "playbook:sales-pipeline-v1:1.0.0",
      fixturePlanId: "playbook:sales-pipeline-v1:0.9.0",
      expectedPlanTotalSteps: 5,
      fixturePlanTotalSteps: 4,
      expectedPlanRequiresApproval: true,
      fixturePlanRequiresApproval: false,
    });
  });

  it("rejects completed fixture steps without recorded attempts", () => {
    const fixture = cloneFixture();
    const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
    if (writebackStep) writebackStep.attempts = 0;
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain("Step writeback completed with no recorded attempts");
    expect(report.diagnostics.missingCompletedStepAttempts).toContain("writeback");
  });

  it("rejects completed approval-gated steps without approved terminal state", () => {
    const fixture = cloneFixture();
    const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
    if (writebackStep) writebackStep.approvalState = "rejected";
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Step writeback requires approved terminal state but fixture approval state is rejected",
    );
    expect(report.diagnostics.nonApprovedApprovalStepIds).toContain("writeback");
  });

  it("rejects successful writeback targets missing stable metadata", () => {
    const fixture = cloneFixture();
    const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
    const salesTarget = writebackStep?.writebackTargets.find(
      (target) => target.target === "sales_asset",
    );
    if (salesTarget) delete salesTarget.sourceKey;
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
    );
    expect(report.diagnostics.writebackTargetsMissingStableMetadata).toContainEqual({
      stepId: "writeback",
      target: "sales_asset",
      missingFields: ["sourceKey"],
    });
  });

  it("rejects fixtures missing approval state for approval-gated playbook steps", () => {
    const fixture = cloneFixture();
    const reviewStep = fixture.steps.find((step) => step.stepId === "human_review");
    if (reviewStep) delete reviewStep.approvalState;
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Step human_review requires approval but fixture has no approval state",
    );
    expect(report.diagnostics.missingApprovalStepIds).toContain("human_review");
  });

  it("rejects fixtures missing expected writeback targets on the same step", () => {
    const fixture = cloneFixture();
    const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
    if (writebackStep) writebackStep.writebackTargets = [];
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Step writeback is missing writeback target sales_asset",
    );
    expect(report.diagnostics.missingWritebackTargets).toContainEqual({
      stepId: "writeback",
      target: "sales_asset",
    });
  });

  it("rejects fixtures for unregistered playbooks", () => {
    const fixture = cloneFixture();
    fixture.playbookId = "missing-playbook-v1";
    const report = replayControlledTraceFixture(fixture);

    expect(report.errors).toContain(
      "Controlled playbook missing-playbook-v1 is not registered",
    );
    expect(report.diagnostics).toMatchObject({
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "missing-playbook-v1",
      expectedStepOrder: [],
      fixtureStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
      fixturePlaybookVersion: "1.0.0",
      fixtureScenarioId: "sales-pipeline",
      fixturePlanId: "playbook:sales-pipeline-v1:1.0.0",
      fixturePlanTotalSteps: 5,
      fixturePlanRequiresApproval: true,
      planStepOrder: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
      missingApprovalStepIds: [],
      missingWritebackTargets: [],
      missingCompletedStepAttempts: [],
      nonApprovedApprovalStepIds: [],
      writebackTargetsMissingStableMetadata: [],
    });
  });
});
