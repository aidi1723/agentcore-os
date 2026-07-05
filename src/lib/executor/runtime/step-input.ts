import type { AgentCoreTaskRequest, ExecutionStep, StepResult } from "@/lib/executor/contracts";

function pickWorkflowContext(workspace?: Record<string, unknown> | null) {
  return {
    workflowRunId: typeof workspace?.workflowRunId === "string" ? workspace.workflowRunId : undefined,
    activeScenarioId:
      typeof workspace?.activeScenarioId === "string" ? workspace.activeScenarioId : undefined,
  };
}

export function buildControlledStepInput(input: {
  request: AgentCoreTaskRequest;
  step: ExecutionStep;
  stepIndex: number;
  previousResults: StepResult[];
}) {
  const previousOutputs = Object.fromEntries(
    input.previousResults
      .filter((result) => result.status === "completed")
      .map((result) => [result.stepId, result.output]),
  );

  return {
    request: {
      message: input.request.taskInput.userMessage,
      sessionId: input.request.session.id,
      requestId: input.request.metadata.requestId,
      source: input.request.metadata.source,
    },
    workflow: pickWorkflowContext(input.request.context.workspace),
    step: {
      id: input.step.id,
      title: input.step.title,
      description: input.step.description,
      mode: input.step.mode,
      dependsOn: input.step.dependsOn,
      index: input.stepIndex,
    },
    previousOutputs,
  };
}
