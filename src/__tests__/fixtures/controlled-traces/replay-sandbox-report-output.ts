import type { ReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";

export function buildReplaySandboxCatalogReportOutput(
  report: ReplaySandboxCatalogReport,
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
        failureKind: item.failureKind,
        contractBuildOk: item.contractBuild.ok,
        contractErrors: item.contractBuild.ok ? [] : item.contractBuild.errors,
        artifactStatus: item.artifact?.status ?? null,
        artifactDiagnostics: item.artifact?.diagnostics ?? [],
        guaranteeErrors: item.guaranteeErrors,
        errors: item.errors,
      })),
    guarantees: report.guarantees,
  };
}
