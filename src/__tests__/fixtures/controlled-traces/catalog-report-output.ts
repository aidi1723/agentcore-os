import type { ControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";

export function buildControlledTraceFixtureCatalogReportOutput(
  report: ControlledTraceFixtureCatalogReport,
) {
  return {
    ok: report.ok,
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    fixtureIds: report.fixtureIds,
    playbookIds: report.playbookIds,
    failedItems: report.items
      .filter((item) => !item.ok)
      .map((item) => ({
        catalogId: item.catalogId,
        fixtureId: item.fixtureId,
        playbookId: item.playbookId,
        validationErrors: item.validation.errors,
        replayErrors: item.replay.errors,
        diagnostics: item.replay.diagnostics,
      })),
    guarantees: report.guarantees,
  };
}
