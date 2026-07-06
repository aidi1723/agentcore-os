import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";
import { buildReplaySandboxCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report-output";

const report = buildReplaySandboxCatalogReport();
const output = buildReplaySandboxCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
