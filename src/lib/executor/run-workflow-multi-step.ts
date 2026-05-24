/**
 * Client-side orchestrator that runs a workflow scenario through the multi-step engine
 * and synchronizes state back to the workflow-runs store.
 */
import type { WorkspaceScenario } from "@/lib/workspace-presets";
import {
  advanceWorkflowRun,
  completeWorkflowRun,
  failWorkflowRun,
} from "@/lib/workflow-runs";
import {
  isMultiStepEligible,
  workflowStagesToExecutionSteps,
} from "@/lib/executor/workflow-bridge";
import type { StepResult } from "@/lib/executor/contracts";
import { buildAgentCoreApiUrl } from "@/lib/app-api";

export type WorkflowMultiStepOptions = {
  runId: string;
  scenario: WorkspaceScenario;
  onStepComplete?: (result: StepResult) => void;
  onError?: (error: string) => void;
};

/**
 * Execute a workflow run via the multi-step SSE stream endpoint.
 * Falls back to legacy stage-by-stage advance if the scenario isn't eligible.
 */
export async function runWorkflowMultiStep(options: WorkflowMultiStepOptions): Promise<boolean> {
  const { runId, scenario, onStepComplete, onError } = options;

  if (!isMultiStepEligible(scenario)) {
    return false; // caller should use legacy path
  }

  const steps = workflowStagesToExecutionSteps(scenario.workflowStages);

  try {
    const res = await fetch(buildAgentCoreApiUrl("/api/agent/stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Execute workflow: ${scenario.title}`,
        workflowRunId: runId,
        maxSteps: steps.length,
        approvalMode: "each-review-step",
      }),
    });

    if (!res.ok || !res.body) {
      failWorkflowRun(runId);
      onError?.(`Stream failed: HTTP ${res.status}`);
      return true;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completedSteps = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ") && eventType) {
          const data = JSON.parse(line.slice(6));

          if (eventType === "step_complete") {
            completedSteps++;
            const result = data as StepResult;
            if (result.status === "completed") {
              advanceWorkflowRun(runId);
            }
            onStepComplete?.(result);
          } else if (eventType === "error") {
            failWorkflowRun(runId);
            onError?.(data.error);
          } else if (eventType === "execution_done") {
            completeWorkflowRun(runId);
          }

          eventType = "";
        }
      }
    }

    if (completedSteps === steps.length) {
      completeWorkflowRun(runId);
    }

    return true;
  } catch (err) {
    failWorkflowRun(runId);
    onError?.(err instanceof Error ? err.message : String(err));
    return true;
  }
}
