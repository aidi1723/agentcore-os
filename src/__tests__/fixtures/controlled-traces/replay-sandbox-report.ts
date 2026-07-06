import {
  controlledTraceFixtureCatalog,
  type ControlledTraceFixtureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/catalog";
import {
  buildReplaySandboxContractFromFixture,
  type ReplaySandboxContractBuildResult,
} from "@/lib/executor/runtime/replay-sandbox-fixture-contract";
import { runNoSideEffectReplaySandbox } from "@/lib/executor/runtime/replay-sandbox";
import type {
  ReplayResultArtifact,
  ReplaySandboxGuarantees,
} from "@/lib/executor/runtime/replay-sandbox-contracts";

export type ReplaySandboxCatalogFailureKind =
  | "contract_build_failed"
  | "sandbox_artifact_failed"
  | "guarantee_violation";

type BuildReplaySandboxCatalogReportOptions = {
  runSandbox?: typeof runNoSideEffectReplaySandbox;
};

export type ReplaySandboxCatalogReportItem = {
  catalogId: string;
  fixtureId: string;
  playbookId: string;
  ok: boolean;
  failureKind: ReplaySandboxCatalogFailureKind | null;
  contractBuild: ReplaySandboxContractBuildResult;
  artifact: ReplayResultArtifact | null;
  guaranteeErrors: string[];
  errors: string[];
};

export type ReplaySandboxCatalogReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  items: ReplaySandboxCatalogReportItem[];
  guarantees: ReplaySandboxGuarantees;
};

const replaySandboxCatalogGuarantees: ReplaySandboxGuarantees = {
  toolCallsExecuted: false,
  assetsWritten: false,
  runtimeStoresMutated: false,
  productionCredentialsUsed: false,
};

function guaranteesArePreserved(artifact: ReplayResultArtifact) {
  return (
    artifact.guarantees.toolCallsExecuted === false &&
    artifact.guarantees.assetsWritten === false &&
    artifact.guarantees.runtimeStoresMutated === false &&
    artifact.guarantees.productionCredentialsUsed === false
  );
}

function buildItem(
  entry: ControlledTraceFixtureCatalogEntry,
  options: Required<BuildReplaySandboxCatalogReportOptions>,
): ReplaySandboxCatalogReportItem {
  const contractBuild = buildReplaySandboxContractFromFixture(entry.fixture);

  if (!contractBuild.ok) {
    return {
      catalogId: entry.id,
      fixtureId: entry.fixture.fixtureId,
      playbookId: entry.playbookId,
      ok: false,
      failureKind: "contract_build_failed",
      contractBuild,
      artifact: null,
      guaranteeErrors: [],
      errors: contractBuild.errors,
    };
  }

  const artifact = options.runSandbox(contractBuild.contract);
  const artifactErrors = artifact.status === "failed" ? artifact.diagnostics : [];
  const guaranteeErrors = guaranteesArePreserved(artifact)
    ? []
    : ["Replay sandbox no-side-effect guarantees were not preserved"];
  const errors = [...artifactErrors, ...guaranteeErrors];
  const failureKind: ReplaySandboxCatalogFailureKind | null =
    artifact.status === "failed"
      ? "sandbox_artifact_failed"
      : guaranteeErrors.length > 0
        ? "guarantee_violation"
        : null;

  return {
    catalogId: entry.id,
    fixtureId: entry.fixture.fixtureId,
    playbookId: entry.playbookId,
    ok: artifact.status === "succeeded" && errors.length === 0,
    failureKind,
    contractBuild,
    artifact,
    guaranteeErrors,
    errors,
  };
}

export function buildReplaySandboxCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
  options: BuildReplaySandboxCatalogReportOptions = {},
): ReplaySandboxCatalogReport {
  const resolvedOptions = {
    runSandbox: options.runSandbox ?? runNoSideEffectReplaySandbox,
  };
  const items = entries.map((entry) => buildItem(entry, resolvedOptions));
  const passed = items.filter((item) => item.ok).length;
  const failed = items.length - passed;

  return {
    ok: failed === 0,
    total: entries.length,
    passed,
    failed,
    fixtureIds: entries.map((entry) => entry.id),
    playbookIds: entries.map((entry) => entry.playbookId),
    items,
    guarantees: replaySandboxCatalogGuarantees,
  };
}
