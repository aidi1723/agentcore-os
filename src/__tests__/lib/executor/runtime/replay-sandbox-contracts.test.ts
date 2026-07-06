import { describe, expect, it } from "vitest";
import {
  buildNoSideEffectReplayResultArtifact,
  type ReplaySandboxContract,
  validateReplaySandboxContract,
} from "@/lib/executor/runtime/replay-sandbox-contracts";

function makeSafeContract(
  overrides: Partial<ReplaySandboxContract> = {},
): ReplaySandboxContract {
  return {
    replayId: "replay-1",
    sandboxId: "sandbox-1",
    mode: "contract_validation",
    input: {
      kind: "committed_fixture",
      sourceId: "controlled-trace-fixture:run-fixture-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      scenarioId: "sales-pipeline",
      generatedAt: 100,
      governanceMode: "fixture",
      redactionBoundary: "required",
    },
    credentialPolicy: {
      mode: "none",
    },
    approvalPolicy: {
      mode: "fixture_derived",
    },
    storePolicy: {
      mode: "fixture_only",
      requestedStores: [],
    },
    sideEffectPolicy: {
      allowedOutput: "replay_result_artifact",
      blocked: [],
    },
    ...overrides,
  };
}

describe("replay sandbox contracts", () => {
  it("accepts a no-side-effect replay sandbox contract", () => {
    const result = validateReplaySandboxContract(makeSafeContract());

    expect(result).toEqual({
      ok: true,
      errors: [],
      warnings: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
  });

  it("rejects raw controlled run input", () => {
    const result = validateReplaySandboxContract(
      makeSafeContract({
        input: {
          ...makeSafeContract().input,
          kind: "raw_controlled_run",
        },
      }),
    );

    expect(result.errors).toContain("Replay input raw_controlled_run is not allowed");
  });

  it("rejects live credentials, live approvals, production stores, and business asset writes", () => {
    const result = validateReplaySandboxContract(
      makeSafeContract({
        credentialPolicy: { mode: "live_api_key" },
        approvalPolicy: { mode: "live_operator" },
        storePolicy: {
          mode: "sandbox_snapshot",
          requestedStores: ["sales_asset_store"],
        },
        sideEffectPolicy: {
          allowedOutput: "replay_result_artifact",
          blocked: ["business_asset_write"],
        },
      }),
    );

    expect(result.errors).toEqual([
      "Live replay credential live_api_key is not allowed",
      "Replay approval mode live_operator is not allowed",
      "Replay store access sales_asset_store is not allowed",
      "Replay side effect business_asset_write is not allowed",
    ]);
    expect(result.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    });
  });

  it("builds a replay result artifact that cannot be confused with business output", () => {
    const contract = makeSafeContract();
    const artifact = buildNoSideEffectReplayResultArtifact(contract, {
      generatedAt: 200,
      diagnostics: ["contract accepted"],
    });

    expect(artifact).toEqual({
      schemaVersion: "replay-result-artifact/v1",
      replayId: "replay-1",
      sandboxId: "sandbox-1",
      mode: "contract_validation",
      status: "succeeded",
      source: contract.input,
      simulatedApprovals: [],
      blockedSideEffects: [],
      cursorEvents: [],
      diagnostics: ["contract accepted"],
      generatedAt: 200,
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    });
  });
});
