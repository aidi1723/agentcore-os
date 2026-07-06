import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function runHarness(format: string) {
  return spawnSync(
    "node",
    [
      "--import",
      "./scripts/register-ts-alias-loader.mjs",
      "./scripts/trace-fixtures/catalog-failure-harness.mjs",
      "--format",
      format,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("trace fixture catalog failure harness script", () => {
  it("exits non-zero with parseable failed JSON output", () => {
    const result = runHarness("json");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      total: number;
      passed: number;
      failed: number;
      fixtureIds: string[];
      failedItems: Array<{
        catalogId: string;
        replayErrors: string[];
        diagnostics: {
          expectedPlaybookVersion?: string;
          fixturePlaybookVersion: string;
          writebackTargetsMissingStableMetadata: Array<{
            stepId: string;
            target: string;
            missingFields: string[];
          }>;
        };
      }>;
      guarantees: {
        toolCallsExecuted: false;
        assetsWritten: false;
      };
    };

    expect(output).toMatchObject({
      ok: false,
      total: 1,
      passed: 0,
      failed: 1,
      fixtureIds: ["sales-pipeline-summary-drift"],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    });
    expect(output.failedItems[0].catalogId).toBe("sales-pipeline-summary-drift");
    expect(output.failedItems[0].replayErrors).toContain(
      "Fixture playbook version does not match current playbook sales-pipeline-v1",
    );
    expect(output.failedItems[0].replayErrors).toContain(
      "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
    );
    expect(output.failedItems[0].diagnostics).toMatchObject({
      expectedPlaybookVersion: "1.0.0",
      fixturePlaybookVersion: "0.9.0",
    });
    expect(
      output.failedItems[0].diagnostics.writebackTargetsMissingStableMetadata,
    ).toContainEqual({
      stepId: "writeback",
      target: "sales_asset",
      missingFields: ["sourceKey"],
    });
  });

  it("exits non-zero with failed human-readable summary output", () => {
    const result = runHarness("summary");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");
    expect(result.stdout).toContain("Status: FAILED");
    expect(result.stdout).toContain("Fixtures: 1 total, 0 passed, 1 failed");
    expect(result.stdout).toContain("Failed fixture: sales-pipeline-summary-drift");
    expect(result.stdout).toContain(
      "Fixture playbook version does not match current playbook sales-pipeline-v1",
    );
    expect(result.stdout).toContain(
      "Step writeback writeback target sales_asset is missing stable metadata sourceKey",
    );
  });

  it("exits non-zero with stable usage text for unknown formats", () => {
    const result = runHarness("xml");

    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe("");
    expect(result.stderr.trim()).toBe(
      "Usage: catalog-failure-harness.mjs --format json|summary",
    );
  });

  it("keeps committed fixture commands green", () => {
    const jsonResult = spawnSync("npm", ["run", "trace:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const summaryResult = spawnSync("npm", ["run", "trace:fixtures:summary", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(jsonResult.status).toBe(0);
    expect(jsonResult.stderr.trim()).toBe("");
    expect(JSON.parse(jsonResult.stdout)).toMatchObject({
      ok: true,
      total: 2,
      failed: 0,
    });

    expect(summaryResult.status).toBe(0);
    expect(summaryResult.stderr.trim()).toBe("");
    expect(summaryResult.stdout).toContain("Status: OK");
  });
});
