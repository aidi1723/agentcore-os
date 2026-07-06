import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildReplaySandboxCatalogReport } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report";
import { buildReplaySandboxCatalogReportOutput } from "@/__tests__/fixtures/controlled-traces/replay-sandbox-report-output";
import { buildNoSideEffectReplayResultArtifact } from "@/lib/executor/runtime/replay-sandbox-contracts";

const supportedModes = ["contract", "sandbox", "guarantee"];
const mode = process.argv[2] ?? "contract";

if (!supportedModes.includes(mode)) {
  console.error(
    `Unsupported replay sandbox failure harness mode: ${mode}. Supported modes: ${supportedModes.join(", ")}.`,
  );
  process.exit(2);
}

function buildContractFailureReport() {
  const fixture = structuredClone(controlledTraceFixtureCatalog[0].fixture);
  fixture.sourceRunId = "";
  fixture.playbookVersion = "";
  fixture.assertions.redactionBoundary = "optional";

  return buildReplaySandboxCatalogReport([
    {
      id: "sales-pipeline-replay-sandbox-broken-contract",
      playbookId: "sales-pipeline-v1",
      fixture,
    },
  ]);
}

function buildSandboxArtifactFailureReport() {
  return buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
    runSandbox: (contract) =>
      buildNoSideEffectReplayResultArtifact(contract, {
        status: "failed",
        cursorEvents: ["preflight"],
        diagnostics: ["Synthetic sandbox preflight rejection"],
      }),
  });
}

function buildGuaranteeViolationReport() {
  return buildReplaySandboxCatalogReport([controlledTraceFixtureCatalog[0]], {
    runSandbox: (contract) => ({
      ...buildNoSideEffectReplayResultArtifact(contract, {
        status: "succeeded",
        diagnostics: ["Synthetic replay completed"],
      }),
      guarantees: {
        toolCallsExecuted: true,
        assetsWritten: false,
        runtimeStoresMutated: false,
        productionCredentialsUsed: false,
      },
    }),
  });
}

const report =
  mode === "contract"
    ? buildContractFailureReport()
    : mode === "sandbox"
      ? buildSandboxArtifactFailureReport()
      : buildGuaranteeViolationReport();
const output = buildReplaySandboxCatalogReportOutput(report);

console.log(JSON.stringify(output, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
