import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GET as LIST, POST } from "@/app/api/runtime/executor/controlled-runs/route";
import { POST as RESUME } from "@/app/api/runtime/executor/controlled-runs/[runId]/resume/route";
import { GET } from "@/app/api/runtime/executor/controlled-runs/[runId]/route";
import { resolveControlledApproval } from "@/lib/server/controlled-execution-store";
import { createControlledExecutionRun } from "@/lib/server/controlled-execution-store";
import { listDraftStoreSnapshot } from "@/lib/server/draft-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";
import { listSupportAssetStoreSnapshot } from "@/lib/server/support-asset-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-run-route-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function demoRequest(playbookId: string) {
  return new Request("http://localhost/api/runtime/executor/controlled-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playbookId }),
  });
}

describe("controlled run route", () => {
  it("lists recent controlled execution runs", async () => {
    await createControlledExecutionRun({
      id: "exec-list-1",
      requestId: "req-list-1",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-list",
        goal: "list",
        totalSteps: 0,
        requiresApproval: false,
        steps: [],
      },
    });

    const response = await LIST(
      new Request("http://localhost/api/runtime/executor/controlled-runs"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.runs.map((run: { id: string }) => run.id)).toContain("exec-list-1");
  });

  it("returns a controlled execution run by id", async () => {
    await createControlledExecutionRun({
      id: "exec-route-1",
      requestId: "req-route-1",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-route",
        goal: "route",
        totalSteps: 0,
        requiresApproval: false,
        steps: [],
      },
    });

    const response = await GET(
      new Request("http://localhost/api/runtime/executor/controlled-runs/exec-route-1"),
      {
        params: Promise.resolve({ runId: "exec-route-1" }),
      },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.run.id).toBe("exec-route-1");
  });

  it("rejects an unknown demo playbook", async () => {
    const response = await POST(demoRequest("supply-chain-replenishment-v1"));
    expect(response.status).toBe(400);
  });

  it("starts a sales demo run paused at human review without a sales asset", async () => {
    const response = await POST(demoRequest("sales-pipeline-v1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.run.state).toBe("awaiting_approval");
    expect(data.data.run.currentStepId).toBe("human_review");
    expect(data.data.run.steps.find((step: { stepId: string }) => step.stepId === "human_review")).toMatchObject({
      state: "awaiting_approval",
      approval: { state: "pending" },
    });
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listDraftStoreSnapshot()).drafts[0]).toMatchObject({
      approvalState: "pending_review",
    });
  });

  it("does not write a sales asset when the paused review is rejected", async () => {
    const started = await POST(demoRequest("sales-pipeline-v1"));
    const startedData = await started.json();
    const runId = startedData.data.run.id as string;

    await resolveControlledApproval(runId, "human_review", {
      approved: false,
      feedback: "rejected in test",
    });

    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    const resumed = await RESUME(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ runId }),
    });
    expect(resumed.status).toBe(409);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
  });

  it("writes the sales asset only after review and writeback are both approved", async () => {
    const started = await POST(demoRequest("sales-pipeline-v1"));
    const runId = (await started.json()).data.run.id as string;

    await resolveControlledApproval(runId, "human_review", { approved: true });
    const afterReview = await RESUME(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ runId }),
    });
    const afterReviewData = await afterReview.json();
    expect(afterReview.status).toBe(200);
    expect(afterReviewData.data.state).toBe("awaiting_approval");
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);

    await resolveControlledApproval(runId, "writeback", { approved: true });
    const afterWriteback = await RESUME(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ runId }),
    });
    expect(afterWriteback.status).toBe(200);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(1);
  });

  it("does not write a support asset when support review is rejected", async () => {
    const started = await POST(demoRequest("support-resolution-v1"));
    const runId = (await started.json()).data.run.id as string;
    await resolveControlledApproval(runId, "human_review", { approved: false, feedback: "no" });
    expect((await listSupportAssetStoreSnapshot()).supportAssets).toHaveLength(0);
  });
});
