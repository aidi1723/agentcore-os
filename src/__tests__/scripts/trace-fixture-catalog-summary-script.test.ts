import { spawnSync } from "node:child_process";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { formatControlledTraceFixtureCatalogSummary } from "@/__tests__/fixtures/controlled-traces/catalog-summary";
import { describe, expect, it } from "vitest";

describe("trace fixture catalog summary script", () => {
  it("prints a human-readable all-green summary for committed governed fixtures", () => {
    const result = spawnSync("npm", ["run", "trace:fixtures:summary", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");
    expect(result.stdout).toContain("Governed trace fixture replay summary");
    expect(result.stdout).toContain("Status: OK");
    expect(result.stdout).toContain("Fixtures: 2 total, 2 passed, 0 failed");
    expect(result.stdout).toContain(
      "Catalog: sales-pipeline-governed, support-resolution-governed",
    );
    expect(result.stdout).toContain("Playbooks: sales-pipeline-v1, support-resolution-v1");
    expect(result.stdout).toContain(
      "Guarantees: toolCallsExecuted=false, assetsWritten=false",
    );
  });

  it("keeps the existing JSON fixture command parseable", () => {
    const result = spawnSync("npm", ["run", "trace:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");
    const output = JSON.parse(result.stdout) as { ok: boolean; total: number; failed: number };
    expect(output).toMatchObject({ ok: true, total: 2, failed: 0 });
  });

  it("renders failed fixture diagnostics without mutating committed fixtures", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.playbookVersion = "0.9.0";
    const writebackStep = fixture.steps.find((step) => step.stepId === "writeback");
    const salesTarget = writebackStep?.writebackTargets.find(
      (target) => target.target === "sales_asset",
    );
    if (salesTarget) delete salesTarget.sourceKey;

    const report = buildControlledTraceFixtureCatalogReport([
      {
        id: "sales-pipeline-drift",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    const summary = formatControlledTraceFixtureCatalogSummary(report);

    expect(summary).toContain("Status: FAILED");
    expect(summary).toContain("Fixtures: 1 total, 0 passed, 1 failed");
    expect(summary).toContain("Failed fixture: sales-pipeline-drift");
    expect(summary).toContain(
      "Fixture playbook version does not match current playbook sales-pipeline-v1",
    );
    expect(summary).toContain(
      "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
    );
    expect(summary).toContain("expectedPlaybookVersion: 1.0.0");
    expect(summary).toContain("fixturePlaybookVersion: 0.9.0");
    expect(summary).toContain(
      "writebackTargetsMissingStableMetadata: writeback:sales_asset missing sourceKey",
    );
  });
});
