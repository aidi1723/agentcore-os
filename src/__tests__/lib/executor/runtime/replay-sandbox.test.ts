import { describe, expect, it } from "vitest";
import { runNoSideEffectReplaySandbox } from "@/lib/executor/runtime/replay-sandbox";
import type { ReplaySandboxContract } from "@/lib/executor/runtime/replay-sandbox-contracts";

function makeContract(
  overrides: Partial<ReplaySandboxContract> = {},
): ReplaySandboxContract {
  return {
    replayId: "replay-prototype-1",
    sandboxId: "sandbox-prototype-1",
    mode: "no_side_effect_prototype",
    input: {
      kind: "committed_fixture",
      sourceId: "controlled-trace-fixture:sales-pipeline-governed",
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
      mode: "simulated",
      simulatedDecisions: [
        {
          stepId: "human_review",
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
    ...overrides,
  };
}

describe("no-side-effect replay sandbox", () => {
  it("returns a failure artifact when preflight validation rejects the contract", () => {
    const artifact = runNoSideEffectReplaySandbox(
      makeContract({
        input: {
          ...makeContract().input,
          kind: "raw_controlled_run",
        },
        credentialPolicy: {
          mode: "live_api_key",
        },
      }),
    );

    expect(artifact.status).toBe("failed");
    expect(artifact.cursorEvents).toEqual(["preflight"]);
    expect(artifact.diagnostics).toEqual([
      "Replay input raw_controlled_run is not allowed",
      "Live replay credential live_api_key is not allowed",
    ]);
    expect(artifact.guarantees).toEqual({
      toolCallsExecuted: false,
      assetsWritten: false,
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    });
  });

  it("emits a replay-local result artifact for a safe contract", () => {
    const artifact = runNoSideEffectReplaySandbox(makeContract());

    expect(artifact).toMatchObject({
      schemaVersion: "replay-result-artifact/v1",
      replayId: "replay-prototype-1",
      sandboxId: "sandbox-prototype-1",
      mode: "no_side_effect_prototype",
      status: "succeeded",
      source: makeContract().input,
      simulatedApprovals: [
        {
          stepId: "human_review",
          decision: "approved",
        },
      ],
      blockedSideEffects: [],
      diagnostics: ["Replay sandbox preflight accepted"],
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
    });
    expect(artifact.generatedAt).toEqual(expect.any(Number));
  });

  it("does not shape the artifact like a controlled run or business asset", () => {
    const artifact = runNoSideEffectReplaySandbox(makeContract());

    expect(artifact).not.toHaveProperty("steps");
    expect(artifact).not.toHaveProperty("state");
    expect(artifact).not.toHaveProperty("writebackReceipts");
    expect(artifact).not.toHaveProperty("assetId");
    expect(artifact).not.toHaveProperty("workflowRunId");
  });
});
