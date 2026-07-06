import {
  controlledTraceFixtureCatalog,
  type ControlledTraceFixtureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/catalog";

function cloneSalesCatalogEntry(id: string): ControlledTraceFixtureCatalogEntry {
  const salesEntry = controlledTraceFixtureCatalog.find(
    (entry) => entry.id === "sales-pipeline-governed",
  );

  if (!salesEntry) {
    throw new Error("Missing sales-pipeline-governed fixture catalog entry");
  }

  return {
    id,
    playbookId: salesEntry.playbookId,
    fixture: structuredClone(salesEntry.fixture),
  };
}

function removeSalesAssetSourceKey(entry: ControlledTraceFixtureCatalogEntry) {
  const writebackStep = entry.fixture.steps.find((step) => step.stepId === "writeback");
  const salesTarget = writebackStep?.writebackTargets.find(
    (target) => target.target === "sales_asset",
  );

  if (salesTarget) {
    delete salesTarget.sourceKey;
  }

  return entry;
}

export function buildPlaybookVersionDriftCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-version-drift");
  entry.fixture.playbookVersion = "0.9.0";
  return entry;
}

export function buildMissingStableMetadataCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  return removeSalesAssetSourceKey(
    cloneSalesCatalogEntry("sales-pipeline-missing-stable-metadata"),
  );
}

export function buildCombinedSummaryFailureCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = removeSalesAssetSourceKey(
    cloneSalesCatalogEntry("sales-pipeline-summary-drift"),
  );
  entry.fixture.playbookVersion = "0.9.0";
  return entry;
}
