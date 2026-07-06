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

export type ReplaySandboxCatalogReportItem = {
  catalogId: string;
  fixtureId: string;
  playbookId: string;
  ok: boolean;
  contractBuild: ReplaySandboxContractBuildResult;
  artifact: ReplayResultArtifact | null;
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
): ReplaySandboxCatalogReportItem {
  const contractBuild = buildReplaySandboxContractFromFixture(entry.fixture);

  if (!contractBuild.ok) {
    return {
      catalogId: entry.id,
      fixtureId: entry.fixture.fixtureId,
      playbookId: entry.playbookId,
      ok: false,
      contractBuild,
      artifact: null,
      errors: contractBuild.errors,
    };
  }

  const artifact = runNoSideEffectReplaySandbox(contractBuild.contract);
  const artifactErrors = artifact.status === "failed" ? artifact.diagnostics : [];
  const guaranteeErrors = guaranteesArePreserved(artifact)
    ? []
    : ["Replay sandbox no-side-effect guarantees were not preserved"];
  const errors = [...artifactErrors, ...guaranteeErrors];

  return {
    catalogId: entry.id,
    fixtureId: entry.fixture.fixtureId,
    playbookId: entry.playbookId,
    ok: artifact.status === "succeeded" && errors.length === 0,
    contractBuild,
    artifact,
    errors,
  };
}

export function buildReplaySandboxCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
): ReplaySandboxCatalogReport {
  const items = entries.map(buildItem);
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
