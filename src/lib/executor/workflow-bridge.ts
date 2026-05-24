/**
 * Bridge between the multi-step execution engine and the workflow-runs system.
 * Converts workflow stages into execution steps and synchronizes state.
 */
import type { ExecutionStep, ToolCallSpec } from "@/lib/executor/contracts";
import type { WorkspaceScenario } from "@/lib/workspace-presets";

export type WorkflowStageExtended = WorkspaceScenario["workflowStages"][number] & {
  tools?: string[];
  maxRetries?: number;
  timeoutMs?: number;
};

/**
 * Convert a WorkspaceScenario's workflow stages into ExecutionSteps
 * for the multi-step engine.
 */
export function workflowStagesToExecutionSteps(
  stages: WorkflowStageExtended[],
): ExecutionStep[] {
  return stages.map((stage, index): ExecutionStep => {
    const toolCalls: ToolCallSpec[] = (stage.tools ?? ["llm_generate"]).map(
      (toolName) => ({ toolName }),
    );

    return {
      id: stage.id,
      title: stage.title,
      description: stage.desc ?? stage.title,
      toolCalls,
      dependsOn: index > 0 ? [stages[index - 1].id] : [],
      mode: stage.mode,
      estimatedTokens: undefined,
    };
  });
}

/**
 * Map a step result status back to a workflow stage run state.
 */
export function stepStatusToStageState(
  status: "completed" | "failed" | "skipped" | "awaiting_approval",
): "pending" | "running" | "awaiting_human" | "completed" | "error" {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "error";
    case "skipped":
      return "pending";
    case "awaiting_approval":
      return "awaiting_human";
  }
}

/**
 * Determine if a workflow scenario is eligible for multi-step execution.
 * Scenarios with 2+ stages that have defined modes are good candidates.
 */
export function isMultiStepEligible(scenario: WorkspaceScenario): boolean {
  return (
    Array.isArray(scenario.workflowStages) &&
    scenario.workflowStages.length >= 2
  );
}
