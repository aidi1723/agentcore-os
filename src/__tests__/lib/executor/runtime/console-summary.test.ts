import { describe, expect, it } from "vitest";

import { buildControlledRunConsoleSummary } from "@/lib/executor/runtime/console-summary";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";

function makeRun(): ControlledExecutionRunRecord {
  return {
    id: "run-console-1",
    requestId: "run-console-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-1",
    state: "completed",
    currentStepId: "writeback",
    createdAt: 100,
    updatedAt: 200,
    finishedAt: 220,
    plan: {
      id: "plan-1",
      goal: "Sales follow-up",
      totalSteps: 3,
      requiresApproval: true,
      steps: [
        {
          id: "intake",
          title: "Intake",
          description: "Collect lead",
          toolCalls: [],
          dependsOn: [],
          mode: "assist",
        },
        {
          id: "human_review",
          title: "Human review",
          description: "Review draft",
          toolCalls: [],
          dependsOn: ["intake"],
          mode: "review",
        },
        {
          id: "writeback",
          title: "Writeback",
          description: "Persist assets",
          toolCalls: [],
          dependsOn: ["human_review"],
          mode: "manual",
        },
      ],
    },
    steps: [
      {
        stepId: "intake",
        state: "completed",
        input: { lead: true },
        output: { summary: "lead" },
        attempts: 1,
        toolCallResults: [],
        schemaValidation: { valid: true, errors: [], checkedAt: 150 },
        writebackReceipts: [
          {
            target: "workflow_run",
            ok: false,
            summary: "Skipped unsupported writeback target workflow_run",
            writtenAt: 160,
          },
        ],
      },
      {
        stepId: "human_review",
        state: "completed",
        input: { draft: true },
        output: { approved: true },
        attempts: 1,
        toolCallResults: [],
        approval: {
          executionId: "run-console-1",
          stepId: "human_review",
          state: "approved",
          requestedAt: 170,
          resolvedAt: 180,
          feedback: "ok",
          approver: "local_user",
        },
        writebackReceipts: [],
      },
      {
        stepId: "writeback",
        state: "completed",
        input: { approved: true },
        output: { salesAssetUpdated: true },
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary: "Wrote sales asset controlled-sales-asset:workflow-1 for workflow workflow-1",
            writtenAt: 210,
          },
          {
            target: "knowledge_asset",
            ok: true,
            summary:
              "Wrote knowledge asset controlled-knowledge-asset:run-console-1 from controlled-run:run-console-1:knowledge_asset",
            writtenAt: 211,
          },
        ],
      },
    ],
  };
}

describe("buildControlledRunConsoleSummary", () => {
  it("summarizes controlled run trace, approvals, writeback, and asset landings", () => {
    const summary = buildControlledRunConsoleSummary(makeRun());

    expect(summary.id).toBe("run-console-1");
    expect(summary.title).toBe("Sales follow-up");
    expect(summary.completedSteps).toBe(3);
    expect(summary.awaitingApprovalSteps).toBe(0);
    expect(summary.failedSteps).toBe(0);
    expect(summary.approvalCount).toBe(1);
    expect(summary.writebackReceiptCount).toBe(3);
    expect(summary.assetLandings).toEqual([
      {
        target: "sales_asset",
        label: "Sales asset",
        detail: "Wrote sales asset controlled-sales-asset:workflow-1 for workflow workflow-1",
        ok: true,
      },
      {
        target: "knowledge_asset",
        label: "Knowledge asset",
        detail:
          "Wrote knowledge asset controlled-knowledge-asset:run-console-1 from controlled-run:run-console-1:knowledge_asset",
        ok: true,
      },
    ]);

    expect(summary.steps.map((step) => step.id)).toEqual([
      "intake",
      "human_review",
      "writeback",
    ]);
    expect(summary.steps[0]).toMatchObject({
      id: "intake",
      title: "Intake",
      state: "completed",
      schemaValid: true,
      receiptCount: 1,
    });
    expect(summary.steps[1]).toMatchObject({
      id: "human_review",
      approvalState: "approved",
      approvalFeedback: "ok",
    });
    expect(summary.steps[2].writebackReceipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
    ]);
  });
});
