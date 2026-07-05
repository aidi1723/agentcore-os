import type {
  ControlledExecutionRunState,
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
  ControlledWritebackReceipt,
} from "@/lib/executor/runtime/types";

export type ControlledRunAssetLandingSummary = {
  target: string;
  label: string;
  detail: string;
  ok: boolean;
  assetId?: string;
  sourceKey?: string;
  workflowRunId?: string;
  appId?: "deal_desk" | "knowledge_vault";
};

export type ControlledRunStepConsoleSummary = {
  id: string;
  title: string;
  state: ControlledExecutionStepRecord["state"];
  attempts: number;
  approvalState?: ControlledExecutionStepRecord["approval"] extends infer Approval
    ? Approval extends { state: infer State }
      ? State
      : never
    : never;
  approvalFeedback?: string;
  schemaValid?: boolean;
  schemaErrors: string[];
  receiptCount: number;
  writebackReceipts: ControlledWritebackReceipt[];
  error?: string;
};

export type ControlledRunConsoleSummary = {
  id: string;
  title: string;
  playbookId: string;
  playbookVersion: string;
  state: ControlledExecutionRunRecord["state"];
  currentStepId?: string;
  workflowRunId?: string;
  scenarioId?: string;
  error?: string;
  updatedAt: number;
  completedSteps: number;
  awaitingApprovalSteps: number;
  failedSteps: number;
  approvalCount: number;
  writebackReceiptCount: number;
  assetLandings: ControlledRunAssetLandingSummary[];
  failedStepId?: string;
  canRetry: boolean;
  retryReason?: string;
  auditEventCount: number;
  pendingApprovalStepId?: string;
  canApprove: boolean;
  canResume: boolean;
  steps: ControlledRunStepConsoleSummary[];
};

export type ControlledRunConsoleFilters = {
  state: "all" | ControlledExecutionRunState;
  query: string;
};

const ASSET_LABELS: Record<string, string> = {
  sales_asset: "Sales asset",
  knowledge_asset: "Knowledge asset",
};

const ASSET_APP_IDS: Record<string, ControlledRunAssetLandingSummary["appId"]> = {
  sales_asset: "deal_desk",
  knowledge_asset: "knowledge_vault",
};

function titleForStep(run: ControlledExecutionRunRecord, stepId: string) {
  return run.plan.steps.find((step) => step.id === stepId)?.title ?? stepId;
}

function buildAssetLandings(
  receipts: ControlledWritebackReceipt[],
): ControlledRunAssetLandingSummary[] {
  return receipts
    .filter((receipt) => receipt.target === "sales_asset" || receipt.target === "knowledge_asset")
    .map((receipt) => ({
      target: receipt.target,
      label: ASSET_LABELS[receipt.target] ?? receipt.target,
      detail: receipt.summary,
      ok: receipt.ok,
      assetId: receipt.assetId,
      sourceKey: receipt.sourceKey,
      workflowRunId: receipt.workflowRunId,
      appId: ASSET_APP_IDS[receipt.target],
    }));
}

function firstFailedStepInPlanOrder(run: ControlledExecutionRunRecord) {
  for (const planStep of run.plan.steps) {
    const record = run.steps.find(
      (step) => step.stepId === planStep.id && step.state === "failed",
    );
    if (record) return { planStep, record };
  }
  return null;
}

function deriveRetryState(run: ControlledExecutionRunRecord) {
  const failedStep = firstFailedStepInPlanOrder(run);
  if (!failedStep) {
    return {
      failedStepId: undefined,
      canRetry: false,
      retryReason: run.state === "failed" ? "No failed step" : "Run is not failed",
    };
  }
  if (run.state !== "failed") {
    return {
      failedStepId: failedStep.record.stepId,
      canRetry: false,
      retryReason: "Run is not failed",
    };
  }
  if (failedStep.planStep.onFailure?.action !== "retry") {
    return {
      failedStepId: failedStep.record.stepId,
      canRetry: false,
      retryReason: "Failed step is not retryable",
    };
  }
  return {
    failedStepId: failedStep.record.stepId,
    canRetry: true,
    retryReason: undefined,
  };
}

export function buildControlledRunConsoleSummary(
  run: ControlledExecutionRunRecord,
): ControlledRunConsoleSummary {
  const steps = run.steps.map((step) => ({
    id: step.stepId,
    title: titleForStep(run, step.stepId),
    state: step.state,
    attempts: step.attempts,
    approvalState: step.approval?.state,
    approvalFeedback: step.approval?.feedback,
    schemaValid: step.schemaValidation?.valid,
    schemaErrors: step.schemaValidation?.errors ?? [],
    receiptCount: step.writebackReceipts.length,
    writebackReceipts: step.writebackReceipts,
    error: step.error,
  }));
  const receipts = run.steps.flatMap((step) => step.writebackReceipts);
  const pendingApprovalStep = run.steps.find(
    (step) => step.state === "awaiting_approval" && step.approval?.state === "pending",
  );
  const isTerminal =
    run.state === "completed" ||
    run.state === "failed" ||
    run.state === "cancelled";
  const retryState = deriveRetryState(run);

  return {
    id: run.id,
    title: run.plan.goal || run.id,
    playbookId: run.playbookId,
    playbookVersion: run.playbookVersion,
    state: run.state,
    currentStepId: run.currentStepId,
    workflowRunId: run.workflowRunId,
    scenarioId: run.scenarioId,
    error: run.error,
    updatedAt: run.updatedAt,
    completedSteps: run.steps.filter((step) => step.state === "completed").length,
    awaitingApprovalSteps: run.steps.filter((step) => step.state === "awaiting_approval").length,
    failedSteps: run.steps.filter((step) => step.state === "failed").length,
    approvalCount: run.steps.filter((step) => Boolean(step.approval)).length,
    writebackReceiptCount: receipts.length,
    assetLandings: buildAssetLandings(receipts),
    failedStepId: retryState.failedStepId,
    canRetry: retryState.canRetry,
    retryReason: retryState.retryReason,
    auditEventCount: run.auditEvents.length,
    pendingApprovalStepId: pendingApprovalStep?.stepId,
    canApprove: Boolean(pendingApprovalStep),
    canResume: !isTerminal && !pendingApprovalStep,
    steps,
  };
}

export function filterControlledRunConsoleSummaries(
  summaries: ControlledRunConsoleSummary[],
  filters: ControlledRunConsoleFilters,
) {
  const query = filters.query.trim().toLowerCase();
  return summaries.filter((summary) => {
    if (filters.state !== "all" && summary.state !== filters.state) return false;
    if (!query) return true;
    const assetValues = summary.assetLandings.flatMap((asset) => [
      asset.target,
      asset.label,
      asset.detail,
      asset.assetId,
      asset.sourceKey,
      asset.workflowRunId,
      asset.appId,
    ]);
    const receiptValues = summary.steps.flatMap((step) =>
      step.writebackReceipts.flatMap((receipt) => [
        receipt.target,
        receipt.summary,
        receipt.assetId,
        receipt.sourceKey,
        receipt.workflowRunId,
      ]),
    );
    return [
      summary.id,
      summary.title,
      summary.workflowRunId,
      summary.playbookId,
      summary.scenarioId,
      summary.currentStepId,
      summary.error,
      ...assetValues,
      ...receiptValues,
    ]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLowerCase().includes(query));
  });
}
