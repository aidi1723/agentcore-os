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
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
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
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    };
  }

  const playbookStepIds = playbook.steps.map((step) => step.id);
  if (!arraysEqual(checkedStepIds, playbookStepIds)) {
    errors.push(`Fixture step order does not match current playbook ${fixture.playbookId}`);
  }

  const fixtureStepsById = new Map(fixture.steps.map((step) => [step.stepId, step]));
  for (const playbookStep of playbook.steps) {
    const fixtureStep = fixtureStepsById.get(playbookStep.id);
    if (playbookStep.requiresApproval && !fixtureStep?.approvalState) {
      errors.push(`Step ${playbookStep.id} requires approval but fixture has no approval state`);
    }
    for (const writeback of playbookStep.writesTo ?? []) {
      if (!hasWritebackTarget(fixtureStep, writeback.target)) {
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
    guarantees: {
      toolCallsExecuted: false,
      assetsWritten: false,
    },
  };
}
