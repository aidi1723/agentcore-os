import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { buildControlledTraceFixtureCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/catalog-report-output";

const report = buildControlledTraceFixtureCatalogReport();
const output = buildControlledTraceFixtureCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
