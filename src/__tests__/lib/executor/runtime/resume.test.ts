import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerTool } from "@/lib/executor/tools/registry";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import {
  createControlledExecutionRun,
  getControlledExecutionRun,
  resolveControlledApproval,
  updateControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";
import {
  resumeControlledExecutionRun,
  retryControlledExecutionRun,
} from "@/lib/executor/runtime/resume";
import { listKnowledgeAssetStoreSnapshot } from "@/lib/server/knowledge-asset-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-resume-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);

async function seedRun() {
  await createControlledExecutionRun({
    id: "resume-run-1",
    requestId: "resume-run-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan,
  });
  await updateControlledExecutionStep("resume-run-1", "intake", {
    state: "completed",
    output: {
      summary: "lead",
      missingFields: [],
      normalizedLead: {
        company: "ACME",
        contact: "Ada",
        inquiryChannel: "email",
        preferredLanguage: "en",
        productLine: "uPVC windows",
        need: "apartment project windows",
      },
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "qualify", {
    state: "completed",
    output: {
      priority: "high",
      reasons: ["fit"],
      risks: [],
      nextAction: "draft",
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "draft_outreach", {
    state: "completed",
    output: {
      subject: "Hi",
      body: "Body",
      assumptions: [],
      needsHumanCheck: [],
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "human_review", {
    state: "awaiting_approval",
    approval: {
      executionId: "resume-run-1",
      stepId: "human_review",
      state: "pending",
      requestedAt: Date.now(),
    },
  });
  await updateControlledExecutionRun("resume-run-1", {
    state: "awaiting_approval",
    currentStepId: "human_review",
  });
}

function registerResumeTools(calls: string[]) {
  registerTool({
    name: "human_ask",
    description: "resume human ask",
    parameters: { type: "object" },
    requiresApproval: false,
    execute: async (params) => {
      const prompt = String((params as { prompt?: string }).prompt ?? "");
      calls.push(prompt);
      return {
        toolName: "human_ask",
        success: true,
        output: prompt.includes("把已批准结果写回")
          ? {
              salesAssetUpdated: true,
              knowledgeAssetCandidate: "Approved content",
            }
          : {
              approved: true,
              approvedBody: "Approved body",
              reviewNotes: "Approved",
            },
        durationMs: 0,
      };
    },
  });
}

describe("resumeControlledExecutionRun", () => {
  it("returns not_found for a missing run", async () => {
    const result = await resumeControlledExecutionRun("missing-run");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    if (result.ok) throw new Error("Expected missing-run failure");
    expect(result.error).toBe("Controlled run not found");
  });

  it("refuses terminal runs", async () => {
    await seedRun();
    await updateControlledExecutionRun("resume-run-1", { state: "completed" });

    const result = await resumeControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (result.ok) throw new Error("Expected terminal-run failure");
    expect(result.error).toContain("Cannot resume completed controlled run");
  });

  it("does not execute tools while approval is pending", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();

    const result = await resumeControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (result.ok) throw new Error("Expected pending-approval failure");
    expect(result.error).toBe("Controlled run is awaiting approval");
    expect(calls).toEqual([]);
  });

  it("continues after durable approval without replaying completed steps", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();
    await resolveControlledApproval("resume-run-1", "human_review", { approved: true });

    const result = await resumeControlledExecutionRun("resume-run-1");
    const run = await getControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.resumedStepIds).toEqual(["human_review"]);
    expect(run?.state).toBe("awaiting_approval");
    expect(run?.currentStepId).toBe("writeback");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("人工确认草稿");
  });

  it("writes real assets and durable receipts after final approved writeback", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();
    await resolveControlledApproval("resume-run-1", "human_review", { approved: true });

    const firstResume = await resumeControlledExecutionRun("resume-run-1");
    expect(firstResume.ok).toBe(true);

    await resolveControlledApproval("resume-run-1", "writeback", { approved: true });
    const finalResume = await resumeControlledExecutionRun("resume-run-1");
    const run = await getControlledExecutionRun("resume-run-1");
    const writebackStep = run?.steps.find((step) => step.stepId === "writeback");

    expect(finalResume.ok).toBe(true);
    if (!finalResume.ok) throw new Error(finalResume.error);
    expect(finalResume.resumedStepIds).toEqual(["writeback"]);
    expect(run?.state).toBe("completed");
    expect(writebackStep?.writebackReceipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
      "workflow_run",
    ]);
    expect(writebackStep?.writebackReceipts.every((receipt) => receipt.ok)).toBe(true);
    expect(writebackStep?.writebackReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "workflow_run",
          workflowRunId: "workflow-1",
          sourceKey: "controlled-run:resume-run-1:workflow_run",
        }),
      ]),
    );

    const salesSnapshot = await listSalesAssetStoreSnapshot();
    expect(salesSnapshot.salesAssets).toHaveLength(1);
    expect(salesSnapshot.salesAssets[0]).toMatchObject({
      workflowRunId: "workflow-1",
      company: "ACME",
      status: "completed",
      latestDraftBody: "Approved body",
    });

    const knowledgeSnapshot = await listKnowledgeAssetStoreSnapshot();
    expect(knowledgeSnapshot.knowledgeAssets).toHaveLength(1);
    expect(knowledgeSnapshot.knowledgeAssets[0]).toMatchObject({
      sourceKey: "controlled-run:resume-run-1:knowledge_asset",
      workflowRunId: "workflow-1",
      assetType: "sales_playbook",
      status: "active",
    });
  });

  it("returns a conflict when a resumed step fails", async () => {
    registerTool({
      name: "resume_failing_tool",
      description: "resume failing tool",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => ({
        toolName: "resume_failing_tool",
        success: false,
        output: null,
        sideEffects: ["resume failed"],
        durationMs: 0,
      }),
    });
    await createControlledExecutionRun({
      id: "resume-failing-run",
      requestId: "resume-failing-run",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-failing-resume",
        goal: "failing resume",
        totalSteps: 1,
        requiresApproval: false,
        steps: [
          {
            id: "failing_step",
            title: "Failing step",
            description: "This step fails during resume",
            toolCalls: [{ toolName: "resume_failing_tool" }],
            dependsOn: [],
            mode: "auto",
          },
        ],
      },
    });

    const result = await resumeControlledExecutionRun("resume-failing-run");
    const run = await getControlledExecutionRun("resume-failing-run");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (result.ok) throw new Error("Expected resumed-step failure");
    expect(result.error).toBe("resume failed");
    expect(result.state).toBe("failed");
    expect(run?.state).toBe("failed");
  });

  it("does not replay a durable failed step without retry policy", async () => {
    const calls: string[] = [];
    registerTool({
      name: "failed_replay_tool",
      description: "failed replay tool",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => {
        calls.push("called");
        return {
          toolName: "failed_replay_tool",
          success: true,
          output: { ok: true },
          durationMs: 0,
        };
      },
    });
    await createControlledExecutionRun({
      id: "resume-failed-existing-run",
      requestId: "resume-failed-existing-run",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-existing-failed-resume",
        goal: "existing failed resume",
        totalSteps: 1,
        requiresApproval: false,
        steps: [
          {
            id: "failed_step",
            title: "Failed step",
            description: "This durable step already failed",
            toolCalls: [{ toolName: "failed_replay_tool" }],
            dependsOn: [],
            mode: "auto",
          },
        ],
      },
    });
    await updateControlledExecutionStep("resume-failed-existing-run", "failed_step", {
      state: "failed",
      error: "previous failure",
      toolCallResults: [],
    });
    await updateControlledExecutionRun("resume-failed-existing-run", {
      state: "running",
      currentStepId: "failed_step",
    });

    const result = await resumeControlledExecutionRun("resume-failed-existing-run");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (result.ok) throw new Error("Expected durable failed-step conflict");
    expect(result.error).toBe("Cannot resume failed step failed_step");
    expect(calls).toEqual([]);
  });

  it("retries a failed step with retry policy without replaying completed prior steps", async () => {
    const calls: string[] = [];
    registerTool({
      name: "retry_prior_tool",
      description: "prior tool should not replay",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => {
        calls.push("prior");
        return {
          toolName: "retry_prior_tool",
          success: true,
          output: { prior: true },
          durationMs: 0,
        };
      },
    });
    registerTool({
      name: "retry_failed_tool",
      description: "retry failed tool",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => {
        calls.push("retry");
        return {
          toolName: "retry_failed_tool",
          success: true,
          output: { recovered: true },
          durationMs: 0,
        };
      },
    });
    await createControlledExecutionRun({
      id: "retry-run-1",
      requestId: "retry-run-1",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-retry-run",
        goal: "retry failed step",
        totalSteps: 2,
        requiresApproval: false,
        steps: [
          {
            id: "prior_step",
            title: "Prior step",
            description: "Already completed",
            toolCalls: [{ toolName: "retry_prior_tool" }],
            dependsOn: [],
            mode: "auto",
          },
          {
            id: "retry_step",
            title: "Retry step",
            description: "Retry this step",
            toolCalls: [{ toolName: "retry_failed_tool" }],
            dependsOn: ["prior_step"],
            mode: "auto",
            onFailure: { action: "retry", maxRetries: 1 },
          },
        ],
      },
    });
    await updateControlledExecutionStep("retry-run-1", "prior_step", {
      state: "completed",
      output: { prior: true },
      toolCallResults: [],
    });
    await updateControlledExecutionStep("retry-run-1", "retry_step", {
      state: "failed",
      error: "temporary failure",
      attempts: 1,
      toolCallResults: [],
    });
    await updateControlledExecutionRun("retry-run-1", {
      state: "failed",
      currentStepId: "retry_step",
      error: "temporary failure",
    });

    const result = await retryControlledExecutionRun("retry-run-1");
    const run = await getControlledExecutionRun("retry-run-1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.retriedStepIds).toEqual(["retry_step"]);
    expect(calls).toEqual(["retry"]);
    expect(run?.state).toBe("completed");
    expect(run?.steps.find((step) => step.stepId === "retry_step")).toMatchObject({
      state: "completed",
      output: { recovered: true },
    });
    expect(run?.auditEvents).toEqual([
      expect.objectContaining({
        type: "console_retry_requested",
        stepId: "retry_step",
        actor: "local_user",
      }),
    ]);
  });

  it("rejects retry for failed steps without retry policy", async () => {
    await createControlledExecutionRun({
      id: "retry-non-retryable",
      requestId: "retry-non-retryable",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-non-retryable",
        goal: "non retryable",
        totalSteps: 1,
        requiresApproval: false,
        steps: [
          {
            id: "non_retryable_step",
            title: "Non retryable",
            description: "Do not retry",
            toolCalls: [],
            dependsOn: [],
            mode: "auto",
            onFailure: { action: "fail_run" },
          },
        ],
      },
    });
    await updateControlledExecutionStep("retry-non-retryable", "non_retryable_step", {
      state: "failed",
      error: "permanent failure",
      toolCallResults: [],
    });
    await updateControlledExecutionRun("retry-non-retryable", {
      state: "failed",
      currentStepId: "non_retryable_step",
      error: "permanent failure",
    });

    const result = await retryControlledExecutionRun("retry-non-retryable");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (result.ok) throw new Error("Expected non-retryable failure");
    expect(result.error).toBe("Failed step non_retryable_step is not retryable");
  });

  it("marks a rejected approval run as failed", async () => {
    await seedRun();
    await updateControlledExecutionStep("resume-run-1", "human_review", {
      state: "awaiting_approval",
      approval: {
        executionId: "resume-run-1",
        stepId: "human_review",
        state: "rejected",
        requestedAt: Date.now(),
        resolvedAt: Date.now(),
        feedback: "no",
      },
    });
    await updateControlledExecutionRun("resume-run-1", {
      state: "awaiting_approval",
      currentStepId: "human_review",
    });

    const result = await resumeControlledExecutionRun("resume-run-1");
    const run = await getControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    if (result.ok) throw new Error("Expected rejected-approval failure");
    expect(result.state).toBe("failed");
    expect(run?.state).toBe("failed");
  });
});
