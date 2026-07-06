import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxContractFromFixture } from "@/lib/executor/runtime/replay-sandbox-fixture-contract";
import { runNoSideEffectReplaySandbox } from "@/lib/executor/runtime/replay-sandbox";

describe("replay sandbox fixture contract bridge", () => {
  it("converts a governed sales fixture into a valid replay sandbox contract", () => {
    const fixture = controlledTraceFixtureCatalog[0].fixture;
    const result = buildReplaySandboxContractFromFixture(fixture, {
      replayId: "replay-sales-fixture",
      sandboxId: "sandbox-sales-fixture",
    });

    expect(result).toEqual({
      ok: true,
      errors: [],
      contract: {
        replayId: "replay-sales-fixture",
        sandboxId: "sandbox-sales-fixture",
        mode: "no_side_effect_prototype",
        input: {
          kind: "committed_fixture",
          sourceId: "controlled-trace-fixture:run-fixture-1",
          playbookId: "sales-pipeline-v1",
          playbookVersion: "1.0.0",
          scenarioId: "sales-pipeline",
          generatedAt: 300,
          governanceMode: "fixture",
          redactionBoundary: "required",
        },
        credentialPolicy: {
          mode: "fixture",
        },
        approvalPolicy: {
          mode: "fixture_derived",
          simulatedDecisions: [
            {
              stepId: "human_review",
              decision: "approved",
            },
            {
              stepId: "writeback",
              decision: "approved",
            },
          ],
        },
        storePolicy: {
          mode: "fixture_only",
          requestedStores: [],
        },
        sideEffectPolicy: {
          allowedOutput: "replay_result_artifact",
          blocked: [],
        },
      },
    });
  });

  it("builds sandbox-accepted contracts from every committed governed fixture", () => {
    const artifacts = controlledTraceFixtureCatalog.map((entry) => {
      const result = buildReplaySandboxContractFromFixture(entry.fixture);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.errors.join("; "));

      return runNoSideEffectReplaySandbox(result.contract);
    });

    expect(artifacts.map((artifact) => artifact.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);
    expect(artifacts.map((artifact) => artifact.source.playbookId)).toEqual([
      "sales-pipeline-v1",
      "support-resolution-v1",
    ]);
    for (const artifact of artifacts) {
      expect(artifact.guarantees).toEqual({
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      });
    }
  });

  it("rejects broken fixture provenance and redaction boundaries", () => {
    const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
    fixture.sourceRunId = "";
    fixture.playbookVersion = "";
    fixture.assertions.redactionBoundary = "optional" as "required";

    const result = buildReplaySandboxContractFromFixture(fixture);

    expect(result).toEqual({
      ok: false,
      errors: [
        "Fixture sourceRunId is required",
        "Fixture playbookVersion is required",
        "Fixture redaction boundary is required",
        "Replay input playbookVersion is required",
        "Replay input redaction boundary is required",
      ],
    });
  });
});
