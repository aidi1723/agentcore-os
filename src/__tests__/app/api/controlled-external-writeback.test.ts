import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST } from "@/app/api/runtime/executor/controlled-runs/route";
import { POST as RESUME } from "@/app/api/runtime/executor/controlled-runs/[runId]/resume/route";
import { postPublishWebhook } from "@/lib/server/publish-webhook-transport";
import { resolveControlledApproval } from "@/lib/server/controlled-execution-store";
import { listKnowledgeAssetStoreSnapshot } from "@/lib/server/knowledge-asset-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";

vi.mock("@/lib/server/publish-webhook-transport", () => ({
  postPublishWebhook: vi.fn(async () => ({ ok: true, status: 204, responseText: "" })),
  PublishWebhookTransportError: class PublishWebhookTransportError extends Error {
    code = "connection_failed";
    retryable = true;
  },
}));

const webhookUrl = "https://example.com/sales-writeback";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-external-writeback-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
  vi.mocked(postPublishWebhook).mockClear();
  vi.mocked(postPublishWebhook).mockResolvedValue({ ok: true, status: 204, responseText: "" });
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function startRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/runtime/executor/controlled-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function resume(runId: string) {
  return RESUME(new Request("http://localhost/resume", { method: "POST" }), {
    params: Promise.resolve({ runId }),
  });
}

describe("sales external writeback", () => {
  it("rejects a private writeback address before starting a run", async () => {
    const response = await POST(
      startRequest({
        playbookId: "sales-pipeline-v1",
        externalWritebackUrl: "http://127.0.0.1/sales-writeback",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("写回地址不在允许的外连范围内");
    expect(postPublishWebhook).not.toHaveBeenCalled();
  });

  it("rejects an external writeback address for the support playbook", async () => {
    const response = await POST(
      startRequest({
        playbookId: "support-resolution-v1",
        externalWritebackUrl: webhookUrl,
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("外部写回目前只接销售剧本的批准结果");
  });

  it("keeps the webhook until writeback is approved", async () => {
    const started = await POST(
      startRequest({ playbookId: "sales-pipeline-v1", externalWritebackUrl: webhookUrl }),
    );
    const startedData = await started.json();
    const runId = startedData.data.run.id as string;

    expect(started.status).toBe(200);
    expect(startedData.data.run.externalWritebackUrl).toBe(webhookUrl);
    expect(postPublishWebhook).not.toHaveBeenCalled();

    await resolveControlledApproval(runId, "human_review", { approved: false, feedback: "no" });
    const resumed = await resume(runId);
    expect(resumed.status).toBe(409);
    expect(postPublishWebhook).not.toHaveBeenCalled();
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
  });

  it("posts the approved sales body once and then writes the local asset", async () => {
    const started = await POST(
      startRequest({ playbookId: "sales-pipeline-v1", externalWritebackUrl: webhookUrl }),
    );
    const runId = (await started.json()).data.run.id as string;

    await resolveControlledApproval(runId, "human_review", { approved: true });
    const afterReview = await resume(runId);
    expect(afterReview.status).toBe(200);
    expect(postPublishWebhook).not.toHaveBeenCalled();
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);

    await resolveControlledApproval(runId, "writeback", { approved: true });
    const afterWriteback = await resume(runId);
    const afterWritebackData = await afterWriteback.json();

    expect(afterWriteback.status).toBe(200);
    expect(afterWritebackData.data.state).toBe("completed");
    expect(postPublishWebhook).toHaveBeenCalledTimes(1);
    const request = vi.mocked(postPublishWebhook).mock.calls[0][0];
    expect(request.url).toBe(webhookUrl);
    const payload = JSON.parse(request.body) as {
      playbookId: string;
      idempotencyKey: string;
      approvedBody: string;
    };
    expect(payload.playbookId).toBe("sales-pipeline-v1");
    expect(payload.idempotencyKey).toBe(runId);
    expect(payload.approvedBody).toContain("Example Co 演示跟进已批准");
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(1);
    expect(
      afterWritebackData.data.run.steps.find(
        (step: { stepId: string }) => step.stepId === "writeback",
      ).writebackReceipts,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: "external_webhook", ok: true }),
      ]),
    );
  });

  it("does not write local sales or knowledge assets when the webhook fails", async () => {
    vi.mocked(postPublishWebhook).mockResolvedValue({
      ok: false,
      status: 502,
      responseText: "",
    });
    const started = await POST(
      startRequest({ playbookId: "sales-pipeline-v1", externalWritebackUrl: webhookUrl }),
    );
    const runId = (await started.json()).data.run.id as string;

    await resolveControlledApproval(runId, "human_review", { approved: true });
    await resume(runId);
    await resolveControlledApproval(runId, "writeback", { approved: true });
    const afterWriteback = await resume(runId);

    expect(afterWriteback.status).toBe(409);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listKnowledgeAssetStoreSnapshot()).knowledgeAssets).toHaveLength(0);
  });
});
