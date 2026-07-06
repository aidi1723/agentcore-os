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
    failureKind:
      | "contract_build_failed"
      | "sandbox_artifact_failed"
      | "guarantee_violation";
    contractBuildOk: boolean;
    contractErrors: string[];
    artifactStatus: "succeeded" | "failed" | null;
    artifactDiagnostics: string[];
    guaranteeErrors: string[];
    errors: string[];
  }>;
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
    runtimeStoresMutated: false;
    productionCredentialsUsed: false;
  };
};

function runFailureHarness(mode?: string) {
  return spawnSync(
    "node",
    [
      "--import",
      "./scripts/register-ts-alias-loader.mjs",
      "./scripts/trace-fixtures/replay-sandbox-failure-harness.mjs",
      ...(mode ? [mode] : []),
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

  it("defaults to contract failure mode with parseable failed replay sandbox JSON output", () => {
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
      failureKind: "contract_build_failed",
      contractBuildOk: false,
      artifactStatus: null,
      artifactDiagnostics: [],
      guaranteeErrors: [],
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

  it("supports explicit contract failure mode", () => {
    const result = runFailureHarness("contract");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output.failedItems[0]).toMatchObject({
      failureKind: "contract_build_failed",
      contractBuildOk: false,
      artifactStatus: null,
      guaranteeErrors: [],
    });
  });

  it("supports sandbox artifact failure mode", () => {
    const result = runFailureHarness("sandbox");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: false,
      total: 1,
      passed: 0,
      failed: 1,
      fixtureIds: ["sales-pipeline-governed"],
      playbookIds: ["sales-pipeline-v1"],
    });
    expect(output.failedItems[0]).toMatchObject({
      catalogId: "sales-pipeline-governed",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      failureKind: "sandbox_artifact_failed",
      contractBuildOk: true,
      artifactStatus: "failed",
      artifactDiagnostics: ["Synthetic sandbox preflight rejection"],
      guaranteeErrors: [],
      errors: ["Synthetic sandbox preflight rejection"],
    });
  });

  it("supports guarantee violation failure mode", () => {
    const result = runFailureHarness("guarantee");

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as ReplaySandboxCatalogSummaryOutput;
    expect(output.failedItems[0]).toMatchObject({
      catalogId: "sales-pipeline-governed",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      failureKind: "guarantee_violation",
      contractBuildOk: true,
      artifactStatus: "succeeded",
      artifactDiagnostics: ["Synthetic replay completed"],
      guaranteeErrors: ["Replay sandbox no-side-effect guarantees were not preserved"],
      errors: ["Replay sandbox no-side-effect guarantees were not preserved"],
    });
  });

  it("rejects unknown failure harness modes without report JSON", () => {
    const result = runFailureHarness("unknown");

    expect(result.status).toBe(2);
    expect(result.stdout.trim()).toBe("");
    expect(result.stderr.trim()).toBe(
      "Unsupported replay sandbox failure harness mode: unknown. Supported modes: contract, sandbox, guarantee.",
    );
  });
});
