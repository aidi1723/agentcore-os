import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";
import { buildReplaySandboxCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report-output";

const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
fixture.sourceRunId = "";
fixture.playbookVersion = "";
fixture.assertions.redactionBoundary = "optional";

const report = buildReplaySandboxCatalogReport([
  {
    id: "sales-pipeline-replay-sandbox-broken-contract",
    playbookId: "sales-pipeline-v1",
    fixture,
  },
]);
const output = buildReplaySandboxCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
