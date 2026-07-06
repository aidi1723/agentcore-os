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

function findStep(entry: ControlledTraceFixtureCatalogEntry, stepId: string) {
  const step = entry.fixture.steps.find((item) => item.stepId === stepId);
  if (!step) throw new Error(`Missing fixture step ${stepId}`);
  return step;
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

export function buildMissingSourceRunIdCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-missing-source-run-id");
  entry.fixture.sourceRunId = "";
  return entry;
}

export function buildUnredactedInputCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-unredacted-input");
  findStep(entry, "intake").hasRedactedInput = false;
  return entry;
}

export function buildUnredactedToolOutputCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-unredacted-tool-output");
  const intakeStep = findStep(entry, "intake");
  const toolCall = intakeStep.toolCalls[0];
  if (!toolCall) throw new Error("Missing intake fixture tool call");
  toolCall.outputRedacted = false;
  return entry;
}

export function buildCombinedValidationFailureCatalogEntry(): ControlledTraceFixtureCatalogEntry {
  const entry = cloneSalesCatalogEntry("sales-pipeline-validation-failure");
  entry.fixture.sourceRunId = "";
  const intakeStep = findStep(entry, "intake");
  intakeStep.hasRedactedInput = false;
  const toolCall = intakeStep.toolCalls[0];
  if (!toolCall) throw new Error("Missing intake fixture tool call");
  toolCall.outputRedacted = false;
  return entry;
}
