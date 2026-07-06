import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type ReplaySandboxCatalogSummaryOutput = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  failedItems: Array<{
    catalogId: string;
    fixtureId: string;
    playbookId: string;
    contractBuildOk: boolean;
    contractErrors: string[];
    artifactStatus: "succeeded" | "failed" | null;
    artifactDiagnostics: string[];
    errors: string[];
  }>;
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
    runtimeStoresMutated: false;
    productionCredentialsUsed: false;
  };
};

function runFailureHarness() {
  return spawnSync(
    "node",
    [
      "--import",
      "./scripts/register-ts-alias-loader.mjs",
      "./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("replay sandbox catalog report script", () => {
  it("prints parseable replay sandbox catalog health JSON", () => {
    const result = spawnSync("npm", ["run", "replay:sandbox:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: true,
      total: 2,
      passed: 2,
      failed: 0,
      fixtureIds: ["sales-pipeline-governed", "support-resolution-governed"],
      playbookIds: ["sales-pipeline-v1", "support-resolution-v1"],
      failedItems: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
  });

  it("exits non-zero with parseable failed replay sandbox JSON output", () => {
    const result = runFailureHarness();

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: false,
      total: 1,
      passed: 0,
      failed: 1,
      fixtureIds: ["sales-pipeline-replay-sandbox-broken-contract"],
      playbookIds: ["sales-pipeline-v1"],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
    expect(output.failedItems[0]).toMatchObject({
      catalogId: "sales-pipeline-replay-sandbox-broken-contract",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      contractBuildOk: false,
      artifactStatus: null,
      artifactDiagnostics: [],
    });
    expect(output.failedItems[0].contractErrors).toEqual([
      "Fixture sourceRunId is required",
      "Fixture playbookVersion is required",
      "Fixture redaction boundary is required",
      "Replay input playbookVersion is required",
      "Replay input redaction boundary is required",
    ]);
    expect(output.failedItems[0].errors).toEqual(
      output.failedItems[0].contractErrors,
    );
  });
});
