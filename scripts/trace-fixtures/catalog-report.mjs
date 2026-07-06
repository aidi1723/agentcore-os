import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";

const report = buildControlledTraceFixtureCatalogReport();

const output = {
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

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
