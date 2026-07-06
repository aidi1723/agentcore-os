import type { ControlledTraceGovernanceMode } from "@/lib/executor/runtime/trace-governance";

export type ReplayInputKind =
  | "governed_artifact"
  | "committed_fixture"
  | "sandbox_snapshot"
  | "raw_controlled_run";

export type ReplayCredentialMode =
  | "none"
  | "fake"
  | "fixture"
  | "replay_scoped"
  | "live_api_key"
  | "bearer_token"
  | "connector_credential"
  | "user_session"
  | "production_account"
  | "ambient";

export type ReplayApprovalMode =
  | "fixture_derived"
  | "simulated"
  | "require_record_only"
  | "live_operator"
  | "production_approval_store";

export type ReplayStoreMode = "none" | "sandbox_snapshot" | "fixture_only";

export type ReplayStoreAccess =
  | "controlled_run_store"
  | "approval_store"
  | "workflow_run_store"
  | "draft_store"
  | "sales_asset_store"
  | "support_asset_store"
  | "knowledge_asset_store";

export type ReplaySideEffect =
  | "llm_call"
  | "tool_execution"
  | "api_route_call"
  | "connector_call"
  | "webhook"
  | "email"
  | "notification"
  | "runtime_store_write"
  | "business_asset_write"
  | "file_write_outside_replay_artifact";

export type ReplaySandboxCursorEvent =
  | "preflight"
  | "load_source_metadata"
  | "simulate_approvals"
  | "block_side_effects"
  | "emit_result_artifact";

export type ReplayResultArtifactStatus = "succeeded" | "failed";

export type ReplaySandboxContract = {
  replayId: string;
  sandboxId: string;
  mode: "contract_validation" | "no_side_effect_prototype";
  input: {
    kind: ReplayInputKind;
    sourceId: string;
    playbookId: string;
    playbookVersion: string;
    scenarioId: string;
    generatedAt: number;
    governanceMode: ControlledTraceGovernanceMode;
    redactionBoundary: "required";
  };
  credentialPolicy: {
    mode: ReplayCredentialMode;
  };
  approvalPolicy: {
    mode: ReplayApprovalMode;
    simulatedDecisions?: Array<{
      stepId: string;
      decision: "approved" | "rejected" | "not_required";
    }>;
  };
  storePolicy: {
    mode: ReplayStoreMode;
    requestedStores: ReplayStoreAccess[];
  };
  sideEffectPolicy: {
    allowedOutput: "replay_result_artifact";
    blocked: ReplaySideEffect[];
  };
};

export type ReplaySandboxGuarantees = {
  toolCallsExecuted: false;
  assetsWritten: false;
  runtimeStoresMutated: false;
  productionCredentialsUsed: false;
};

export type ReplaySandboxContractValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  guarantees: ReplaySandboxGuarantees;
};

export type ReplayResultArtifact = {
  schemaVersion: "replay-result-artifact/v1";
  replayId: string;
  sandboxId: string;
  mode: ReplaySandboxContract["mode"];
  status: ReplayResultArtifactStatus;
  source: ReplaySandboxContract["input"];
  simulatedApprovals: NonNullable<
    ReplaySandboxContract["approvalPolicy"]["simulatedDecisions"]
  >;
  blockedSideEffects: ReplaySideEffect[];
  cursorEvents: ReplaySandboxCursorEvent[];
  diagnostics: string[];
  generatedAt: number;
  guarantees: ReplaySandboxGuarantees;
};

const replaySandboxGuarantees: ReplaySandboxGuarantees = {
  toolCallsExecuted: false,
  assetsWritten: false,
  runtimeStoresMutated: false,
  productionCredentialsUsed: false,
};

const forbiddenCredentialModes: ReplayCredentialMode[] = [
  "live_api_key",
  "bearer_token",
  "connector_credential",
  "user_session",
  "production_account",
  "ambient",
];

const forbiddenApprovalModes: ReplayApprovalMode[] = [
  "live_operator",
  "production_approval_store",
];

const forbiddenStores: ReplayStoreAccess[] = [
  "controlled_run_store",
  "approval_store",
  "workflow_run_store",
  "draft_store",
  "sales_asset_store",
  "support_asset_store",
  "knowledge_asset_store",
];

const forbiddenSideEffects: ReplaySideEffect[] = [
  "llm_call",
  "tool_execution",
  "api_route_call",
  "connector_call",
  "webhook",
  "email",
  "notification",
  "runtime_store_write",
  "business_asset_write",
  "file_write_outside_replay_artifact",
];

export function validateReplaySandboxContract(
  contract: ReplaySandboxContract,
): ReplaySandboxContractValidationResult {
  const errors: string[] = [];

  if (!contract.input.sourceId) errors.push("Replay input sourceId is required");
  if (!contract.input.playbookId) errors.push("Replay input playbookId is required");
  if (!contract.input.playbookVersion) {
    errors.push("Replay input playbookVersion is required");
  }
  if (contract.input.kind === "raw_controlled_run") {
    errors.push("Replay input raw_controlled_run is not allowed");
  }
  if (contract.input.redactionBoundary !== "required") {
    errors.push("Replay input redaction boundary is required");
  }
  if (forbiddenCredentialModes.includes(contract.credentialPolicy.mode)) {
    errors.push(`Live replay credential ${contract.credentialPolicy.mode} is not allowed`);
  }
  if (forbiddenApprovalModes.includes(contract.approvalPolicy.mode)) {
    errors.push(`Replay approval mode ${contract.approvalPolicy.mode} is not allowed`);
  }
  for (const store of contract.storePolicy.requestedStores) {
    if (forbiddenStores.includes(store)) {
      errors.push(`Replay store access ${store} is not allowed`);
    }
  }
  for (const sideEffect of contract.sideEffectPolicy.blocked) {
    if (forbiddenSideEffects.includes(sideEffect)) {
      errors.push(`Replay side effect ${sideEffect} is not allowed`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
    guarantees: replaySandboxGuarantees,
  };
}

export function buildNoSideEffectReplayResultArtifact(
  contract: ReplaySandboxContract,
  options: {
    generatedAt?: number;
    status?: ReplayResultArtifactStatus;
    cursorEvents?: ReplaySandboxCursorEvent[];
    diagnostics?: string[];
  } = {},
): ReplayResultArtifact {
  return {
    schemaVersion: "replay-result-artifact/v1",
    replayId: contract.replayId,
    sandboxId: contract.sandboxId,
    mode: contract.mode,
    status: options.status ?? "succeeded",
    source: contract.input,
    simulatedApprovals: contract.approvalPolicy.simulatedDecisions ?? [],
    blockedSideEffects: contract.sideEffectPolicy.blocked,
    cursorEvents: options.cursorEvents ?? [],
    diagnostics: options.diagnostics ?? [],
    generatedAt: options.generatedAt ?? Date.now(),
    guarantees: replaySandboxGuarantees,
  };
}
