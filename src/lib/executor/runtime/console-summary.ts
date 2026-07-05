import type {
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
  ControlledWritebackReceipt,
} from "@/lib/executor/runtime/types";

export type ControlledRunAssetLandingSummary = {
  target: string;
  label: string;
  detail: string;
  ok: boolean;
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
  updatedAt: number;
  completedSteps: number;
  awaitingApprovalSteps: number;
  failedSteps: number;
  approvalCount: number;
  writebackReceiptCount: number;
  assetLandings: ControlledRunAssetLandingSummary[];
  steps: ControlledRunStepConsoleSummary[];
};

const ASSET_LABELS: Record<string, string> = {
  sales_asset: "Sales asset",
  knowledge_asset: "Knowledge asset",
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
    }));
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

  return {
    id: run.id,
    title: run.plan.goal || run.id,
    playbookId: run.playbookId,
    playbookVersion: run.playbookVersion,
    state: run.state,
    currentStepId: run.currentStepId,
    workflowRunId: run.workflowRunId,
    scenarioId: run.scenarioId,
    updatedAt: run.updatedAt,
    completedSteps: run.steps.filter((step) => step.state === "completed").length,
    awaitingApprovalSteps: run.steps.filter((step) => step.state === "awaiting_approval").length,
    failedSteps: run.steps.filter((step) => step.state === "failed").length,
    approvalCount: run.steps.filter((step) => Boolean(step.approval)).length,
    writebackReceiptCount: receipts.length,
    assetLandings: buildAssetLandings(receipts),
    steps,
  };
}
