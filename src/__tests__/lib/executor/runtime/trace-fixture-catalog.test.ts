import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { validateControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";

describe("controlled trace fixture catalog", () => {
  it("lists sales and support governed fixtures", () => {
    expect(controlledTraceFixtureCatalog.map((entry) => entry.id)).toEqual([
      "sales-pipeline-governed",
      "support-resolution-governed",
    ]);
  });

  it("validates and replays every committed governed fixture", () => {
    for (const entry of controlledTraceFixtureCatalog) {
      expect(entry.fixture.playbookId).toBe(entry.playbookId);
      expect(validateControlledTraceFixture(entry.fixture)).toEqual({ ok: true, errors: [] });

      const replay = replayControlledTraceFixture(entry.fixture);
      expect(replay.errors).toEqual([]);
      expect(replay.ok).toBe(true);
      expect(replay.guarantees).toEqual({
        toolCallsExecuted: false,
        assetsWritten: false,
      });
    }
  });

  it("builds an all-green aggregate report for committed governed fixtures", () => {
    const report = buildControlledTraceFixtureCatalogReport();

    expect(report.ok).toBe(true);
    expect(report.total).toBe(2);
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.fixtureIds).toEqual([
      "sales-pipeline-governed",
      "support-resolution-governed",
    ]);
    expect(report.playbookIds).toEqual(["sales-pipeline-v1", "support-resolution-v1"]);
    expect(report.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
    });
    expect(report.items.map((item) => item.ok)).toEqual([true, true]);
    expect(report.items[0].replay.diagnostics.fixtureStepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
  });

  it("preserves replay diagnostics for a drifting catalog fixture", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.steps = [fixture.steps[1], fixture.steps[0], ...fixture.steps.slice(2)];
    const fixtureStepOrder = fixture.steps.map((step) => step.stepId);
    fixture.assertions.stepOrder = fixtureStepOrder;
    fixture.assertions.knownPlaybookMatched = false;
    if (fixture.plan) fixture.plan.stepOrder = fixtureStepOrder;

    const report = buildControlledTraceFixtureCatalogReport([
      {
        id: "sales-pipeline-drift",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.total).toBe(1);
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.fixtureIds).toEqual(["sales-pipeline-drift"]);
    expect(report.playbookIds).toEqual(["sales-pipeline-v1"]);
    expect(report.items[0].ok).toBe(false);
    expect(report.items[0].validation).toEqual({ ok: true, errors: [] });
    expect(report.items[0].replay.errors).toContain(
      "Fixture step order does not match current playbook sales-pipeline-v1",
    );
    expect(report.items[0].replay.diagnostics.expectedStepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(report.items[0].replay.diagnostics.fixtureStepOrder).toEqual([
      "qualify",
      "intake",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(report.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
    });
  });

  it("does not include raw customer content or secret markers", () => {
    const serialized = JSON.stringify(controlledTraceFixtureCatalog);

    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-fixture-secret");
    expect(serialized).not.toContain("refund my order");
    expect(serialized).not.toContain("Bearer ");
  });
});
