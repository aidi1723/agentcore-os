import type { ExecutionPlan, ToolCallResult } from "@/lib/executor/contracts";

export type ControlledExecutionRunState =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type ControlledExecutionStepState =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export type ControlledApprovalRecord = {
  executionId: string;
  stepId: string;
  state: "pending" | "approved" | "rejected" | "timed_out";
  requestedAt: number;
  resolvedAt?: number;
  feedback?: string;
  approver?: "local_user";
};

export type ControlledSchemaValidationRecord = {
  valid: boolean;
  errors: string[];
  checkedAt: number;
};

export type ControlledWritebackReceipt = {
  target: string;
  ok: boolean;
  summary: string;
  writtenAt: number;
};

export type ControlledExecutionStepRecord = {
  stepId: string;
  state: ControlledExecutionStepState;
  startedAt?: number;
  finishedAt?: number;
  input: unknown;
  output: unknown;
  error?: string;
  attempts: number;
  toolCallResults: ToolCallResult[];
  approval?: ControlledApprovalRecord;
  schemaValidation?: ControlledSchemaValidationRecord;
  writebackReceipts: ControlledWritebackReceipt[];
};

export type ControlledExecutionRunRecord = {
  id: string;
  requestId: string;
  sessionId: string;
  workflowRunId?: string;
  scenarioId?: string;
  playbookId: string;
  playbookVersion: string;
  planId: string;
  state: ControlledExecutionRunState;
  currentStepId?: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  error?: string;
  plan: ExecutionPlan;
  steps: ControlledExecutionStepRecord[];
};
