import { describe, expect, it } from "vitest";
import type { AgentCoreTaskRequest, StepResult } from "@/lib/executor/contracts";
import { buildControlledStepInput } from "@/lib/executor/runtime/step-input";

function makeRequest(): AgentCoreTaskRequest {
  return {
    taskInput: { userMessage: "Lead from website" },
    session: { id: "session-1" },
    metadata: { requestId: "req-1", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { workflowRunId: "workflow-1", activeScenarioId: "sales-pipeline" },
    },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {
      timeoutSeconds: 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
  };
}

describe("buildControlledStepInput", () => {
  it("combines request context, step metadata, and previous outputs", () => {
    const previousResults: StepResult[] = [
      {
        stepId: "intake",
        status: "completed",
        output: { normalizedLead: { company: "ACME" } },
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 1,
      },
    ];

    const input = buildControlledStepInput({
      request: makeRequest(),
      step: {
        id: "qualify",
        title: "Qualify",
        description: "Qualify lead",
        mode: "assist",
        dependsOn: ["intake"],
        toolCalls: [{ toolName: "llm_generate" }],
      },
      stepIndex: 1,
      previousResults,
    });

    expect(input).toMatchObject({
      request: {
        message: "Lead from website",
        sessionId: "session-1",
        requestId: "req-1",
      },
      workflow: {
        workflowRunId: "workflow-1",
        activeScenarioId: "sales-pipeline",
      },
      step: {
        id: "qualify",
        index: 1,
        dependsOn: ["intake"],
      },
      previousOutputs: {
        intake: { normalizedLead: { company: "ACME" } },
      },
    });
  });
});
