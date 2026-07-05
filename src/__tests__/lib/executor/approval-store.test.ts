import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { waitForApproval, resolveApproval } from "@/lib/executor/approval-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "approval-store-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  vi.useRealTimers();
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("approval-store", () => {
  it("resolves when approval is granted", async () => {
    const promise = waitForApproval("exec-1", "step-a");
    resolveApproval("exec-1", "step-a", true, "looks good");
    const result = await promise;
    expect(result).toEqual({ approved: true, feedback: "looks good" });
  });

  it("resolves with rejected when denied", async () => {
    const promise = waitForApproval("exec-2", "step-b");
    resolveApproval("exec-2", "step-b", false, "not safe");
    const result = await promise;
    expect(result).toEqual({ approved: false, feedback: "not safe" });
  });

  it("times out after specified duration", async () => {
    vi.useFakeTimers();
    const promise = waitForApproval("exec-3", "step-c", 100);
    vi.advanceTimersByTime(100);
    const result = await promise;
    expect(result).toEqual({ approved: false, feedback: "Approval timeout" });
    vi.useRealTimers();
  });

  it("ignores resolve for unknown key", () => {
    // Should not throw
    resolveApproval("unknown", "unknown", true);
  });

  it("persists approval decisions for controlled executions", async () => {
    const { createControlledExecutionRun, getControlledExecutionRun } = await import(
      "@/lib/server/controlled-execution-store"
    );
    const { waitForApproval, resolveApproval } = await import("@/lib/executor/approval-store");

    await createControlledExecutionRun({
      id: "exec-durable-approval",
      requestId: "req-durable-approval",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan: {
        id: "plan-approval",
        goal: "approval",
        totalSteps: 1,
        requiresApproval: true,
        steps: [
          {
            id: "human_review",
            title: "Review",
            description: "Review",
            mode: "review",
            dependsOn: [],
            toolCalls: [{ toolName: "human_ask" }],
          },
        ],
      },
    });

    const promise = waitForApproval("exec-durable-approval", "human_review", 1_000);
    await resolveApproval("exec-durable-approval", "human_review", false, "not ready");
    await expect(promise).resolves.toEqual({ approved: false, feedback: "not ready" });

    const run = await getControlledExecutionRun("exec-durable-approval");
    expect(run?.state).toBe("failed");
    expect(run?.steps[0]?.approval).toMatchObject({
      state: "rejected",
      feedback: "not ready",
    });
  });
});
