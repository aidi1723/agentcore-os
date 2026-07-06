import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { runMultiStepTask } from "@/lib/executor/core";
import { registerTool } from "@/lib/executor/tools/registry";
import type {
  AgentCoreTaskRequest,
  ExecutionCallbacks,
} from "@/lib/executor/contracts";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-runtime-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

registerTool({
  name: "llm_generate",
  description: "test LLM generator",
  parameters: { type: "object" },
  requiresApproval: false,
  execute: async (params) => {
    const prompt = String((params as { prompt?: string }).prompt ?? "");
    let output: unknown = { ok: true };
    if (prompt.includes("把客户询盘整理")) {
      output = {
        summary: "Website lead for ACME",
        missingFields: [],
        normalizedLead: { company: "ACME", inquiryChannel: "website", productLine: "windows" },
      };
    } else if (prompt.includes("判断线索是否值得")) {
      output = {
        priority: "high",
        reasons: ["Clear product interest"],
        risks: [],
        nextAction: "Draft outreach",
      };
    } else if (prompt.includes("生成可供人工审核的客户跟进")) {
      output = {
        subject: "Following up on your window inquiry",
        body: "Thanks for your inquiry. We can confirm details after reviewing requirements.",
        assumptions: [],
        needsHumanCheck: [],
      };
    } else if (prompt.includes("把客服消息整理")) {
      output = {
        summary: "Support request from Ada",
        missingFields: [],
        normalizedIssue: {
          customer: "Ada Customer",
          channel: "email",
          subject: "Delivery delay",
          issue: "Order has not arrived",
          orderId: "ORD-9",
          productLine: "uPVC windows",
          language: "en",
        },
      };
    } else if (prompt.includes("判断问题类型")) {
      output = {
        category: "delivery_delay",
        priority: "high",
        risks: ["SLA risk"],
        missingInfo: [],
        nextAction: "Confirm logistics ETA",
      };
    } else if (prompt.includes("生成可供人工审核的客服回复")) {
      output = {
        subject: "Delivery update",
        body: "We are checking logistics and will update you shortly.",
        tone: "calm",
        assumptions: [],
        needsHumanCheck: ["Confirm ETA"],
      };
    }
    return {
      toolName: "llm_generate",
      success: true,
      output,
      durationMs: 0,
    };
  },
});

registerTool({
  name: "human_ask",
  description: "test human ask",
  parameters: { type: "object" },
  requiresApproval: false,
  execute: async (params) => {
    const prompt = String((params as { prompt?: string }).prompt ?? "");
    return {
      toolName: "human_ask",
      success: true,
      output: prompt.includes("把已批准客服处理结果写回")
        ? {
            supportAssetUpdated: true,
            knowledgeAssetCandidate: "Support FAQ candidate",
            faqCandidate: "Confirm ETA before promising compensation.",
          }
        : prompt.includes("人工确认回复事实")
          ? {
              approved: true,
              approvedReply: "Approved support reply",
              reviewNotes: "No refund promise",
              nextAction: "Send ETA update",
            }
          : prompt.includes("把已批准结果写回")
        ? {
            salesAssetUpdated: true,
            knowledgeAssetCandidate: "Approved outreach content",
          }
        : {
            approved: true,
            approvedBody: "Approved outreach body",
            reviewNotes: "Looks good",
          },
      durationMs: 0,
    };
  },
});

function buildRequest(): AgentCoreTaskRequest {
  const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);
  return {
    taskInput: { userMessage: "Execute controlled sales pipeline" },
    session: { id: "test-sales-session" },
    metadata: { requestId: "controlled-runtime-test", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { activeScenarioId: "sales-pipeline" },
    },
    skillPolicy: { enabled: false, mode: "off" },
    modelConfig: {
      provider: "openai",
      apiKey: "test-key",
      baseUrl: "http://127.0.0.1:65535/v1",
      model: "test-model",
    },
    executionPolicy: {
      timeoutSeconds: 30,
      maxAttempts: 1,
      retryBackoffMs: 0,
      allowFallbackToOpenClaw: false,
    },
    multiStep: {
      enabled: true,
      maxSteps: 5,
      approvalMode: "none",
    },
    controlledPlaybookId: "sales-pipeline-v1",
    controlledPlan: plan,
  };
}

function buildSupportRequest(): AgentCoreTaskRequest {
  const plan = resolveExecutionPlanFromPlaybook(supportResolutionPlaybook);
  return {
    ...buildRequest(),
    taskInput: { userMessage: "Execute controlled support resolution" },
    session: { id: "test-support-session" },
    metadata: { requestId: "controlled-support-runtime-test", source: "test" },
    context: {
      systemPrompt: "",
      workspace: { activeScenarioId: "support-ops" },
    },
    multiStep: {
      enabled: true,
      maxSteps: 5,
      approvalMode: "none",
    },
    controlledPlaybookId: "support-resolution-v1",
    controlledPlan: plan,
  };
}

function buildCallbacks() {
  const events: string[] = [];
  const callbacks: ExecutionCallbacks = {
    onPlanReady(plan) {
      events.push(`plan:${plan.id}`);
    },
    onStepStart(step) {
      events.push(`start:${step.id}`);
    },
    onStepProgress() {},
    onStepComplete(result) {
      events.push(`complete:${result.stepId}:${result.status}`);
    },
    onAwaitingApproval(step) {
      events.push(`approval:${step.id}`);
    },
    waitForApproval: vi.fn(async () => ({ approved: true })),
    onError(error) {
      events.push(`error:${error}`);
    },
  };
  return { callbacks, events };
}

describe("controlled runtime execution", () => {
  it("uses the supplied controlled plan instead of invoking planner fallback", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Planner should not call LLM when controlledPlan is supplied");
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = buildRequest();
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.trace.plan.id).toBe("playbook:sales-pipeline-v1:1.0.0");
    expect(result.trace.plan.steps.map((step) => step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
      "human_review",
      "writeback",
    ]);
    expect(events[0]).toBe("plan:playbook:sales-pipeline-v1:1.0.0");
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a supplied controlled plan that diverges from its playbook contract", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Planner should not call LLM when controlledPlan is supplied");
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = buildRequest();
    request.controlledPlan = {
      ...request.controlledPlan!,
      steps: request.controlledPlan!.steps.filter((step) => step.id !== "human_review"),
      totalSteps: request.controlledPlan!.totalSteps - 1,
    };
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid controlled playbook plan");
    expect(result.trace.success).toBe(false);
    expect(result.trace.stepResults).toHaveLength(0);
    expect(events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a supplied controlled plan that removes playbook tool calls", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const request = buildRequest();
    request.controlledPlan = {
      ...request.controlledPlan!,
      steps: request.controlledPlan!.steps.map((step) =>
        step.id === "intake" ? { ...step, toolCalls: [] } : step,
      ),
    };
    const { callbacks, events } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Step intake toolCalls must match playbook toolCalls");
    expect(result.trace.success).toBe(false);
    expect(result.trace.stepResults).toHaveLength(0);
    expect(events).toEqual([]);
  });

  it("creates a durable controlled execution run before executing steps", async () => {
    const { getControlledExecutionRun } = await import(
      "@/lib/server/controlled-execution-store"
    );
    vi.stubGlobal("fetch", vi.fn());
    const request = buildRequest();
    const { callbacks } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);
    const run = await getControlledExecutionRun(request.metadata.requestId);

    expect(result.ok).toBe(true);
    expect(run?.id).toBe(request.metadata.requestId);
    expect(run?.requestId).toBe(request.metadata.requestId);
    expect(run?.playbookId).toBe("sales-pipeline-v1");
    expect(run?.planId).toBe("playbook:sales-pipeline-v1:1.0.0");
  });

  it("records writeback receipts for controlled steps with writesTo targets", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { getControlledExecutionRun } = await import(
      "@/lib/server/controlled-execution-store"
    );
    const request = buildRequest();
    const { callbacks } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);
    const run = await getControlledExecutionRun(request.metadata.requestId);
    const intake = run?.steps.find((step) => step.stepId === "intake");
    const draftOutreach = run?.steps.find((step) => step.stepId === "draft_outreach");

    expect(result.ok).toBe(true);
    expect(intake?.writebackReceipts.length).toBeGreaterThan(0);
    expect(intake?.writebackReceipts[0]).toMatchObject({
      target: "workflow_run",
      ok: true,
      workflowRunId: "controlled-runtime-test",
      sourceKey: "controlled-run:controlled-runtime-test:workflow_run",
    });
    expect(draftOutreach?.writebackReceipts).toEqual([
      expect.objectContaining({
        target: "draft",
        ok: true,
        assetId: "controlled-draft:controlled-runtime-test",
        sourceKey: "controlled-run:controlled-runtime-test:draft",
        workflowRunId: "controlled-runtime-test",
      }),
    ]);
    expect(run?.steps.find((step) => step.stepId === "writeback")?.writebackReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "sales_asset", ok: true }),
        expect.objectContaining({ target: "knowledge_asset", ok: true }),
      ]),
    );
  });

  it("writes workflow and draft records to server-backed stores", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { listDraftStoreSnapshot } = await import("@/lib/server/draft-store");
    const { listWorkflowRunStoreSnapshot } = await import(
      "@/lib/server/workflow-run-store"
    );
    const request = buildRequest();
    const { callbacks } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);

    expect(result.ok).toBe(true);
    expect((await listWorkflowRunStoreSnapshot()).workflowRuns[0]).toMatchObject({
      id: "controlled-runtime-test",
      scenarioId: "sales-pipeline",
      state: "completed",
      currentStageId: undefined,
    });
    expect((await listDraftStoreSnapshot()).drafts[0]).toMatchObject({
      id: "controlled-draft:controlled-runtime-test",
      title: "Following up on your window inquiry",
      workflowRunId: "controlled-runtime-test",
      workflowStageId: "draft_outreach",
    });
  });

  it("executes support controlled playbook and writes support records", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { getControlledExecutionRun } = await import(
      "@/lib/server/controlled-execution-store"
    );
    const { listSupportAssetStoreSnapshot } = await import(
      "@/lib/server/support-asset-store"
    );
    const { listKnowledgeAssetStoreSnapshot } = await import(
      "@/lib/server/knowledge-asset-store"
    );
    const { listWorkflowRunStoreSnapshot } = await import(
      "@/lib/server/workflow-run-store"
    );
    const { listDraftStoreSnapshot } = await import("@/lib/server/draft-store");
    const request = buildSupportRequest();
    const { callbacks } = buildCallbacks();

    const result = await runMultiStepTask(request, callbacks);
    const run = await getControlledExecutionRun(request.metadata.requestId);

    expect(result.ok).toBe(true);
    expect(run?.playbookId).toBe("support-resolution-v1");
    expect(run?.steps.map((step) => step.stepId)).toEqual([
      "intake",
      "classify",
      "draft_reply",
      "human_review",
      "writeback",
    ]);
    expect(run?.steps.find((step) => step.stepId === "classify")?.writebackReceipts).toEqual([
      expect.objectContaining({ target: "support_asset", ok: true }),
    ]);
    expect(run?.steps.find((step) => step.stepId === "writeback")?.writebackReceipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "support_asset", ok: true }),
        expect.objectContaining({ target: "knowledge_asset", ok: true }),
        expect.objectContaining({ target: "workflow_run", ok: true }),
      ]),
    );

    expect((await listSupportAssetStoreSnapshot()).supportAssets[0]).toMatchObject({
      id: "controlled-support-asset:controlled-support-runtime-test",
      workflowRunId: "controlled-support-runtime-test",
      scenarioId: "support-ops",
      latestReply: "Approved support reply",
      status: "completed",
    });
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets[0]).toMatchObject({
      workflowRunId: "controlled-support-runtime-test",
      assetType: "support_faq",
    });
    expect((await listWorkflowRunStoreSnapshot()).workflowRuns[0]).toMatchObject({
      id: "controlled-support-runtime-test",
      scenarioId: "support-ops",
      state: "completed",
    });
    expect((await listDraftStoreSnapshot()).drafts[0]).toMatchObject({
      id: "controlled-draft:controlled-support-runtime-test",
      workflowRunId: "controlled-support-runtime-test",
      workflowStageId: "draft_reply",
    });
  });
});
