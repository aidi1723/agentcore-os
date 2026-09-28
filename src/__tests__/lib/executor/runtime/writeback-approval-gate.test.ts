import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AgentCoreTaskRequest, ExecutionCallbacks, StepResult } from "@/lib/executor/contracts";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";
import { writeControlledStepAssets } from "@/lib/executor/runtime/writeback";
import { executeMultiStep } from "@/lib/executor/step-executor";
import { registerTool } from "@/lib/executor/tools/registry";
import { listDraftStoreSnapshot } from "@/lib/server/draft-store";
import { listKnowledgeAssetStoreSnapshot } from "@/lib/server/knowledge-asset-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";
import { listSupportAssetStoreSnapshot } from "@/lib/server/support-asset-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "writeback-approval-gate-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function makeRun(overrides: Partial<ControlledExecutionRunRecord> = {}): ControlledExecutionRunRecord {
  return {
    id: "run-gate",
    requestId: "run-gate",
    sessionId: "session-gate",
    workflowRunId: "workflow-gate",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-gate",
    state: "running",
    createdAt: 1,
    updatedAt: 1,
    auditEvents: [],
    plan: {
      id: "plan-gate",
      goal: "sales pipeline",
      totalSteps: 5,
      requiresApproval: true,
      steps: [],
    },
    steps: [],
    ...overrides,
  };
}

const salesLeadResults: StepResult[] = [
  {
    stepId: "intake",
    status: "completed",
    output: {
      summary: "Demo inquiry",
      missingFields: [],
      normalizedLead: {
        company: "Example Co",
        contact: "Demo Contact",
        inquiryChannel: "web_form",
        preferredLanguage: "zh",
        productLine: "demo",
        need: "demo need",
      },
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "qualify",
    status: "completed",
    output: {
      priority: "medium",
      reasons: ["demo"],
      risks: [],
      nextAction: "draft a follow-up",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
];

const salesDraftResult: StepResult = {
  stepId: "draft_outreach",
  status: "completed",
  output: {
    subject: "Demo follow-up",
    body: "Draft only",
    assumptions: [],
    needsHumanCheck: ["price"],
  },
  toolCallResults: [],
  tokensUsed: 0,
  durationMs: 1,
};

function makeCallbacks(approved: boolean): ExecutionCallbacks {
  return {
    onPlanReady: vi.fn(),
    onStepStart: vi.fn(),
    onStepProgress: vi.fn(),
    onStepComplete: vi.fn(),
    onAwaitingApproval: vi.fn(),
    waitForApproval: vi.fn(async () => ({ approved, feedback: approved ? undefined : "rejected in test" })),
    onError: vi.fn(),
  };
}

function makeControlledRequest(playbookId: string): AgentCoreTaskRequest {
  return {
    session: { id: "sess-gate" },
    taskInput: { userMessage: "demo" },
    context: { systemPrompt: "", workspace: null },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {},
    metadata: { source: "test", requestId: "req-gate", idempotencyKey: "idem-gate" },
    controlledPlaybookId: playbookId,
    multiStep: { enabled: true, maxSteps: 10, approvalMode: "none" },
  } as unknown as AgentCoreTaskRequest;
}

describe("controlled writeback approval gate", () => {
  it("writes only a workflow run when qualify succeeds", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "qualify")!;
    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: salesLeadResults[1],
      previousResults: salesLeadResults.slice(0, 1),
      approved: true,
    });

    expect(receipts.map((receipt) => receipt.target)).toEqual(["workflow_run"]);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });

  it("writes only a workflow run when classify succeeds", async () => {
    const step = supportResolutionPlaybook.steps.find((item) => item.id === "classify")!;
    const receipts = await writeControlledStepAssets({
      run: makeRun({
        id: "support-run-gate",
        requestId: "support-run-gate",
        workflowRunId: "support-workflow-gate",
        scenarioId: "support-ops",
        playbookId: "support-resolution-v1",
      }),
      step,
      result: {
        stepId: "classify",
        status: "completed",
        output: {
          category: "login",
          priority: "high",
          risks: [],
          missingInfo: [],
          nextAction: "ask for a screenshot",
        },
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 1,
      },
      previousResults: [
        {
          stepId: "intake",
          status: "completed",
          output: {
            summary: "登录失败",
            missingFields: [],
            normalizedIssue: {
              customer: "Demo Contact",
              channel: "web_form",
              subject: "登录失败",
              issue: "演示工单：登录失败",
            },
          },
          toolCallResults: [],
          tokensUsed: 0,
          durationMs: 1,
        },
      ],
      approved: true,
    });

    expect(receipts.map((receipt) => receipt.target)).toEqual(["workflow_run"]);
    expect((await listSupportAssetStoreSnapshot()).supportAssets).toHaveLength(0);
  });

  it("stores an outreach draft as pending review before approval", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "draft_outreach")!;
    await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: salesDraftResult,
      previousResults: salesLeadResults,
      approved: true,
    });

    const draft = (await listDraftStoreSnapshot()).drafts[0];
    expect(draft).toMatchObject({
      approvalState: "pending_review",
      title: "Demo follow-up",
    });
    expect(draft).not.toHaveProperty("sent");
    expect(draft.approvalState).not.toBe("approved");
  });

  it("skips sales and knowledge writes when the final step is not approved", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;
    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: {
        stepId: "writeback",
        status: "completed",
        output: { salesAssetUpdated: true, knowledgeAssetCandidate: "Approved body" },
        toolCallResults: [],
        tokensUsed: 0,
        durationMs: 1,
      },
      previousResults: [
        ...salesLeadResults,
        salesDraftResult,
        {
          stepId: "human_review",
          status: "completed",
          output: { approved: false, approvedBody: "", reviewNotes: "no" },
          toolCallResults: [],
          tokensUsed: 0,
          durationMs: 1,
        },
      ],
      approved: false,
    });

    expect(receipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
      "workflow_run",
    ]);
    expect(receipts.every((receipt) => receipt.ok === false)).toBe(true);
    expect(receipts.every((receipt) => receipt.summary === "Skipped because output is not approved")).toBe(true);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });

  it("does not write a draft when draft output fails schema validation", async () => {
    registerTool({
      name: "gate_bad_draft_tool",
      description: "returns an object that misses the draft schema",
      parameters: { type: "object" },
      requiresApproval: false,
      execute: async () => ({
        toolName: "gate_bad_draft_tool",
        success: true,
        output: { wrong: true },
        durationMs: 0,
      }),
    });

    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const draftStep = plan.steps.find((step) => step.id === "draft_outreach")!;
    draftStep.toolCalls = [{ toolName: "gate_bad_draft_tool" }];
    draftStep.dependsOn = [];

    const trace = await executeMultiStep(
      { ...plan, steps: [draftStep], totalSteps: 1 },
      makeControlledRequest("sales-pipeline-v1"),
      makeCallbacks(true),
    );

    expect(trace.stepResults[0]?.status).toBe("failed");
    expect((await listDraftStoreSnapshot()).drafts).toHaveLength(0);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
  });

  it("does not complete writeback after human review is rejected", async () => {
    const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
    const trace = await executeMultiStep(
      plan,
      makeControlledRequest("sales-pipeline-v1"),
      makeCallbacks(false),
      undefined,
      {
        initialStepResults: [...salesLeadResults, salesDraftResult],
        startStepIndex: 3,
      },
    );

    const review = trace.stepResults.find((result) => result.stepId === "human_review");
    const writeback = trace.stepResults.find((result) => result.stepId === "writeback");
    expect(review?.status).toBe("failed");
    expect(writeback?.status).not.toBe("completed");
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });
});
