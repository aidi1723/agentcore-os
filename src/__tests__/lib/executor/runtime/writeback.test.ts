import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { StepResult } from "@/lib/executor/contracts";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";
import { writeControlledStepAssets } from "@/lib/executor/runtime/writeback";
import { listDraftStoreSnapshot } from "@/lib/server/draft-store";
import { listKnowledgeAssetStoreSnapshot } from "@/lib/server/knowledge-asset-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";
import { listSupportAssetStoreSnapshot } from "@/lib/server/support-asset-store";
import { listWorkflowRunStoreSnapshot } from "@/lib/server/workflow-run-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-writeback-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function makeRun(): ControlledExecutionRunRecord {
  return {
    id: "run-1",
    requestId: "run-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-1",
    state: "running",
    createdAt: 1,
    updatedAt: 1,
    plan: {
      id: "plan-1",
      goal: "sales pipeline",
      totalSteps: 5,
      requiresApproval: true,
      steps: [],
    },
    steps: [],
  };
}

function makeSupportRun(): ControlledExecutionRunRecord {
  return {
    ...makeRun(),
    id: "support-run-1",
    requestId: "support-run-1",
    workflowRunId: "support-workflow-1",
    scenarioId: "support-ops",
    playbookId: "support-resolution-v1",
    planId: "support-plan-1",
    plan: {
      id: "support-plan-1",
      goal: "support resolution",
      totalSteps: 5,
      requiresApproval: true,
      steps: [],
    },
  };
}

const previousResults: StepResult[] = [
  {
    stepId: "intake",
    status: "completed",
    output: {
      summary: "Customer asks for uPVC windows",
      missingFields: [],
      normalizedLead: {
        company: "ACME",
        contact: "Ada",
        inquiryChannel: "email",
        preferredLanguage: "en",
        productLine: "uPVC windows",
        need: "windows for apartment project",
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
      priority: "high",
      reasons: ["project fit"],
      risks: ["confirm delivery date"],
      nextAction: "send approved follow-up",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "draft_outreach",
    status: "completed",
    output: {
      subject: "Window project follow-up",
      body: "Draft body",
      assumptions: [],
      needsHumanCheck: [],
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "human_review",
    status: "completed",
    output: {
      approved: true,
      approvedBody: "Approved body",
      reviewNotes: "Confirmed by sales",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
];

const supportPreviousResults: StepResult[] = [
  {
    stepId: "intake",
    status: "completed",
    output: {
      summary: "Customer reports delayed delivery",
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
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "classify",
    status: "completed",
    output: {
      category: "delivery_delay",
      priority: "high",
      risks: ["SLA risk"],
      missingInfo: [],
      nextAction: "confirm logistics ETA",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "draft_reply",
    status: "completed",
    output: {
      subject: "Delivery update",
      body: "We are checking the latest delivery status and will update you shortly.",
      tone: "calm",
      assumptions: [],
      needsHumanCheck: ["Confirm ETA"],
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
  {
    stepId: "human_review",
    status: "completed",
    output: {
      approved: true,
      approvedReply: "Approved support reply",
      reviewNotes: "Do not promise refund",
      nextAction: "send update after logistics confirms ETA",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  },
];

function makeWritebackResult(): StepResult {
  return {
    stepId: "writeback",
    status: "completed",
    output: { salesAssetUpdated: true, knowledgeAssetCandidate: "Approved body" },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  };
}

function makeSupportWritebackResult(): StepResult {
  return {
    stepId: "writeback",
    status: "completed",
    output: {
      supportAssetUpdated: true,
      knowledgeAssetCandidate: "Delay response guidance",
      faqCandidate: "If delivery is delayed, confirm ETA before promising compensation.",
    },
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 1,
  };
}

describe("writeControlledStepAssets", () => {
  it("writes workflow run target to the workflow run store", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "intake")!;

    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: previousResults[0],
      previousResults: [],
      approved: true,
    });

    expect(receipts).toEqual([
      expect.objectContaining({
        target: "workflow_run",
        ok: true,
        sourceKey: "controlled-run:run-1:workflow_run",
        workflowRunId: "workflow-1",
      }),
    ]);
    expect(receipts[0].summary).toContain("workflow-1");

    const snapshot = await listWorkflowRunStoreSnapshot();
    expect(snapshot.workflowRuns).toHaveLength(1);
    expect(snapshot.workflowRuns[0]).toMatchObject({
      id: "workflow-1",
      scenarioId: "sales-pipeline",
      scenarioTitle: "Sales Pipeline Controlled Runtime",
      state: "running",
      currentStageId: "qualify",
    });
    expect(snapshot.workflowRuns[0].stageRuns.map((stage) => [stage.id, stage.state])).toEqual([
      ["intake", "completed"],
      ["qualify", "running"],
      ["draft_outreach", "pending"],
      ["human_review", "pending"],
      ["writeback", "pending"],
    ]);
  });

  it("writes approved final output to sales and knowledge assets", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;

    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: makeWritebackResult(),
      previousResults,
      approved: true,
    });

    expect(receipts.map((receipt) => receipt.target)).toEqual([
      "sales_asset",
      "knowledge_asset",
      "workflow_run",
    ]);
    expect(receipts.every((receipt) => receipt.ok)).toBe(true);
    expect(receipts[0].summary).toContain("workflow-1");
    expect(receipts[1].summary).toContain("controlled-run:run-1:knowledge_asset");
    expect(receipts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "sales_asset",
          ok: true,
          assetId: "controlled-sales-asset:workflow-1",
          sourceKey: "controlled-run:run-1:sales_asset",
          workflowRunId: "workflow-1",
        }),
        expect.objectContaining({
          target: "knowledge_asset",
          ok: true,
          assetId: "controlled-knowledge-asset:run-1",
          sourceKey: "controlled-run:run-1:knowledge_asset",
          workflowRunId: "workflow-1",
        }),
        expect.objectContaining({
          target: "workflow_run",
          ok: true,
          sourceKey: "controlled-run:run-1:workflow_run",
          workflowRunId: "workflow-1",
        }),
      ]),
    );

    const salesSnapshot = await listSalesAssetStoreSnapshot();
    expect(salesSnapshot.salesAssets).toHaveLength(1);
    expect(salesSnapshot.salesAssets[0]).toMatchObject({
      workflowRunId: "workflow-1",
      company: "ACME",
      contactName: "Ada",
      latestDraftSubject: "Window project follow-up",
      latestDraftBody: "Approved body",
      status: "completed",
    });

    const knowledgeSnapshot = await listKnowledgeAssetStoreSnapshot();
    expect(knowledgeSnapshot.knowledgeAssets).toHaveLength(1);
    expect(knowledgeSnapshot.knowledgeAssets[0]).toMatchObject({
      sourceKey: "controlled-run:run-1:knowledge_asset",
      workflowRunId: "workflow-1",
      assetType: "sales_playbook",
      status: "active",
    });
    expect(knowledgeSnapshot.knowledgeAssets[0].body).toContain("Approved body");

    const workflowSnapshot = await listWorkflowRunStoreSnapshot();
    expect(workflowSnapshot.workflowRuns[0]).toMatchObject({
      id: "workflow-1",
      state: "completed",
      currentStageId: undefined,
    });
  });

  it("skips after-approval writes when output is not approved", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;

    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: makeWritebackResult(),
      previousResults,
      approved: false,
    });

    expect(receipts).toHaveLength(3);
    expect(receipts.every((receipt) => !receipt.ok)).toBe(true);
    expect(receipts.every((receipt) => receipt.summary === "Skipped because output is not approved")).toBe(
      true,
    );
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
    expect((await listWorkflowRunStoreSnapshot()).workflowRuns).toHaveLength(0);
  });

  it("is idempotent for the same controlled run", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "writeback")!;

    await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: makeWritebackResult(),
      previousResults,
      approved: true,
    });
    await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: makeWritebackResult(),
      previousResults,
      approved: true,
    });

    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(1);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(1);
    expect((await listWorkflowRunStoreSnapshot()).workflowRuns).toHaveLength(1);
  });

  it("is idempotent for workflow run and draft targets", async () => {
    const workflowStep = salesPipelinePlaybook.steps.find((item) => item.id === "intake")!;
    const draftStep = salesPipelinePlaybook.steps.find((item) => item.id === "draft_outreach")!;

    await writeControlledStepAssets({
      run: makeRun(),
      step: workflowStep,
      result: previousResults[0],
      previousResults: [],
      approved: true,
    });
    await writeControlledStepAssets({
      run: makeRun(),
      step: workflowStep,
      result: previousResults[0],
      previousResults: [],
      approved: true,
    });
    await writeControlledStepAssets({
      run: makeRun(),
      step: draftStep,
      result: previousResults[2],
      previousResults: previousResults.slice(0, 2),
      approved: true,
    });
    await writeControlledStepAssets({
      run: makeRun(),
      step: draftStep,
      result: previousResults[2],
      previousResults: previousResults.slice(0, 2),
      approved: true,
    });

    expect((await listWorkflowRunStoreSnapshot()).workflowRuns).toHaveLength(1);
    expect((await listDraftStoreSnapshot()).drafts).toHaveLength(1);
  });

  it("writes draft target to the draft store", async () => {
    const step = salesPipelinePlaybook.steps.find((item) => item.id === "draft_outreach")!;

    const receipts = await writeControlledStepAssets({
      run: makeRun(),
      step,
      result: previousResults[2],
      previousResults: previousResults.slice(0, 2),
      approved: true,
    });

    expect(receipts).toEqual([
      expect.objectContaining({
        target: "draft",
        ok: true,
        assetId: "controlled-draft:workflow-1",
        sourceKey: "controlled-run:run-1:draft",
        workflowRunId: "workflow-1",
      }),
    ]);
    expect(receipts[0].summary).toContain("controlled-draft:workflow-1");

    const snapshot = await listDraftStoreSnapshot();
    expect(snapshot.drafts).toHaveLength(1);
    expect(snapshot.drafts[0]).toMatchObject({
      id: "controlled-draft:workflow-1",
      title: "Window project follow-up",
      body: "Draft body",
      source: "publisher",
      workflowRunId: "workflow-1",
      workflowScenarioId: "sales-pipeline",
      workflowStageId: "draft_outreach",
      workflowOriginId: "run-1",
      workflowOriginLabel: "sales-pipeline-v1",
    });
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });

  it("writes support asset target to the support asset store", async () => {
    const step = supportResolutionPlaybook.steps.find((item) => item.id === "classify")!;

    const receipts = await writeControlledStepAssets({
      run: makeSupportRun(),
      step,
      result: supportPreviousResults[1],
      previousResults: supportPreviousResults.slice(0, 1),
      approved: true,
    });

    expect(receipts).toEqual([
      expect.objectContaining({
        target: "support_asset",
        ok: true,
        assetId: "controlled-support-asset:support-workflow-1",
        sourceKey: "controlled-run:support-run-1:support_asset",
        workflowRunId: "support-workflow-1",
      }),
    ]);

    const snapshot = await listSupportAssetStoreSnapshot();
    expect(snapshot.supportAssets).toHaveLength(1);
    expect(snapshot.supportAssets[0]).toMatchObject({
      id: "controlled-support-asset:support-workflow-1",
      workflowRunId: "support-workflow-1",
      scenarioId: "support-ops",
      customer: "Ada Customer",
      channel: "email",
      issueSummary: "Customer reports delayed delivery",
      nextAction: "confirm logistics ETA",
      status: "replying",
    });
    expect(snapshot.supportAssets[0].latestDigest).toContain("delivery_delay");
    expect(snapshot.supportAssets[0].latestDigest).toContain("SLA risk");
  });

  it("writes approved final support output to support and knowledge assets idempotently", async () => {
    const step = supportResolutionPlaybook.steps.find((item) => item.id === "writeback")!;

    await writeControlledStepAssets({
      run: makeSupportRun(),
      step,
      result: makeSupportWritebackResult(),
      previousResults: supportPreviousResults,
      approved: true,
    });
    const receipts = await writeControlledStepAssets({
      run: makeSupportRun(),
      step,
      result: makeSupportWritebackResult(),
      previousResults: supportPreviousResults,
      approved: true,
    });

    expect(receipts.map((receipt) => receipt.target)).toEqual([
      "support_asset",
      "knowledge_asset",
      "workflow_run",
    ]);
    expect(receipts.every((receipt) => receipt.ok)).toBe(true);

    const supportSnapshot = await listSupportAssetStoreSnapshot();
    expect(supportSnapshot.supportAssets).toHaveLength(1);
    expect(supportSnapshot.supportAssets[0]).toMatchObject({
      id: "controlled-support-asset:support-workflow-1",
      workflowRunId: "support-workflow-1",
      latestReply: "Approved support reply",
      faqDraft: "If delivery is delayed, confirm ETA before promising compensation.",
      status: "completed",
    });

    const knowledgeSnapshot = await listKnowledgeAssetStoreSnapshot();
    expect(knowledgeSnapshot.knowledgeAssets).toHaveLength(1);
    expect(knowledgeSnapshot.knowledgeAssets[0]).toMatchObject({
      sourceKey: "controlled-run:support-run-1:knowledge_asset",
      workflowRunId: "support-workflow-1",
      assetType: "support_faq",
      status: "active",
    });
    expect(knowledgeSnapshot.knowledgeAssets[0].body).toContain("Delay response guidance");
  });
});
