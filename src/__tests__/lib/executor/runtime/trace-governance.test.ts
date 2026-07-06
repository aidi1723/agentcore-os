import { describe, expect, it } from "vitest";
import { buildControlledTraceArtifact } from "@/lib/executor/runtime/trace-governance";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";

function makeSensitiveRun(): ControlledExecutionRunRecord {
  return {
    id: "run-governed-1",
    requestId: "req-governed-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-governed-1",
    state: "completed",
    currentStepId: "writeback",
    createdAt: 100,
    updatedAt: 200,
    finishedAt: 250,
    error: "password=hunter2 should not leak",
    auditEvents: [
      {
        id: "audit-1",
        type: "console_retry_requested",
        stepId: "intake",
        message: "Retry for Nora with token=abcdefghi",
        createdAt: 180,
        actor: "local_user",
      },
    ],
    plan: {
      id: "plan-governed-1",
      goal: "Follow up with Nora",
      totalSteps: 1,
      requiresApproval: true,
      steps: [
        {
          id: "intake",
          title: "Intake",
          description: "Collect customer details",
          toolCalls: [{ toolName: "llm_generate" }],
          dependsOn: [],
          mode: "auto",
          writesTo: [{ target: "sales_asset", when: "on_success" }],
          onFailure: { action: "retry", maxRetries: 1 },
        },
      ],
    },
    steps: [
      {
        stepId: "intake",
        state: "completed",
        startedAt: 110,
        finishedAt: 160,
        input: {
          customer: "Nora",
          message: "api_key=sk-test-secret customer complaint",
        },
        output: {
          draft: "Call Nora at nora@example.com",
          token: "Bearer abcdefghij",
        },
        error: "password=hunter2",
        attempts: 1,
        toolCallResults: [
          {
            toolName: "llm_generate",
            success: true,
            output: {
              text: "Draft for Nora with Authorization: Bearer abcdefghij",
            },
            sideEffects: ["none"],
            tokensUsed: 42,
            durationMs: 1200,
          },
        ],
        approval: {
          executionId: "run-governed-1",
          stepId: "intake",
          state: "approved",
          requestedAt: 130,
          resolvedAt: 140,
          feedback: "Approved for Nora; secret=abcdefghi",
          approver: "local_user",
        },
        schemaValidation: {
          valid: false,
          errors: ["Nora email nora@example.com had token=abcdefghi"],
          checkedAt: 150,
        },
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary:
              "Wrote sales asset controlled-sales-asset:workflow-1 after token=abcdefghi",
            writtenAt: 170,
            assetId: "controlled-sales-asset:workflow-1",
            sourceKey: "controlled-run:run-governed-1:sales_asset",
            workflowRunId: "workflow-1",
          },
        ],
      },
    ],
  };
}

describe("trace governance", () => {
  it("redacts sensitive step payloads while preserving audit metadata", () => {
    const run = makeSensitiveRun();
    const artifact = buildControlledTraceArtifact(run);
    const serialized = JSON.stringify(artifact);

    expect(serialized).not.toContain("nora@example.com");
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).not.toContain("abcdefghij");
    expect(serialized).not.toContain("hunter2");
    expect(artifact.id).toBe("run-governed-1");
    expect(artifact.playbookId).toBe("sales-pipeline-v1");
    expect(artifact.workflowRunId).toBe("workflow-1");
    expect(artifact.plan?.steps[0]).toMatchObject({
      id: "intake",
      title: "Intake",
      mode: "auto",
      writesTo: [{ target: "sales_asset", when: "on_success" }],
    });
    expect(artifact.steps[0].input).toMatchObject({
      redacted: true,
      reason: "trace_governance",
    });
    expect(artifact.steps[0].output).toMatchObject({
      redacted: true,
      reason: "trace_governance",
    });
    expect(artifact.steps[0].toolCallResults[0]).toMatchObject({
      toolName: "llm_generate",
      success: true,
      durationMs: 1200,
      tokensUsed: 42,
      output: { redacted: true, reason: "trace_governance" },
    });
    expect(artifact.steps[0].approval).toMatchObject({
      executionId: "run-governed-1",
      stepId: "intake",
      state: "approved",
      approver: "local_user",
    });
    expect(artifact.steps[0].approval?.feedback).toMatchObject({
      redacted: true,
      reason: "trace_governance",
    });
    expect(artifact.steps[0].writebackReceipts[0]).toMatchObject({
      target: "sales_asset",
      ok: true,
      assetId: "controlled-sales-asset:workflow-1",
      sourceKey: "controlled-run:run-governed-1:sales_asset",
      workflowRunId: "workflow-1",
    });
    expect(artifact.auditEvents[0]).toMatchObject({
      id: "audit-1",
      type: "console_retry_requested",
      stepId: "intake",
      actor: "local_user",
    });
    expect(artifact.auditEvents[0].message).toMatchObject({
      redacted: true,
      reason: "trace_governance",
    });
  });

  it("does not mutate the source run", () => {
    const run = makeSensitiveRun();

    buildControlledTraceArtifact(run);

    expect(run.steps[0].input).toEqual({
      customer: "Nora",
      message: "api_key=sk-test-secret customer complaint",
    });
    expect(run.steps[0].toolCallResults[0].output).toEqual({
      text: "Draft for Nora with Authorization: Bearer abcdefghij",
    });
  });
});
