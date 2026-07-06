import type {
  ControlledTraceFixtureCatalogReport,
  ControlledTraceFixtureCatalogReportItem,
} from "@/__tests__/fixtures/controlled-traces/catalog-report";

function joinOrNone(values: string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatArray(name: string, values: string[]) {
  return `${name}: ${joinOrNone(values)}`;
}

function formatMissingWritebackTargets(item: ControlledTraceFixtureCatalogReportItem) {
  return item.replay.diagnostics.missingWritebackTargets.map(
    (target) => `${target.stepId}:${target.target}`,
  );
}

function formatMissingStableMetadata(item: ControlledTraceFixtureCatalogReportItem) {
  return item.replay.diagnostics.writebackTargetsMissingStableMetadata.map(
    (target) => `${target.stepId}:${target.target} missing ${target.missingFields.join(",")}`,
  );
}

function formatFailedItem(item: ControlledTraceFixtureCatalogReportItem) {
  const diagnostics = item.replay.diagnostics;
  const lines = [
    `Failed fixture: ${item.catalogId}`,
    `  fixtureId: ${item.fixtureId}`,
    `  playbookId: ${item.playbookId}`,
    `  validationErrors: ${joinOrNone(item.validation.errors)}`,
    `  replayErrors: ${joinOrNone(item.replay.errors)}`,
    `  expectedStepOrder: ${joinOrNone(diagnostics.expectedStepOrder)}`,
    `  fixtureStepOrder: ${joinOrNone(diagnostics.fixtureStepOrder)}`,
    `  expectedPlaybookVersion: ${diagnostics.expectedPlaybookVersion ?? "none"}`,
    `  fixturePlaybookVersion: ${diagnostics.fixturePlaybookVersion}`,
    `  expectedScenarioId: ${diagnostics.expectedScenarioId ?? "none"}`,
    `  fixtureScenarioId: ${diagnostics.fixtureScenarioId ?? "none"}`,
    `  expectedPlanId: ${diagnostics.expectedPlanId ?? "none"}`,
    `  fixturePlanId: ${diagnostics.fixturePlanId ?? "none"}`,
    `  expectedPlanTotalSteps: ${diagnostics.expectedPlanTotalSteps ?? "none"}`,
    `  fixturePlanTotalSteps: ${diagnostics.fixturePlanTotalSteps ?? "none"}`,
    `  expectedPlanRequiresApproval: ${diagnostics.expectedPlanRequiresApproval ?? "none"}`,
    `  fixturePlanRequiresApproval: ${diagnostics.fixturePlanRequiresApproval ?? "none"}`,
    `  ${formatArray("planStepOrder", diagnostics.planStepOrder)}`,
    `  ${formatArray("missingApprovalStepIds", diagnostics.missingApprovalStepIds)}`,
    `  missingWritebackTargets: ${joinOrNone(formatMissingWritebackTargets(item))}`,
    `  ${formatArray(
      "missingCompletedStepAttempts",
      diagnostics.missingCompletedStepAttempts,
    )}`,
    `  ${formatArray("nonApprovedApprovalStepIds", diagnostics.nonApprovedApprovalStepIds)}`,
    `  writebackTargetsMissingStableMetadata: ${joinOrNone(formatMissingStableMetadata(item))}`,
  ];

  return lines.join("\n");
}

export function formatControlledTraceFixtureCatalogSummary(
  report: ControlledTraceFixtureCatalogReport,
) {
  const lines = [
    "Governed trace fixture replay summary",
    `Status: ${report.ok ? "OK" : "FAILED"}`,
    `Fixtures: ${report.total} total, ${report.passed} passed, ${report.failed} failed`,
    `Catalog: ${joinOrNone(report.fixtureIds)}`,
    `Playbooks: ${joinOrNone(report.playbookIds)}`,
    `Guarantees: toolCallsExecuted=${report.guarantees.toolCallsExecuted}, assetsWritten=${report.guarantees.assetsWritten}`,
  ];

  const failedItems = report.items.filter((item) => !item.ok);
  if (failedItems.length > 0) {
    lines.push("", "Failures:");
    lines.push(...failedItems.map(formatFailedItem));
  }

  return `${lines.join("\n")}\n`;
}
