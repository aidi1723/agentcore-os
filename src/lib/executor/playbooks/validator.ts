import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";
import { getTool } from "@/lib/executor/tools";

export type ControlledPlanValidationResult = {
  valid: boolean;
  errors: string[];
};

function hasObjectSchema(schema: unknown) {
  return Boolean(
    schema &&
      typeof schema === "object" &&
      (schema as { type?: unknown }).type === "object",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function arraysEqual(left: unknown[], right: unknown[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateExecutionPlanAgainstPlaybook(
  plan: unknown,
  playbook: ControlledPlaybook,
): ControlledPlanValidationResult {
  if (!isRecord(plan)) {
    return {
      valid: false,
      errors: ["Plan must be an object"],
    };
  }

  if (!Array.isArray(plan.steps)) {
    return {
      valid: false,
      errors: ["Plan steps must be an array"],
    };
  }

  const errors: string[] = [];
  const stepById = new Map(playbook.steps.map((step) => [step.id, step]));
  const expectedStepIds = playbook.steps.map((step) => step.id);
  const actualStepIds = plan.steps.map((step) => (isRecord(step) ? step.id : undefined));
  const seenPlanStepIds = new Set<string>();

  if (plan.totalSteps !== plan.steps.length) {
    errors.push(`Plan totalSteps ${plan.totalSteps} does not match step count ${plan.steps.length}`);
  }
  if (!arraysEqual(actualStepIds, expectedStepIds)) {
    errors.push("Plan step order must match playbook steps");
  }

  for (const step of plan.steps) {
    if (!isRecord(step)) {
      errors.push("Plan step must be an object");
      continue;
    }
    const stepId = typeof step.id === "string" ? step.id : "";

    if (seenPlanStepIds.has(stepId)) {
      errors.push(`Duplicate plan step id: ${stepId}`);
    }
    seenPlanStepIds.add(stepId);

    const contract = stepById.get(stepId);
    if (!contract) {
      errors.push(`Unknown step: ${stepId}`);
      continue;
    }

    if (!hasObjectSchema(contract.inputSchema)) {
      errors.push(`Step ${stepId} is missing object input schema`);
    }
    if (!hasObjectSchema(contract.outputSchema)) {
      errors.push(`Step ${stepId} is missing object output schema`);
    }

    if ((contract.mode === "review" || contract.mode === "manual") && !contract.requiresApproval) {
      errors.push(`Step ${stepId} must require approval`);
    }
    if (step.mode !== contract.mode) {
      errors.push(`Step ${stepId} mode must be ${contract.mode}`);
    }

    const playbookStepIndex = playbook.steps.findIndex((playbookStep) => playbookStep.id === stepId);
    const expectedDependsOn = playbookStepIndex > 0 ? [playbook.steps[playbookStepIndex - 1].id] : [];
    if (!Array.isArray(step.dependsOn) || !arraysEqual(step.dependsOn, expectedDependsOn)) {
      if (expectedDependsOn.length === 0) {
        errors.push(`Step ${stepId} dependsOn must be empty`);
      } else {
        errors.push(`Step ${stepId} dependsOn must be ${expectedDependsOn[0]}`);
      }
    }

    const allowedTools = new Set(contract.allowedTools);
    const forbiddenTools = new Set(contract.forbiddenTools ?? []);
    if (!Array.isArray(step.toolCalls)) {
      errors.push(`Step ${stepId} toolCalls must be an array`);
      continue;
    }

    const expectedToolCalls =
      contract.toolCalls && contract.toolCalls.length > 0
        ? contract.toolCalls
        : contract.allowedTools.slice(0, 1).map((toolName) => ({ toolName }));
    if (!arraysEqual(step.toolCalls, expectedToolCalls)) {
      errors.push(`Step ${stepId} toolCalls must match playbook toolCalls`);
    }

    for (const toolCall of step.toolCalls) {
      if (!isRecord(toolCall) || typeof toolCall.toolName !== "string") {
        errors.push(`Step ${stepId} references unknown tool: undefined`);
        continue;
      }
      if (!allowedTools.has(toolCall.toolName)) {
        errors.push(`Step ${stepId} uses disallowed tool: ${toolCall.toolName}`);
      }
      if (forbiddenTools.has(toolCall.toolName)) {
        errors.push(`Step ${stepId} uses forbidden tool: ${toolCall.toolName}`);
      }
      if (!getTool(toolCall.toolName)) {
        errors.push(`Step ${stepId} references unknown tool: ${toolCall.toolName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateControlledPlaybook(
  playbook: ControlledPlaybook,
): ControlledPlanValidationResult {
  const errors: string[] = [];
  const seenStepIds = new Set<string>();

  for (const step of playbook.steps) {
    if (seenStepIds.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    }
    seenStepIds.add(step.id);

    if ((step.mode === "review" || step.mode === "manual") && !step.requiresApproval) {
      errors.push(`Step ${step.id} must require approval`);
    }
    if (!hasObjectSchema(step.inputSchema)) {
      errors.push(`Step ${step.id} is missing object input schema`);
    }
    if (!hasObjectSchema(step.outputSchema)) {
      errors.push(`Step ${step.id} is missing object output schema`);
    }
    if (step.allowedTools.length === 0) {
      errors.push(`Step ${step.id} must allow at least one tool`);
    }

    const allowedTools = new Set(step.allowedTools);
    const forbiddenTools = new Set(step.forbiddenTools ?? []);
    for (const toolCall of step.toolCalls ?? []) {
      if (!allowedTools.has(toolCall.toolName)) {
        errors.push(`Step ${step.id} declares disallowed toolCall: ${toolCall.toolName}`);
      }
      if (forbiddenTools.has(toolCall.toolName)) {
        errors.push(`Step ${step.id} declares forbidden toolCall: ${toolCall.toolName}`);
      }
      if (!getTool(toolCall.toolName)) {
        errors.push(`Step ${step.id} declares unknown toolCall: ${toolCall.toolName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
