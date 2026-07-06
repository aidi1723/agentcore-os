import { describe, expect, it } from "vitest";
import sampleFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";

function cloneFixture(): ControlledTraceFixture {
  return structuredClone(sampleFixture) as ControlledTraceFixture;
}

describe("trace replay", () => {
  it("validates a committed governed sales fixture without executing side effects", () => {
    const report = replayControlledTraceFixture(sampleFixture);

    expect(report).toEqual({
      ok: true,
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      checkedStepIds: ["intake", "qualify", "draft_outreach", "human_review", "writeback"],
      errors: [],
      warnings: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    });
  });

  it("rejects fixtures whose step order no longer matches the current playbook", () => {
    const fixture = cloneFixture();
    fixture.steps = [fixture.steps[1], fixture.steps[0], ...fixture.steps.slice(2)];

    expect(replayControlledTraceFixture(fixture).errors).toContain(
      "Fixture step order does not match current playbook sales-pipeline-v1",
    );
  });

  it("rejects fixtures missing approval state for approval-gated playbook steps", () => {
    const fixture = cloneFixture();
    const reviewStep = fixture.steps.find((step) => step.stepId === "human_review");
    if (reviewStep) delete reviewStep.approvalState;

    expect(replayControlledTraceFixture(fixture).errors).toContain(
      "Step human_review requires approval but fixture has no approval state",
    );
  });

  it("rejects fixtures missing expected writeback targets on the same step", () => {
    const fixture = cloneFixture();
    const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
    if (writebackStep) writebackStep.writebackTargets = [];

    expect(replayControlledTraceFixture(fixture).errors).toContain(
      "Step writeback is missing writeback target sales_asset",
    );
  });

  it("rejects fixtures for unregistered playbooks", () => {
    const fixture = cloneFixture();
    fixture.playbookId = "missing-playbook-v1";

    expect(replayControlledTraceFixture(fixture).errors).toContain(
      "Controlled playbook missing-playbook-v1 is not registered",
    );
  });
});
