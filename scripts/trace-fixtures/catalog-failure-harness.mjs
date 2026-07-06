import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { buildControlledTraceFixtureCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/catalog-report-output";
import { formatControlledTraceFixtureCatalogSummary } from "@/__tests__/fixtures/controlled-traces/catalog-summary";
import { buildCombinedSummaryFailureCatalogEntry } from "@/__tests__/fixtures/controlled-traces/synthetic-failures";

function readFormatArg(argv) {
  const formatIndex = argv.indexOf("--format");
  if (formatIndex === -1) return null;
  return argv[formatIndex + 1] ?? null;
}

const format = readFormatArg(process.argv.slice(2));
const report = buildControlledTraceFixtureCatalogReport([
  buildCombinedSummaryFailureCatalogEntry(),
]);

if (format === "json") {
  const output = buildControlledTraceFixtureCatalogReportOutput(report);
  console.log(JSON.stringify(output, null, 2));
} else if (format === "summary") {
  process.stdout.write(formatControlledTraceFixtureCatalogSummary(report));
} else {
  process.stderr.write("Usage: catalog-failure-harness.mjs --format json|summary\n");
  process.exitCode = 1;
}

if (!report.ok && process.exitCode === undefined) {
  process.exitCode = 1;
}
