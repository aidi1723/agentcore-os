import type { ExecutionPlan, ExecutionStep } from "@/lib/executor/contracts";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

function buildPlanId(playbook: ControlledPlaybook) {
  return `playbook:${playbook.id}:${playbook.version}`;
}

export function resolveExecutionPlanFromPlaybook(playbook: ControlledPlaybook): ExecutionPlan {
  const steps: ExecutionStep[] = playbook.steps.map((step, index) => ({
    id: step.id,
    title: step.title,
    description: [
      step.purpose,
      "",
      "Acceptance criteria:",
      ...step.acceptanceCriteria.map((item) => `- ${item}`),
    ].join("\n"),
    toolCalls:
      step.toolCalls && step.toolCalls.length > 0
        ? step.toolCalls
        : step.allowedTools.slice(0, 1).map((toolName) => ({ toolName })),
    dependsOn: index > 0 ? [playbook.steps[index - 1].id] : [],
    mode: step.mode,
    outputSchema: step.outputSchema,
    onFailure: step.onFailure,
  }));

  return {
    id: buildPlanId(playbook),
    goal: playbook.title,
    steps,
    totalSteps: steps.length,
    requiresApproval: playbook.steps.some((step) => step.requiresApproval),
  };
}
