import type { ExecutionPlan, ExecutionStep, ToolCallResult } from "@/lib/executor/contracts";
import type { ControlledPlaybookStep } from "@/lib/executor/playbooks/types";
import type {
  ControlledApprovalRecord,
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
  ControlledRunAuditEvent,
  ControlledSchemaValidationRecord,
  ControlledWritebackReceipt,
} from "@/lib/executor/runtime/types";
import { redactSensitiveText } from "@/lib/executor/redaction";

export type ControlledTraceGovernanceMode = "fixture" | "export";

export type ControlledTraceRedaction = {
  redacted: true;
  reason: "trace_governance";
  summary: string;
};

export type ControlledTraceGovernancePolicy = {
  mode: ControlledTraceGovernanceMode;
  includePlan: boolean;
  includeStepInput: boolean;
  includeStepOutput: boolean;
  includeToolOutputs: boolean;
  maxStringLength: number;
};

export type ControlledTraceArtifactToolCall = Omit<ToolCallResult, "output" | "sideEffects"> & {
  output: unknown;
  sideEffects?: ControlledTraceRedaction;
};

export type ControlledTraceArtifactApproval = Omit<ControlledApprovalRecord, "feedback"> & {
  feedback?: ControlledTraceRedaction;
};

export type ControlledTraceArtifactSchemaValidation = Omit<
  ControlledSchemaValidationRecord,
  "errors"
> & {
  errors: ControlledTraceRedaction[];
};

export type ControlledTraceArtifactStep = Omit<
  ControlledExecutionStepRecord,
  "input" | "output" | "error" | "toolCallResults" | "approval" | "schemaValidation"
> & {
  input: unknown;
  output: unknown;
  error?: ControlledTraceRedaction;
  toolCallResults: ControlledTraceArtifactToolCall[];
  approval?: ControlledTraceArtifactApproval;
  schemaValidation?: ControlledTraceArtifactSchemaValidation;
};

export type ControlledTraceArtifactAuditEvent = Omit<ControlledRunAuditEvent, "message"> & {
  message?: ControlledTraceRedaction;
};

export type ControlledTraceArtifactPlanStep = Omit<
  ExecutionStep,
  "description" | "toolCalls" | "inputSchema" | "outputSchema" | "estimatedTokens"
> & {
  description?: ControlledTraceRedaction;
  writesTo: NonNullable<ControlledPlaybookStep["writesTo"]>;
  toolCallCount: number;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  estimatedTokens?: number;
};

export type ControlledTraceArtifactPlan = Omit<ExecutionPlan, "goal" | "steps"> & {
  goal: ControlledTraceRedaction;
  steps: ControlledTraceArtifactPlanStep[];
};

export type ControlledTraceArtifact = Omit<
  ControlledExecutionRunRecord,
  "error" | "auditEvents" | "plan" | "steps"
> & {
  governance: {
    mode: ControlledTraceGovernanceMode;
    redactedAt: number;
    policy: ControlledTraceGovernancePolicy;
  };
  error?: ControlledTraceRedaction;
  auditEvents: ControlledTraceArtifactAuditEvent[];
  plan?: ControlledTraceArtifactPlan;
  steps: ControlledTraceArtifactStep[];
};

const DEFAULT_POLICY: ControlledTraceGovernancePolicy = {
  mode: "fixture",
  includePlan: true,
  includeStepInput: false,
  includeStepOutput: false,
  includeToolOutputs: false,
  maxStringLength: 240,
};

function resolvePolicy(
  policy?: Partial<ControlledTraceGovernancePolicy>,
): ControlledTraceGovernancePolicy {
  return {
    ...DEFAULT_POLICY,
    ...policy,
  };
}

function clipText(value: string, maxLength: number) {
  const redacted = redactSensitiveText(value).trim();
  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, Math.max(0, maxLength - 1))}…`;
}

function summarizeValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (typeof value === "string") return `string(length=${value.length})`;
  if (typeof value === "number" || typeof value === "boolean") return typeof value;
  if (typeof value === "object") {
    return `object(keys=${Object.keys(value as Record<string, unknown>).join(",")})`;
  }
  return typeof value;
}

export function redactTraceValue(value: unknown): ControlledTraceRedaction {
  return {
    redacted: true,
    reason: "trace_governance",
    summary: summarizeValue(value),
  };
}

function redactOptionalValue(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  return redactTraceValue(value);
}

function redactStringValue(value: string | undefined) {
  if (!value) return undefined;
  return redactTraceValue(value);
}

function buildPlanArtifact(plan: ExecutionPlan): ControlledTraceArtifactPlan {
  return {
    id: plan.id,
    goal: redactTraceValue(plan.goal),
    totalSteps: plan.totalSteps,
    requiresApproval: plan.requiresApproval,
    steps: plan.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: redactTraceValue(step.description),
      dependsOn: [...step.dependsOn],
      mode: step.mode,
      writesTo: getStepWriteTargets(step).map((target) => ({ ...target })),
      onFailure: step.onFailure ? { ...step.onFailure } : undefined,
      toolCallCount: step.toolCalls.length,
      hasInputSchema: hasStepInputSchema(step),
      hasOutputSchema: Boolean(step.outputSchema),
      estimatedTokens: step.estimatedTokens,
    })),
  };
}

function getStepWriteTargets(step: ExecutionStep) {
  if (!("writesTo" in step) || !Array.isArray(step.writesTo)) return [];
  return step.writesTo as NonNullable<ControlledPlaybookStep["writesTo"]>;
}

function hasStepInputSchema(step: ExecutionStep) {
  return "inputSchema" in step && Boolean(step.inputSchema);
}

function buildToolCallArtifact(
  result: ToolCallResult,
  policy: ControlledTraceGovernancePolicy,
): ControlledTraceArtifactToolCall {
  return {
    toolName: result.toolName,
    success: result.success,
    output: policy.includeToolOutputs ? result.output : redactTraceValue(result.output),
    sideEffects: result.sideEffects ? redactTraceValue(result.sideEffects) : undefined,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
  };
}

function buildApprovalArtifact(
  approval?: ControlledApprovalRecord,
): ControlledTraceArtifactApproval | undefined {
  if (!approval) return undefined;
  return {
    executionId: approval.executionId,
    stepId: approval.stepId,
    state: approval.state,
    requestedAt: approval.requestedAt,
    resolvedAt: approval.resolvedAt,
    feedback: redactOptionalValue(approval.feedback),
    approver: approval.approver,
  };
}

function buildSchemaValidationArtifact(
  record?: ControlledSchemaValidationRecord,
): ControlledTraceArtifactSchemaValidation | undefined {
  if (!record) return undefined;
  return {
    valid: record.valid,
    errors: record.errors.map((error) => redactTraceValue(error)),
    checkedAt: record.checkedAt,
  };
}

function buildReceiptArtifact(
  receipt: ControlledWritebackReceipt,
  policy: ControlledTraceGovernancePolicy,
): ControlledWritebackReceipt {
  return {
    target: receipt.target,
    ok: receipt.ok,
    summary: clipText(receipt.summary, policy.maxStringLength),
    writtenAt: receipt.writtenAt,
    assetId: receipt.assetId,
    sourceKey: receipt.sourceKey,
    workflowRunId: receipt.workflowRunId,
  };
}

function buildStepArtifact(
  step: ControlledExecutionStepRecord,
  policy: ControlledTraceGovernancePolicy,
): ControlledTraceArtifactStep {
  return {
    stepId: step.stepId,
    state: step.state,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    input: policy.includeStepInput ? step.input : redactTraceValue(step.input),
    output: policy.includeStepOutput ? step.output : redactTraceValue(step.output),
    error: redactStringValue(step.error),
    attempts: step.attempts,
    toolCallResults: step.toolCallResults.map((result) => buildToolCallArtifact(result, policy)),
    approval: buildApprovalArtifact(step.approval),
    schemaValidation: buildSchemaValidationArtifact(step.schemaValidation),
    writebackReceipts: step.writebackReceipts.map((receipt) =>
      buildReceiptArtifact(receipt, policy),
    ),
  };
}

function buildAuditEventArtifact(
  event: ControlledRunAuditEvent,
): ControlledTraceArtifactAuditEvent {
  return {
    id: event.id,
    type: event.type,
    stepId: event.stepId,
    message: redactOptionalValue(event.message),
    createdAt: event.createdAt,
    actor: event.actor,
  };
}

export function buildControlledTraceArtifact(
  run: ControlledExecutionRunRecord,
  policyInput?: Partial<ControlledTraceGovernancePolicy>,
): ControlledTraceArtifact {
  const policy = resolvePolicy(policyInput);
  return {
    id: run.id,
    requestId: run.requestId,
    sessionId: run.sessionId,
    workflowRunId: run.workflowRunId,
    scenarioId: run.scenarioId,
    playbookId: run.playbookId,
    playbookVersion: run.playbookVersion,
    planId: run.planId,
    state: run.state,
    currentStepId: run.currentStepId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
    governance: {
      mode: policy.mode,
      redactedAt: Date.now(),
      policy,
    },
    error: redactStringValue(run.error),
    auditEvents: run.auditEvents.map(buildAuditEventArtifact),
    plan: policy.includePlan ? buildPlanArtifact(run.plan) : undefined,
    steps: run.steps.map((step) => buildStepArtifact(step, policy)),
  };
}
