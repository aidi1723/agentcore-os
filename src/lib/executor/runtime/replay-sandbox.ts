import {
  buildNoSideEffectReplayResultArtifact,
  type ReplayResultArtifact,
  type ReplaySandboxContract,
  type ReplaySandboxCursorEvent,
  validateReplaySandboxContract,
} from "@/lib/executor/runtime/replay-sandbox-contracts";

const successfulReplayCursorEvents: ReplaySandboxCursorEvent[] = [
  "preflight",
  "load_source_metadata",
  "simulate_approvals",
  "block_side_effects",
  "emit_result_artifact",
];

export function runNoSideEffectReplaySandbox(
  contract: ReplaySandboxContract,
): ReplayResultArtifact {
  const validation = validateReplaySandboxContract(contract);

  if (!validation.ok) {
    return buildNoSideEffectReplayResultArtifact(contract, {
      status: "failed",
      cursorEvents: ["preflight"],
      diagnostics: validation.errors,
    });
  }

  return buildNoSideEffectReplayResultArtifact(contract, {
    status: "succeeded",
    cursorEvents: successfulReplayCursorEvents,
    diagnostics: ["Replay sandbox preflight accepted"],
  });
}
