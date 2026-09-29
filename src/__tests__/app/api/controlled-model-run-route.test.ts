import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST } from "@/app/api/runtime/executor/controlled-runs/route";
import { POST as RESUME } from "@/app/api/runtime/executor/controlled-runs/[runId]/resume/route";
import { generateControlledModelStep } from "@/lib/executor/runtime/model-step";
import { resolveControlledApproval } from "@/lib/server/controlled-execution-store";
import { listDraftStoreSnapshot } from "@/lib/server/draft-store";
import { listSalesAssetStoreSnapshot } from "@/lib/server/sales-asset-store";

vi.mock("@/lib/executor/runtime/model-step", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/executor/runtime/model-step")>();
  return {
    ...actual,
    generateControlledModelStep: vi.fn(async ({ step }: { step: { id: string } }) => {
      const outputs: Record<string, Record<string, unknown>> = {
        intake: {
          summary: "模型整理的询盘",
          missingFields: ["budget"],
          normalizedLead: { company: "Model Co", need: "模型跟进" },
        },
        qualify: {
          priority: "medium",
          reasons: ["预算未知"],
          risks: ["不承诺价格"],
          nextAction: "起草跟进",
        },
        draft_outreach: {
          subject: "模型跟进",
          body: "模型草稿正文-不承诺价格",
          assumptions: ["预算未知"],
          needsHumanCheck: ["budget"],
        },
      };
      const output = outputs[step.id];
      return output
        ? { ok: true as const, output }
        : { ok: false as const, error: `unexpected model step ${step.id}` };
    }),
  };
});

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-model-run-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
  vi.mocked(generateControlledModelStep).mockClear();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function modelRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/runtime/executor/controlled-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("controlled model run route", () => {
  it("refuses a model run without an API key", async () => {
    const response = await POST(modelRequest({ playbookId: "sales-pipeline-v1", mode: "model" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("缺少 Kimi API Key");
    expect(generateControlledModelStep).not.toHaveBeenCalled();
  });

  it("uses the model for generation steps and keeps the human pause", async () => {
    const response = await POST(
      modelRequest({
        playbookId: "sales-pipeline-v1",
        mode: "model",
        llm: { apiKey: "sk-test-secret", model: "moonshot-v1-8k" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.run.state).toBe("awaiting_approval");
    expect(data.data.run.currentStepId).toBe("human_review");
    expect(JSON.stringify(data)).not.toContain("sk-test-secret");
    expect(vi.mocked(generateControlledModelStep).mock.calls.map((call) => call[0].step.id)).toEqual([
      "intake",
      "qualify",
      "draft_outreach",
    ]);
    expect((await listDraftStoreSnapshot()).drafts[0]).toMatchObject({
      body: "模型草稿正文-不承诺价格",
      approvalState: "pending_review",
    });
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
  });

  it("writes the model draft only after both approvals", async () => {
    const started = await POST(
      modelRequest({
        playbookId: "sales-pipeline-v1",
        mode: "model",
        llm: { apiKey: "sk-test-secret" },
      }),
    );
    const runId = (await started.json()).data.run.id as string;

    await resolveControlledApproval(runId, "human_review", { approved: true });
    const afterReview = await RESUME(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ runId }),
    });
    expect(afterReview.status).toBe(200);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect(generateControlledModelStep).toHaveBeenCalledTimes(3);

    await resolveControlledApproval(runId, "writeback", { approved: true });
    const afterWriteback = await RESUME(new Request("http://localhost/resume", { method: "POST" }), {
      params: Promise.resolve({ runId }),
    });
    expect(afterWriteback.status).toBe(200);
    const assets = (await listSalesAssetStoreSnapshot()).salesAssets;
    expect(assets).toHaveLength(1);
    expect(JSON.stringify(assets[0])).toContain("模型草稿正文-不承诺价格");
    expect(JSON.stringify(assets[0])).not.toContain("Example Co 演示跟进已批准");
  });

  it("fails the run when model JSON does not match the schema", async () => {
    vi.mocked(generateControlledModelStep).mockImplementation(async () => ({
      ok: true,
      output: { nope: true },
    }));

    const response = await POST(
      modelRequest({
        playbookId: "sales-pipeline-v1",
        mode: "model",
        llm: { apiKey: "sk-test-secret" },
      }),
    );

    expect(response.status).toBe(409);
    expect((await listSalesAssetStoreSnapshot()).salesAssets).toHaveLength(0);
    expect((await listDraftStoreSnapshot()).drafts).toHaveLength(0);
  });
});
