import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildControlledTraceArtifact } from "@/lib/executor/runtime/trace-governance";
import {
  DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
  DELIVERY_DEMO_COMPLETED_RUN_ID,
  DELIVERY_DEMO_DRAFT_ID,
  DELIVERY_DEMO_FAILED_RUN_ID,
  DELIVERY_DEMO_KNOWLEDGE_ASSET_ID,
  DELIVERY_DEMO_SALES_ASSET_ID,
  DELIVERY_DEMO_SUPPORT_ASSET_ID,
  DELIVERY_DEMO_WORKFLOW_RUN_ID,
} from "./demo-data.mjs";

const DATA_DIR = ".openclaw-data";

const STORE_FILES = {
  controlledRuns: "controlled-execution-runs.json",
  salesAssets: "sales-assets.json",
  knowledgeAssets: "knowledge-assets.json",
  workflowRuns: "workflow-runs.json",
  drafts: "drafts.json",
  supportAssets: "support-assets.json",
};

const EXPECTED_WRITEBACK_TARGETS = [
  "sales_asset",
  "knowledge_asset",
  "workflow_run",
  "draft",
  "support_asset",
];

const UNSAFE_TRACE_PATTERNS = [/sk-/i, /secret/i, /nora@example\.com/i];

async function readJsonArray(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function findById(records, id) {
  return records.find((record) => record && record.id === id) ?? null;
}

function pushIfMissing(diagnostics, condition, message) {
  if (!condition) diagnostics.push(message);
}

function hasPendingApproval(run) {
  return Boolean(run?.steps?.some((step) => step?.approval?.state === "pending"));
}

function hasRetryPolicy(run) {
  return Boolean(run?.plan?.steps?.some((step) => step?.onFailure?.action === "retry"));
}

function hasFailedRetryableStep(run) {
  if (!run) return false;
  const retryableStepIds = new Set(
    (run.plan?.steps ?? [])
      .filter((step) => step?.onFailure?.action === "retry")
      .map((step) => step.id),
  );
  return Boolean(
    run.steps?.some(
      (step) => step?.state === "failed" && retryableStepIds.has(step.stepId),
    ),
  );
}

function writebackTargets(run) {
  const lastStep = run?.steps?.at(-1);
  return (lastStep?.writebackReceipts ?? []).map((receipt) => receipt.target);
}

function hasRedactedStepPayloads(artifact) {
  return artifact.steps.every(
    (step) =>
      step.input &&
      typeof step.input === "object" &&
      step.input.redacted === true &&
      step.output &&
      typeof step.output === "object" &&
      step.output.redacted === true,
  );
}

function traceContainsUnsafeText(artifact) {
  const serialized = JSON.stringify(artifact);
  return UNSAFE_TRACE_PATTERNS.some((pattern) => pattern.test(serialized));
}

export function checkDeliveryDemoState(state) {
  const diagnostics = [];
  const completedRun = findById(state.controlledRuns, DELIVERY_DEMO_COMPLETED_RUN_ID);
  const awaitingRun = findById(
    state.controlledRuns,
    DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
  );
  const failedRun = findById(state.controlledRuns, DELIVERY_DEMO_FAILED_RUN_ID);

  pushIfMissing(
    diagnostics,
    Boolean(completedRun),
    `missing controlled run ${DELIVERY_DEMO_COMPLETED_RUN_ID}`,
  );
  pushIfMissing(
    diagnostics,
    Boolean(awaitingRun),
    `missing controlled run ${DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID}`,
  );
  pushIfMissing(
    diagnostics,
    Boolean(failedRun),
    `missing controlled run ${DELIVERY_DEMO_FAILED_RUN_ID}`,
  );

  if (completedRun) {
    pushIfMissing(
      diagnostics,
      completedRun.state === "completed",
      `${DELIVERY_DEMO_COMPLETED_RUN_ID} is not completed`,
    );
    pushIfMissing(
      diagnostics,
      JSON.stringify(writebackTargets(completedRun)) ===
        JSON.stringify(EXPECTED_WRITEBACK_TARGETS),
      `${DELIVERY_DEMO_COMPLETED_RUN_ID} writeback targets are incomplete`,
    );

    const artifact = buildControlledTraceArtifact(completedRun, { mode: "export" });
    pushIfMissing(
      diagnostics,
      hasRedactedStepPayloads(artifact),
      `${DELIVERY_DEMO_COMPLETED_RUN_ID} trace payloads are not redacted`,
    );
    pushIfMissing(
      diagnostics,
      !traceContainsUnsafeText(artifact),
      `${DELIVERY_DEMO_COMPLETED_RUN_ID} governed trace contains unsafe text`,
    );
  }

  if (awaitingRun) {
    pushIfMissing(
      diagnostics,
      awaitingRun.state === "awaiting_approval",
      `${DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID} is not awaiting approval`,
    );
    pushIfMissing(
      diagnostics,
      hasPendingApproval(awaitingRun),
      `${DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID} has no pending approval`,
    );
  }

  if (failedRun) {
    pushIfMissing(
      diagnostics,
      failedRun.state === "failed",
      `${DELIVERY_DEMO_FAILED_RUN_ID} is not failed`,
    );
    pushIfMissing(
      diagnostics,
      hasRetryPolicy(failedRun),
      `${DELIVERY_DEMO_FAILED_RUN_ID} has no retry policy`,
    );
    pushIfMissing(
      diagnostics,
      hasFailedRetryableStep(failedRun),
      `${DELIVERY_DEMO_FAILED_RUN_ID} has no failed retryable step`,
    );
  }

  pushIfMissing(
    diagnostics,
    Boolean(findById(state.salesAssets, DELIVERY_DEMO_SALES_ASSET_ID)),
    `missing sales asset ${DELIVERY_DEMO_SALES_ASSET_ID}`,
  );
  pushIfMissing(
    diagnostics,
    Boolean(findById(state.knowledgeAssets, DELIVERY_DEMO_KNOWLEDGE_ASSET_ID)),
    `missing knowledge asset ${DELIVERY_DEMO_KNOWLEDGE_ASSET_ID}`,
  );
  pushIfMissing(
    diagnostics,
    Boolean(findById(state.workflowRuns, DELIVERY_DEMO_WORKFLOW_RUN_ID)),
    `missing workflow run ${DELIVERY_DEMO_WORKFLOW_RUN_ID}`,
  );
  pushIfMissing(
    diagnostics,
    Boolean(findById(state.drafts, DELIVERY_DEMO_DRAFT_ID)),
    `missing draft ${DELIVERY_DEMO_DRAFT_ID}`,
  );
  pushIfMissing(
    diagnostics,
    Boolean(findById(state.supportAssets, DELIVERY_DEMO_SUPPORT_ASSET_ID)),
    `missing support asset ${DELIVERY_DEMO_SUPPORT_ASSET_ID}`,
  );

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    summary: {
      controlledRuns: state.controlledRuns.length,
      salesAssets: state.salesAssets.length,
      knowledgeAssets: state.knowledgeAssets.length,
      workflowRuns: state.workflowRuns.length,
      drafts: state.drafts.length,
      supportAssets: state.supportAssets.length,
    },
  };
}

export async function loadDeliveryDemoState({
  dataDir = path.join(process.cwd(), DATA_DIR),
} = {}) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(STORE_FILES).map(async ([key, fileName]) => [
        key,
        await readJsonArray(path.join(dataDir, fileName)),
      ]),
    ),
  );
}

export async function checkSeededDeliveryDemoData(options = {}) {
  const state = await loadDeliveryDemoState(options);
  return checkDeliveryDemoState(state);
}

async function main() {
  const result = await checkSeededDeliveryDemoData();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
