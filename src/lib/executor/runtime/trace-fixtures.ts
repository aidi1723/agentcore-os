import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import type {
  ControlledTraceArtifact,
  ControlledTraceGovernanceMode,
  ControlledTraceRedaction,
} from "@/lib/executor/runtime/trace-governance";
import type {
  ControlledExecutionRunState,
  ControlledExecutionStepState,
} from "@/lib/executor/runtime/types";

export type ControlledTraceFixtureStep = {
  stepId: string;
  state: ControlledExecutionStepState;
  attempts: number;
  hasRedactedInput: boolean;
  hasRedactedOutput: boolean;
  toolCalls: Array<{
    toolName: string;
    success: boolean;
    durationMs?: number;
    tokensUsed?: number;
    outputRedacted: boolean;
  }>;
  approvalState?: string;
  schemaValid?: boolean;
  writebackTargets: Array<{
    target: string;
    ok: boolean;
    assetId?: string;
    sourceKey?: string;
    workflowRunId?: string;
  }>;
};

export type ControlledTraceFixture = {
  schemaVersion: "controlled-trace-fixture/v1";
  fixtureId: string;
  sourceRunId: string;
  playbookId: string;
  playbookVersion: string;
  planId: string;
  scenarioId?: string;
  workflowRunId?: string;
  terminalState: ControlledExecutionRunState;
  generatedAt: number;
  governance: {
    mode: ControlledTraceGovernanceMode;
    redactedAt: number;
  };
  plan?: {
    id: string;
    totalSteps: number;
    requiresApproval: boolean;
    stepOrder: string[];
  };
  steps: ControlledTraceFixtureStep[];
  auditEventTypes: string[];
  assertions: {
    stepOrder: string[];
    redactionBoundary: "required";
    knownPlaybookMatched: boolean;
  };
};

export type ControlledTraceFixtureValidationResult = {
  ok: boolean;
  errors: string[];
};

type BuildControlledTraceFixtureOptions = {
  generatedAt?: number;
};

function isTraceRedaction(value: unknown): value is ControlledTraceRedaction {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as ControlledTraceRedaction).redacted === true &&
    (value as ControlledTraceRedaction).reason === "trace_governance"
  );
}

function buildFixtureId(artifact: ControlledTraceArtifact) {
  return `controlled-trace-fixture:${artifact.id}`;
}

function getKnownPlaybookStepOrder(playbookId: string) {
  const playbook = getControlledPlaybook(playbookId);
  return playbook?.steps.map((step) => step.id) ?? null;
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

export function buildControlledTraceFixture(
  artifact: ControlledTraceArtifact,
  options: BuildControlledTraceFixtureOptions = {},
): ControlledTraceFixture {
  const stepOrder = artifact.steps.map((step) => step.stepId);
  const knownStepOrder = getKnownPlaybookStepOrder(artifact.playbookId);
  const planStepOrder = artifact.plan?.steps.map((step) => step.id);

  return {
    schemaVersion: "controlled-trace-fixture/v1",
    fixtureId: buildFixtureId(artifact),
    sourceRunId: artifact.id,
    playbookId: artifact.playbookId,
    playbookVersion: artifact.playbookVersion,
    planId: artifact.planId,
    scenarioId: artifact.scenarioId,
    workflowRunId: artifact.workflowRunId,
    terminalState: artifact.state,
    generatedAt: options.generatedAt ?? Date.now(),
    governance: {
      mode: artifact.governance.mode,
      redactedAt: artifact.governance.redactedAt,
    },
    plan: artifact.plan
      ? {
          id: artifact.plan.id,
          totalSteps: artifact.plan.totalSteps,
          requiresApproval: artifact.plan.requiresApproval,
          stepOrder: planStepOrder ?? [],
        }
      : undefined,
    steps: artifact.steps.map((step) => ({
      stepId: step.stepId,
      state: step.state,
      attempts: step.attempts,
      hasRedactedInput: isTraceRedaction(step.input),
      hasRedactedOutput: isTraceRedaction(step.output),
      toolCalls: step.toolCallResults.map((toolCall) => ({
        toolName: toolCall.toolName,
        success: toolCall.success,
        durationMs: toolCall.durationMs,
        tokensUsed: toolCall.tokensUsed,
        outputRedacted: isTraceRedaction(toolCall.output),
      })),
      approvalState: step.approval?.state,
      schemaValid: step.schemaValidation?.valid,
      writebackTargets: step.writebackReceipts.map((receipt) => ({
        target: receipt.target,
        ok: receipt.ok,
        assetId: receipt.assetId,
        sourceKey: receipt.sourceKey,
        workflowRunId: receipt.workflowRunId,
      })),
    })),
    auditEventTypes: artifact.auditEvents.map((event) => event.type),
    assertions: {
      stepOrder,
      redactionBoundary: "required",
      knownPlaybookMatched: knownStepOrder ? arraysEqual(knownStepOrder, stepOrder) : false,
    },
  };
}

export function validateControlledTraceFixture(
  fixture: ControlledTraceFixture,
): ControlledTraceFixtureValidationResult {
  const errors: string[] = [];

  if (fixture.schemaVersion !== "controlled-trace-fixture/v1") {
    errors.push("Unsupported controlled trace fixture schema version");
  }
  if (!fixture.sourceRunId) errors.push("Fixture sourceRunId is required");
  if (!fixture.playbookId) errors.push("Fixture playbookId is required");

  const stepOrder = fixture.steps.map((step) => step.stepId);
  if (!arraysEqual(fixture.assertions.stepOrder, stepOrder)) {
    errors.push("Fixture step order assertion does not match steps");
  }
  if (fixture.plan && !arraysEqual(fixture.plan.stepOrder, stepOrder)) {
    errors.push("Fixture plan step order does not match steps");
  }

  for (const step of fixture.steps) {
    if (!step.stepId) errors.push("Fixture stepId is required");
    if (!step.hasRedactedInput) errors.push(`Step ${step.stepId} input is not redacted`);
    if (!step.hasRedactedOutput) errors.push(`Step ${step.stepId} output is not redacted`);
    for (const toolCall of step.toolCalls) {
      if (!toolCall.outputRedacted) {
        errors.push(`Step ${step.stepId} tool ${toolCall.toolName} output is not redacted`);
      }
    }
  }

  const knownStepOrder = getKnownPlaybookStepOrder(fixture.playbookId);
  if (
    fixture.assertions.knownPlaybookMatched &&
    knownStepOrder &&
    !arraysEqual(knownStepOrder, stepOrder)
  ) {
    errors.push("Fixture known playbook step order does not match steps");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
