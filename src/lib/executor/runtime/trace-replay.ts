import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import type { ControlledPlaybookWriteTarget } from "@/lib/executor/playbooks/types";
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

export type ControlledTraceReplayDiagnostics = {
  fixtureId: string;
  playbookId: string;
  expectedStepOrder: string[];
  fixtureStepOrder: string[];
  missingApprovalStepIds: string[];
  missingWritebackTargets: ControlledTraceReplayMissingWritebackTarget[];
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

export function replayControlledTraceFixture(
  fixture: ControlledTraceFixture,
): ControlledTraceReplayReport {
  const checkedStepIds = fixture.steps.map((step) => step.stepId);
  const baseDiagnostics = {
    fixtureId: fixture.fixtureId,
    playbookId: fixture.playbookId,
    fixtureStepOrder: checkedStepIds,
    missingApprovalStepIds: [],
    missingWritebackTargets: [],
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
      expectedStepOrder: playbookStepIds,
      missingApprovalStepIds,
      missingWritebackTargets,
    },
    guarantees: {
      toolCallsExecuted: false,
      assetsWritten: false,
    },
  };
}
