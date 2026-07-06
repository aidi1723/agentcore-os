import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";
import {
  buildNoSideEffectReplayResultArtifact,
  type ReplayResultArtifact,
} from "@/lib/executor/runtime/replay-sandbox-contracts";

describe("replay sandbox catalog report", () => {
  it("builds an all-green replay sandbox report for committed governed fixtures", () => {
    const report = buildReplaySandboxCatalogReport();

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
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    });
    expect(report.items.map((item) => item.ok)).toEqual([true, true]);
    expect(report.items.map((item) => item.artifact?.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);
  });

  it("preserves per-item sandbox artifacts and simulated approval metadata", () => {
    const report = buildReplaySandboxCatalogReport();

    expect(report.items[0]).toMatchObject({
      catalogId: "sales-pipeline-governed",
      fixtureId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      ok: true,
      errors: [],
      artifact: {
        schemaVersion: "replay-result-artifact/v1",
        replayId: "replay:controlled-trace-fixture:run-fixture-1",
        sandboxId: "sandbox:controlled-trace-fixture:run-fixture-1",
        status: "succeeded",
        source: {
          kind: "committed_fixture",
          playbookId: "sales-pipeline-v1",
          redactionBoundary: "required",
        },
        simulatedApprovals: [
          {
            stepId: "human_review",
            decision: "approved",
          },
          {
            stepId: "writeback",
            decision: "approved",
          },
        ],
        cursorEvents: [
          "preflight",
          "load_source_metadata",
          "simulate_approvals",
          "block_side_effects",
          "emit_result_artifact",
        ],
        guarantees: {
          toolCallsExecuted: false,
          assetsWritten: false,
          runtimeStoresMutated: false,
          productionCredentialsUsed: false,
        },
      },
    });
    expect(report.items[0].contractBuild.ok).toBe(true);
  });

  it("returns a failed report when a fixture cannot build a sandbox contract", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.sourceRunId = "";
    fixture.playbookVersion = "";
    fixture.assertions.redactionBoundary = "optional" as "required";

    const report = buildReplaySandboxCatalogReport([
      {
        id: "sales-pipeline-broken-contract",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    expect(report.ok).toBe(false);
    expect(report.total).toBe(1);
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.fixtureIds).toEqual(["sales-pipeline-broken-contract"]);
    expect(report.playbookIds).toEqual(["sales-pipeline-v1"]);
    expect(report.items[0].ok).toBe(false);
    expect(report.items[0].artifact).toBeNull();
    expect(report.items[0].errors).toEqual([
      "Fixture sourceRunId is required",
      "Fixture playbookVersion is required",
      "Fixture redaction boundary is required",
      "Replay input playbookVersion is required",
      "Replay input redaction boundary is required",
    ]);
    expect(report.items[0].contractBuild.ok).toBe(false);
  });

  it("classifies contract build failures separately from sandbox failures", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.sourceRunId = "";
    fixture.playbookVersion = "";
    fixture.assertions.redactionBoundary = "optional" as "required";

    const report = buildReplaySandboxCatalogReport([
      {
        id: "sales-pipeline-contract-build-failure",
        playbookId: "sales-pipeline-v1",
        fixture,
      },
    ]);

    expect(report.items[0]).toMatchObject({
      ok: false,
      failureKind: "contract_build_failed",
      artifact: null,
      guaranteeErrors: [],
      errors: [
        "Fixture sourceRunId is required",
        "Fixture playbookVersion is required",
        "Fixture redaction boundary is required",
        "Replay input playbookVersion is required",
        "Replay input redaction boundary is required",
      ],
    });
  });

  it("classifies injected sandbox artifact failures", () => {
    const report = buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
      runSandbox: (contract) =>
        buildNoSideEffectReplayResultArtifact(contract, {
          status: "failed",
          cursorEvents: ["preflight"],
          diagnostics: ["Synthetic sandbox preflight rejection"],
        }),
    });

    expect(report.ok).toBe(false);
    expect(report.items[0]).toMatchObject({
      ok: false,
      failureKind: "sandbox_artifact_failed",
      errors: ["Synthetic sandbox preflight rejection"],
      guaranteeErrors: [],
      artifact: {
        status: "failed",
        diagnostics: ["Synthetic sandbox preflight rejection"],
      },
    });
  });

  it("classifies no-side-effect guarantee violations", () => {
    const report = buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
      runSandbox: (contract): ReplayResultArtifact => ({
        ...buildNoSideEffectReplayResultArtifact(contract, {
          status: "succeeded",
          diagnostics: ["Synthetic replay completed"],
        }),
        guarantees: {
          toolCallsExecuted: true as false,
          assetsWritten: false,
          runtimeStoresMutated: false,
          productionCredentialsUsed: false,
        },
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.items[0]).toMatchObject({
      ok: false,
      failureKind: "guarantee_violation",
      errors: ["Replay sandbox no-side-effect guarantees were not preserved"],
      guaranteeErrors: ["Replay sandbox no-side-effect guarantees were not preserved"],
      artifact: {
        status: "succeeded",
      },
    });
  });
});
