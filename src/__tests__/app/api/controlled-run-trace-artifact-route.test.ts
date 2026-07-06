import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { GET } from "@/app/api/runtime/executor/controlled-runs/[runId]/trace-artifact/route";
import {
  createControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-trace-artifact-route-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

async function seedRun() {
  await createControlledExecutionRun({
    id: "exec-artifact-1",
    requestId: "req-artifact-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-artifact",
      goal: "Follow up with Nora",
      totalSteps: 1,
      requiresApproval: false,
      steps: [
        {
          id: "intake",
          title: "Intake",
          description: "Collect lead details",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
        },
      ],
    },
  });
  await updateControlledExecutionStep("exec-artifact-1", "intake", {
    state: "completed",
    input: {
      customer: "Nora",
      message: "api_key=sk-route-secret",
    },
    output: {
      draft: "Email Nora at nora@example.com with Bearer routeabcdefgh",
    },
    toolCallResults: [
      {
        toolName: "llm_generate",
        success: true,
        output: "Draft for Nora with token=routeabcdefgh",
        durationMs: 12,
      },
    ],
    writebackReceipts: [
      {
        target: "sales_asset",
        ok: true,
        summary: "Wrote sales asset controlled-sales-asset:workflow-1",
        writtenAt: 123,
        assetId: "controlled-sales-asset:workflow-1",
        sourceKey: "controlled-run:exec-artifact-1:sales_asset",
        workflowRunId: "workflow-1",
      },
    ],
  });
}

describe("controlled run trace artifact route", () => {
  it("returns 404 for a missing controlled run", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/runtime/executor/controlled-runs/missing/trace-artifact",
      ),
      { params: Promise.resolve({ runId: "missing" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Controlled run not found");
  });

  it("returns a governed artifact without raw step payloads", async () => {
    await seedRun();

    const response = await GET(
      new Request(
        "http://localhost/api/runtime/executor/controlled-runs/exec-artifact-1/trace-artifact",
      ),
      { params: Promise.resolve({ runId: "exec-artifact-1" }) },
    );
    const data = await response.json();
    const serialized = JSON.stringify(data);

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.artifact.id).toBe("exec-artifact-1");
    expect(data.data.artifact.playbookId).toBe("sales-pipeline-v1");
    expect(data.data.artifact.steps[0].stepId).toBe("intake");
    expect(data.data.artifact.steps[0].input).toMatchObject({
      redacted: true,
      reason: "trace_governance",
    });
    expect(data.data.artifact.steps[0].writebackReceipts[0]).toMatchObject({
      target: "sales_asset",
      assetId: "controlled-sales-asset:workflow-1",
      sourceKey: "controlled-run:exec-artifact-1:sales_asset",
    });
    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-route-secret");
    expect(serialized).not.toContain("nora@example.com");
    expect(serialized).not.toContain("routeabcdefgh");
  });
});
