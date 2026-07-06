import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import type {
  ControlledPlaybook,
  ControlledPlaybookWriteTarget,
} from "@/lib/executor/playbooks/types";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { validateControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

export type ControlledTraceReplayReport = {
  ok: boolean;
  fixtureId: string;
  playbookId: string;
  checkedStepIds: string[];
  errors: string[];
  warnings: string[];
  diagnostics: ControlledTraceReplayDiagnostics;
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};

export type ControlledTraceReplayMissingWritebackTarget = {
  stepId: string;
  target: ControlledPlaybookWriteTarget;
};

export type ControlledTraceReplayMissingStableMetadata = {
  stepId: string;
  target: ControlledPlaybookWriteTarget;
  missingFields: Array<"assetId" | "sourceKey" | "workflowRunId">;
};

export type ControlledTraceReplayDiagnostics = {
  fixtureId: string;
  playbookId: string;
  expectedPlaybookVersion?: string;
  fixturePlaybookVersion: string;
  expectedScenarioId?: string;
  fixtureScenarioId?: string;
  expectedPlanId?: string;
  fixturePlanId?: string;
  expectedPlanTotalSteps?: number;
  fixturePlanTotalSteps?: number;
  expectedPlanRequiresApproval?: boolean;
  fixturePlanRequiresApproval?: boolean;
  planStepOrder: string[];
  expectedStepOrder: string[];
  fixtureStepOrder: string[];
  missingApprovalStepIds: string[];
  missingWritebackTargets: ControlledTraceReplayMissingWritebackTarget[];
  missingCompletedStepAttempts: string[];
  nonApprovedApprovalStepIds: string[];
  writebackTargetsMissingStableMetadata: ControlledTraceReplayMissingStableMetadata[];
};

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function hasWritebackTarget(
  step: ControlledTraceFixture["steps"][number] | undefined,
  target: ControlledPlaybookWriteTarget,
) {
  return step?.writebackTargets.some((writebackTarget) => writebackTarget.target === target) ?? false;
}

function buildExpectedPlanId(playbookId: string, playbookVersion: string) {
  return `playbook:${playbookId}:${playbookVersion}`;
}

function playbookRequiresApproval(playbook: ControlledPlaybook) {
  return playbook.steps.some((step) => step.requiresApproval);
}

function isControlledPlaybookWriteTarget(target: string): target is ControlledPlaybookWriteTarget {
  return (
    target === "workflow_run" ||
    target === "draft" ||
    target === "sales_asset" ||
    target === "support_asset" ||
    target === "knowledge_asset"
  );
}

function getMissingStableMetadataFields(
  writebackTarget: ControlledTraceFixture["steps"][number]["writebackTargets"][number],
) {
  const missingFields: Array<"assetId" | "sourceKey" | "workflowRunId"> = [];
  if (!writebackTarget.assetId) missingFields.push("assetId");
  if (!writebackTarget.sourceKey) missingFields.push("sourceKey");
  if (!writebackTarget.workflowRunId) missingFields.push("workflowRunId");
  return missingFields;
}

export function replayControlledTraceFixture(
  fixture: ControlledTraceFixture,
): ControlledTraceReplayReport {
  const checkedStepIds = fixture.steps.map((step) => step.stepId);
  const baseDiagnostics: Omit<ControlledTraceReplayDiagnostics, "expectedStepOrder"> = {
    fixtureId: fixture.fixtureId,
    playbookId: fixture.playbookId,
    fixturePlaybookVersion: fixture.playbookVersion,
    fixtureScenarioId: fixture.scenarioId,
    fixturePlanId: fixture.plan?.id,
    fixturePlanTotalSteps: fixture.plan?.totalSteps,
    fixturePlanRequiresApproval: fixture.plan?.requiresApproval,
    planStepOrder: fixture.plan?.stepOrder ?? [],
    fixtureStepOrder: checkedStepIds,
    missingApprovalStepIds: [],
    missingWritebackTargets: [],
    missingCompletedStepAttempts: [],
    nonApprovedApprovalStepIds: [],
    writebackTargetsMissingStableMetadata: [],
  };
  const errors = validateControlledTraceFixture(fixture).errors.map(
    (error) => `Fixture validation failed: ${error}`,
  );
  const playbook = getControlledPlaybook(fixture.playbookId);

  if (!playbook) {
    errors.push(`Controlled playbook ${fixture.playbookId} is not registered`);
    return {
      ok: false,
      fixtureId: fixture.fixtureId,
      playbookId: fixture.playbookId,
      checkedStepIds,
      errors,
      warnings: [],
      diagnostics: {
        ...baseDiagnostics,
        expectedStepOrder: [],
      },
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    };
  }

  const playbookStepIds = playbook.steps.map((step) => step.id);
  const missingApprovalStepIds: string[] = [];
  const missingWritebackTargets: ControlledTraceReplayMissingWritebackTarget[] = [];
  const missingCompletedStepAttempts: string[] = [];
  const nonApprovedApprovalStepIds: string[] = [];
  const writebackTargetsMissingStableMetadata: ControlledTraceReplayMissingStableMetadata[] = [];
  const expectedPlanId = buildExpectedPlanId(playbook.id, playbook.version);
  const expectedPlanTotalSteps = playbook.steps.length;
  const expectedPlanRequiresApproval = playbookRequiresApproval(playbook);

  if (fixture.playbookVersion !== playbook.version) {
    errors.push(`Fixture playbook version does not match current playbook ${fixture.playbookId}`);
  }
  if (fixture.scenarioId && fixture.scenarioId !== playbook.scenarioId) {
    errors.push(`Fixture scenarioId does not match current playbook ${fixture.playbookId}`);
  }
  if (fixture.plan?.id && fixture.plan.id !== expectedPlanId) {
    errors.push(`Fixture plan id does not match current playbook ${fixture.playbookId}`);
  }
  if (
    typeof fixture.plan?.totalSteps === "number" &&
    fixture.plan.totalSteps !== expectedPlanTotalSteps
  ) {
    errors.push(`Fixture plan totalSteps does not match current playbook ${fixture.playbookId}`);
  }
  if (
    typeof fixture.plan?.requiresApproval === "boolean" &&
    fixture.plan.requiresApproval !== expectedPlanRequiresApproval
  ) {
    errors.push(`Fixture plan requiresApproval does not match current playbook ${fixture.playbookId}`);
  }

  if (!arraysEqual(checkedStepIds, playbookStepIds)) {
    errors.push(`Fixture step order does not match current playbook ${fixture.playbookId}`);
  }

  const fixtureStepsById = new Map(fixture.steps.map((step) => [step.stepId, step]));
  for (const playbookStep of playbook.steps) {
    const fixtureStep = fixtureStepsById.get(playbookStep.id);
    if (playbookStep.requiresApproval && !fixtureStep?.approvalState) {
      missingApprovalStepIds.push(playbookStep.id);
      errors.push(`Step ${playbookStep.id} requires approval but fixture has no approval state`);
    }
    for (const writeback of playbookStep.writesTo ?? []) {
      if (!hasWritebackTarget(fixtureStep, writeback.target)) {
        missingWritebackTargets.push({
          stepId: playbookStep.id,
          target: writeback.target,
        });
        errors.push(`Step ${playbookStep.id} is missing writeback target ${writeback.target}`);
      }
    }
    if (fixtureStep?.state === "completed" && fixtureStep.attempts < 1) {
      missingCompletedStepAttempts.push(playbookStep.id);
      errors.push(`Step ${playbookStep.id} completed with no recorded attempts`);
    }
    if (
      fixtureStep?.state === "completed" &&
      playbookStep.requiresApproval &&
      fixtureStep.approvalState &&
      fixtureStep.approvalState !== "approved"
    ) {
      nonApprovedApprovalStepIds.push(playbookStep.id);
      errors.push(
        `Step ${playbookStep.id} requires approved terminal state but fixture approval state is ${fixtureStep.approvalState}`,
      );
    }
    for (const writebackTarget of fixtureStep?.writebackTargets ?? []) {
      if (!writebackTarget.ok || !isControlledPlaybookWriteTarget(writebackTarget.target)) {
        continue;
      }
      const missingFields = getMissingStableMetadataFields(writebackTarget);
      if (missingFields.length === 0) continue;
      writebackTargetsMissingStableMetadata.push({
        stepId: playbookStep.id,
        target: writebackTarget.target,
        missingFields,
      });
      for (const field of missingFields) {
        errors.push(
          `Step ${playbookStep.id} writeback target ${writebackTarget.target} is missing stable metadata ${field}`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    fixtureId: fixture.fixtureId,
    playbookId: fixture.playbookId,
    checkedStepIds,
    errors,
    warnings: [],
    diagnostics: {
      ...baseDiagnostics,
      expectedPlaybookVersion: playbook.version,
      expectedScenarioId: playbook.scenarioId,
      expectedPlanId,
      expectedPlanTotalSteps,
      expectedPlanRequiresApproval,
      expectedStepOrder: playbookStepIds,
      missingApprovalStepIds,
      missingWritebackTargets,
      missingCompletedStepAttempts,
      nonApprovedApprovalStepIds,
      writebackTargetsMissingStableMetadata,
    },
    guarantees: {
      toolCallsExecuted: false,
      assetsWritten: false,
    },
  };
}
