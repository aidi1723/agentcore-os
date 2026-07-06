import { describe, expect, it } from "vitest";
import type { ControlledTraceArtifact } from "@/lib/executor/runtime/trace-governance";
import {
  buildControlledTraceFixture,
  validateControlledTraceFixture,
} from "@/lib/executor/runtime/trace-fixtures";
import sampleFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";

const redacted = { redacted: true, reason: "trace_governance" as const, summary: "object(keys=raw)" };

function makeStep(
  stepId: string,
  options: Partial<ControlledTraceArtifact["steps"][number]> = {},
): ControlledTraceArtifact["steps"][number] {
  return {
    stepId,
    state: "completed",
    startedAt: 100,
    finishedAt: 120,
    input: redacted,
    output: redacted,
    attempts: 1,
    toolCallResults: [
      {
        toolName: "llm_generate",
        success: true,
        output: redacted,
        durationMs: 12,
        tokensUsed: 5,
      },
    ],
    writebackReceipts: [],
    ...options,
  };
}

function makeGovernedSalesArtifact(): ControlledTraceArtifact {
  return {
    id: "run-fixture-1",
    requestId: "req-fixture-1",
    sessionId: "session-1",
    workflowRunId: "workflow-fixture-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "playbook:sales-pipeline-v1:1.0.0",
    state: "completed",
    currentStepId: "writeback",
    createdAt: 100,
    updatedAt: 200,
    finishedAt: 220,
    governance: {
      mode: "fixture",
      redactedAt: 210,
      policy: {
        mode: "fixture",
        includePlan: true,
        includeStepInput: false,
        includeStepOutput: false,
        includeToolOutputs: false,
        maxStringLength: 240,
      },
    },
    auditEvents: [
      {
        id: "audit-1",
        type: "console_retry_requested",
        stepId: "qualify",
        createdAt: 180,
        actor: "local_user",
      },
    ],
    plan: {
      id: "playbook:sales-pipeline-v1:1.0.0",
      goal: { redacted: true, reason: "trace_governance", summary: "string(length=10)" },
      totalSteps: 5,
      requiresApproval: true,
      steps: [
        {
          id: "intake",
          title: "Intake",
          dependsOn: [],
          mode: "assist",
          writesTo: [],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "qualify",
          title: "Qualify",
          dependsOn: ["intake"],
          mode: "assist",
          writesTo: [{ target: "sales_asset", when: "on_success" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "draft_outreach",
          title: "Draft",
          dependsOn: ["qualify"],
          mode: "assist",
          writesTo: [{ target: "draft", when: "on_success" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "human_review",
          title: "Review",
          dependsOn: ["draft_outreach"],
          mode: "review",
          writesTo: [{ target: "workflow_run", when: "after_approval" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
        {
          id: "writeback",
          title: "Writeback",
          dependsOn: ["human_review"],
          mode: "manual",
          writesTo: [{ target: "sales_asset", when: "after_approval" }],
          toolCallCount: 1,
          hasInputSchema: true,
          hasOutputSchema: true,
        },
      ],
    },
    steps: [
      makeStep("intake"),
      makeStep("qualify"),
      makeStep("draft_outreach", {
        writebackReceipts: [
          {
            target: "draft",
            ok: true,
            summary: "Wrote draft controlled-draft:workflow-fixture-1",
            writtenAt: 130,
            assetId: "controlled-draft:workflow-fixture-1",
            sourceKey: "controlled-run:run-fixture-1:draft",
            workflowRunId: "workflow-fixture-1",
          },
        ],
      }),
      makeStep("human_review", {
        approval: {
          executionId: "run-fixture-1",
          stepId: "human_review",
          state: "approved",
          requestedAt: 140,
          resolvedAt: 150,
          feedback: redacted,
          approver: "local_user",
        },
      }),
      makeStep("writeback", {
        schemaValidation: {
          valid: true,
          errors: [],
          checkedAt: 160,
        },
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary: "Wrote sales asset sales-asset-1",
            writtenAt: 170,
            assetId: "sales-asset-1",
            sourceKey: "controlled-run:run-fixture-1:sales_asset",
            workflowRunId: "workflow-fixture-1",
          },
        ],
      }),
    ],
  };
}

describe("trace fixtures", () => {
  it("builds a safe fixture from a governed sales trace artifact", () => {
    const fixture = buildControlledTraceFixture(makeGovernedSalesArtifact(), {
      generatedAt: 300,
    });
    const serialized = JSON.stringify(fixture);

    expect(fixture.schemaVersion).toBe("controlled-trace-fixture/v1");
    expect(fixture.sourceRunId).toBe("run-fixture-1");
    expect(fixture.assertions.stepOrder).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(fixture.assertions.knownPlaybookMatched).toBe(true);
    expect(fixture.steps[3].approvalState).toBe("approved");
    expect(fixture.steps[4].schemaValid).toBe(true);
    expect(fixture.steps[4].writebackTargets[0]).toMatchObject({
      target: "sales_asset",
      ok: true,
      assetId: "sales-asset-1",
    });
    expect(validateControlledTraceFixture(fixture)).toEqual({ ok: true, errors: [] });
    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-fixture-secret");
  });

  it("rejects fixtures that do not preserve redaction boundaries", () => {
    const fixture = buildControlledTraceFixture(makeGovernedSalesArtifact(), {
      generatedAt: 300,
    });
    fixture.steps[0].hasRedactedInput = false;

    expect(validateControlledTraceFixture(fixture)).toEqual({
      ok: false,
      errors: ["Step intake input is not redacted"],
    });
  });

  it("validates the committed governed sales trace fixture", () => {
    const serialized = JSON.stringify(sampleFixture);

    expect(validateControlledTraceFixture(sampleFixture)).toEqual({ ok: true, errors: [] });
    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-fixture-secret");
  });
});
