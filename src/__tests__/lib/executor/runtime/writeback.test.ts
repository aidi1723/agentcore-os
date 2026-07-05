import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { StepResult } from "@/lib/executor/contracts";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";
import { writeControlledStepAssets } from "@/lib/executor/runtime/writeback";
import { listKnowledgeAssetStoreSnapshot } from "@/lib/server/knowledge-asset-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";

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

describe("writeControlledStepAssets", () => {
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
    ]);
    expect(receipts.every((receipt) => receipt.ok)).toBe(true);
    expect(receipts[0].summary).toContain("workflow-1");
    expect(receipts[1].summary).toContain("controlled-run:run-1:knowledge_asset");

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

    expect(receipts).toHaveLength(2);
    expect(receipts.every((receipt) => !receipt.ok)).toBe(true);
    expect(receipts.every((receipt) => receipt.summary === "Skipped because output is not approved")).toBe(
      true,
    );
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
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
  });

  it("returns unsupported receipts without writing unsupported targets", async () => {
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
        ok: false,
        summary: "Skipped unsupported writeback target draft",
      }),
    ]);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });
});
