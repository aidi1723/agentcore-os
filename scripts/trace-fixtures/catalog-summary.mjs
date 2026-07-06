import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { formatControlledTraceFixtureCatalogSummary } from "@/__tests__/fixtures/controlled-traces/catalog-summary";

const report = buildControlledTraceFixtureCatalogReport();

process.stdout.write(formatControlledTraceFixtureCatalogSummary(report));

if (!report.ok) {
  process.exitCode = 1;
}
