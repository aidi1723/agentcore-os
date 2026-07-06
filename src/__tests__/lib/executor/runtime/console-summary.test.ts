import { describe, expect, it } from "vitest";

import {
  buildControlledRunConsoleSummary,
  filterControlledRunConsoleSummaries,
} from "@/lib/executor/runtime/console-summary";
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
    auditEvents: [],
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
            ok: true,
            summary: "Wrote workflow run workflow-1 as completed",
            writtenAt: 160,
            sourceKey: "controlled-run:run-console-1:workflow_run",
            workflowRunId: "workflow-1",
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
        writebackReceipts: [
          {
            target: "draft",
            ok: true,
            summary: "Wrote draft controlled-draft:workflow-1",
            writtenAt: 190,
            assetId: "controlled-draft:workflow-1",
            sourceKey: "controlled-run:run-console-1:draft",
            workflowRunId: "workflow-1",
          },
        ],
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
            assetId: "controlled-sales-asset:workflow-1",
            workflowRunId: "workflow-1",
          },
          {
            target: "knowledge_asset",
            ok: true,
            summary:
              "Wrote knowledge asset controlled-knowledge-asset:run-console-1 from controlled-run:run-console-1:knowledge_asset",
            writtenAt: 211,
            assetId: "controlled-knowledge-asset:run-console-1",
            sourceKey: "controlled-run:run-console-1:knowledge_asset",
            workflowRunId: "workflow-1",
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
    expect(summary.auditEventCount).toBe(0);
    expect(summary.writebackReceiptCount).toBe(4);
    expect(summary.assetLandings).toEqual([
      {
        target: "workflow_run",
        label: "Workflow run",
        detail: "Wrote workflow run workflow-1 as completed",
        ok: true,
        sourceKey: "controlled-run:run-console-1:workflow_run",
        workflowRunId: "workflow-1",
        appId: "industry_hub",
      },
      {
        target: "draft",
        label: "Draft",
        detail: "Wrote draft controlled-draft:workflow-1",
        ok: true,
        assetId: "controlled-draft:workflow-1",
        sourceKey: "controlled-run:run-console-1:draft",
        workflowRunId: "workflow-1",
        appId: "publisher",
      },
      {
        target: "sales_asset",
        label: "Sales asset",
        detail: "Wrote sales asset controlled-sales-asset:workflow-1 for workflow workflow-1",
        ok: true,
        assetId: "controlled-sales-asset:workflow-1",
        sourceKey: undefined,
        workflowRunId: "workflow-1",
        appId: "deal_desk",
      },
      {
        target: "knowledge_asset",
        label: "Knowledge asset",
        detail:
          "Wrote knowledge asset controlled-knowledge-asset:run-console-1 from controlled-run:run-console-1:knowledge_asset",
        ok: true,
        assetId: "controlled-knowledge-asset:run-console-1",
        sourceKey: "controlled-run:run-console-1:knowledge_asset",
        workflowRunId: "workflow-1",
        appId: "knowledge_vault",
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
      receiptCount: 1,
    });
    expect(summary.steps[2].writebackReceipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
    ]);
  });

  it("marks pending approval and resumable controlled runs", () => {
    const run = makeRun();
    run.state = "awaiting_approval";
    run.currentStepId = "human_review";
    run.steps[1] = {
      ...run.steps[1],
      state: "awaiting_approval",
      approval: {
        executionId: "run-console-1",
        stepId: "human_review",
        state: "pending",
        requestedAt: 170,
      },
    };

    const summary = buildControlledRunConsoleSummary(run);

    expect(summary.pendingApprovalStepId).toBe("human_review");
    expect(summary.canApprove).toBe(true);
    expect(summary.canResume).toBe(false);
  });

  it("marks non-terminal runs without pending approval as resumable", () => {
    const run = makeRun();
    run.state = "running";
    run.currentStepId = "writeback";

    const summary = buildControlledRunConsoleSummary(run);

    expect(summary.pendingApprovalStepId).toBeUndefined();
    expect(summary.canApprove).toBe(false);
    expect(summary.canResume).toBe(true);
  });

  it("marks retryable failed controlled runs", () => {
    const run = makeRun();
    run.state = "failed";
    run.currentStepId = "intake";
    run.error = "temporary failure";
    run.auditEvents = [
      {
        id: "audit-1",
        type: "console_retry_requested",
        stepId: "intake",
        message: "Retry from console",
        createdAt: 230,
        actor: "local_user",
      },
    ];
    run.plan.steps[0] = {
      ...run.plan.steps[0],
      onFailure: { action: "retry", maxRetries: 1 },
    };
    run.steps[0] = {
      ...run.steps[0],
      state: "failed",
      error: "temporary failure",
    };

    const summary = buildControlledRunConsoleSummary(run);

    expect(summary.failedStepId).toBe("intake");
    expect(summary.canRetry).toBe(true);
    expect(summary.retryReason).toBeUndefined();
    expect(summary.auditEventCount).toBe(1);
  });

  it("explains non-retryable failed controlled runs", () => {
    const run = makeRun();
    run.state = "failed";
    run.currentStepId = "writeback";
    run.steps[2] = {
      ...run.steps[2],
      state: "failed",
      error: "writeback failed",
    };

    const summary = buildControlledRunConsoleSummary(run);

    expect(summary.failedStepId).toBe("writeback");
    expect(summary.canRetry).toBe(false);
    expect(summary.retryReason).toBe("Failed step is not retryable");
    expect(summary.auditEventCount).toBe(0);
  });

  it("filters controlled run summaries by state and query", () => {
    const completed = buildControlledRunConsoleSummary(makeRun());
    const awaitingRun = makeRun();
    awaitingRun.id = "run-awaiting";
    awaitingRun.workflowRunId = "workflow-awaiting";
    awaitingRun.state = "awaiting_approval";
    awaitingRun.playbookId = "support-playbook";
    awaitingRun.plan = { ...awaitingRun.plan, goal: "Support follow-up" };
    awaitingRun.steps[0] = {
      ...awaitingRun.steps[0],
      writebackReceipts: [],
    };
    awaitingRun.steps[1] = {
      ...awaitingRun.steps[1],
      writebackReceipts: [],
    };
    awaitingRun.steps[2] = {
      ...awaitingRun.steps[2],
      writebackReceipts: [
        {
          target: "sales_asset",
          ok: true,
          summary:
            "Wrote sales asset controlled-sales-asset:workflow-awaiting for workflow workflow-awaiting",
          writtenAt: 210,
          assetId: "controlled-sales-asset:workflow-awaiting",
          workflowRunId: "workflow-awaiting",
        },
      ],
    };
    const awaiting = buildControlledRunConsoleSummary(awaitingRun);

    expect(
      filterControlledRunConsoleSummaries([completed, awaiting], {
        state: "awaiting_approval",
        query: "",
      }).map((summary) => summary.id),
    ).toEqual(["run-awaiting"]);

    expect(
      filterControlledRunConsoleSummaries([completed, awaiting], {
        state: "all",
        query: "workflow-1",
      }).map((summary) => summary.id),
    ).toEqual(["run-console-1"]);

    expect(
      filterControlledRunConsoleSummaries([completed, awaiting], {
        state: "all",
        query: "support-playbook",
      }).map((summary) => summary.id),
    ).toEqual(["run-awaiting"]);

    expect(
      filterControlledRunConsoleSummaries([completed, awaiting], {
        state: "all",
        query: "controlled-knowledge-asset:run-console-1",
      }).map((summary) => summary.id),
    ).toEqual(["run-console-1"]);

    expect(
      filterControlledRunConsoleSummaries([completed, awaiting], {
        state: "all",
        query: "controlled-draft:workflow-1",
      }).map((summary) => summary.id),
    ).toEqual(["run-console-1"]);

    expect(
      filterControlledRunConsoleSummaries([completed, awaiting], {
        state: "all",
        query: "Workflow run",
      }).map((summary) => summary.id),
    ).toEqual(["run-console-1"]);
  });
});
