import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExecutionPlan } from "@/lib/executor/contracts";

let tmpDir: string;
let originalCwd: () => string;

const plan: ExecutionPlan = {
  id: "playbook:sales-pipeline-v1:1.0.0",
  goal: "Sales Pipeline Controlled Runtime",
  totalSteps: 2,
  requiresApproval: true,
  steps: [
    {
      id: "intake",
      title: "Intake",
      description: "Collect lead",
      mode: "assist",
      dependsOn: [],
      toolCalls: [{ toolName: "llm_generate" }],
    },
    {
      id: "human_review",
      title: "Review",
      description: "Review output",
      mode: "review",
      dependsOn: ["intake"],
      toolCalls: [{ toolName: "human_ask" }],
    },
  ],
};

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-store-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("controlled-execution-store", () => {
  it("creates and reads a controlled execution run", async () => {
    const { createControlledExecutionRun, getControlledExecutionRun } = await import(
      "@/lib/server/controlled-execution-store"
    );

    await createControlledExecutionRun({
      id: "exec-1",
      requestId: "req-1",
      sessionId: "session-1",
      workflowRunId: "workflow-1",
      scenarioId: "sales-pipeline",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    const run = await getControlledExecutionRun("exec-1");

    expect(run?.id).toBe("exec-1");
    expect(run?.state).toBe("running");
    expect(run?.steps.map((step) => step.stepId)).toEqual(["intake", "human_review"]);
    expect(run?.steps.map((step) => step.state)).toEqual(["pending", "pending"]);
  });

  it("updates step state and stores tool output", async () => {
    const {
      createControlledExecutionRun,
      getControlledExecutionRun,
      updateControlledExecutionStep,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-2",
      requestId: "req-2",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await updateControlledExecutionStep("exec-2", "intake", {
      state: "completed",
      input: { message: "hello" },
      output: { summary: "lead" },
      toolCallResults: [
        { toolName: "llm_generate", success: true, output: { summary: "lead" }, durationMs: 1 },
      ],
    });

    const run = await getControlledExecutionRun("exec-2");
    const step = run?.steps.find((item) => item.stepId === "intake");

    expect(step?.state).toBe("completed");
    expect(step?.input).toEqual({ message: "hello" });
    expect(step?.output).toEqual({ summary: "lead" });
    expect(step?.toolCallResults).toHaveLength(1);
  });

  it("persists and resolves approval records", async () => {
    const {
      createControlledExecutionRun,
      getControlledExecutionRun,
      requestControlledApproval,
      resolveControlledApproval,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-3",
      requestId: "req-3",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await requestControlledApproval("exec-3", "human_review");
    await resolveControlledApproval("exec-3", "human_review", {
      approved: false,
      feedback: "Needs revision",
    });

    const run = await getControlledExecutionRun("exec-3");
    const step = run?.steps.find((item) => item.stepId === "human_review");

    expect(run?.state).toBe("failed");
    expect(step?.approval).toMatchObject({
      state: "rejected",
      feedback: "Needs revision",
    });
  });

  it("queries runs by workflowRunId and requestId", async () => {
    const {
      createControlledExecutionRun,
      findControlledExecutionRunByRequestId,
      listControlledExecutionRuns,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-4",
      requestId: "req-4",
      sessionId: "session-1",
      workflowRunId: "workflow-4",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    expect((await findControlledExecutionRunByRequestId("req-4"))?.id).toBe("exec-4");
    expect((await listControlledExecutionRuns({ workflowRunId: "workflow-4" }))[0]?.id).toBe(
      "exec-4",
    );
  });

  it("persists controlled run audit events", async () => {
    const {
      appendControlledRunAuditEvent,
      createControlledExecutionRun,
      getControlledExecutionRun,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "exec-audit",
      requestId: "req-audit",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    expect((await getControlledExecutionRun("exec-audit"))?.auditEvents).toEqual([]);

    await appendControlledRunAuditEvent("exec-audit", {
      id: "audit-1",
      type: "console_retry_requested",
      stepId: "intake",
      message: "Retry from Runtime Console",
      createdAt: 123,
      actor: "local_user",
    });

    const run = await getControlledExecutionRun("exec-audit");

    expect(run?.auditEvents).toEqual([
      {
        id: "audit-1",
        type: "console_retry_requested",
        stepId: "intake",
        message: "Retry from Runtime Console",
        createdAt: 123,
        actor: "local_user",
      },
    ]);
  });

  it("prunes old terminal runs while keeping active and approval-blocked runs", async () => {
    const {
      createControlledExecutionRun,
      getControlledExecutionRun,
      pruneControlledExecutionRuns,
      requestControlledApproval,
      updateControlledExecutionRun,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "old-completed",
      requestId: "req-old-completed",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "old-running",
      requestId: "req-old-running",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "old-awaiting-approval",
      requestId: "req-old-awaiting-approval",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "newest-terminal",
      requestId: "req-newest-terminal",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    await updateControlledExecutionRun("old-completed", { state: "completed" });
    await requestControlledApproval("old-awaiting-approval", "human_review");
    await updateControlledExecutionRun("newest-terminal", { state: "failed" });

    const result = await pruneControlledExecutionRuns({
      now: 10_000_000_000_000,
      maxAgeMs: 1_000,
      minTerminalRunsToKeep: 1,
    });

    expect(result.prunedRunIds).toContain("old-completed");
    expect(result.prunedRunIds).not.toContain("old-running");
    expect(result.prunedRunIds).not.toContain("old-awaiting-approval");
    expect(result.prunedRunIds).not.toContain("newest-terminal");
    expect(await getControlledExecutionRun("old-completed")).toBeNull();
    expect(await getControlledExecutionRun("old-running")).not.toBeNull();
    expect(await getControlledExecutionRun("old-awaiting-approval")).not.toBeNull();
    expect(await getControlledExecutionRun("newest-terminal")).not.toBeNull();
  });

  it("previews retention decisions without mutating controlled runs", async () => {
    const {
      createControlledExecutionRun,
      getControlledExecutionRun,
      previewControlledExecutionRunRetention,
      pruneControlledExecutionRuns,
      requestControlledApproval,
      updateControlledExecutionRun,
    } = await import("@/lib/server/controlled-execution-store");

    await createControlledExecutionRun({
      id: "preview-old-completed",
      requestId: "req-preview-old-completed",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "preview-running",
      requestId: "req-preview-running",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "preview-awaiting-approval",
      requestId: "req-preview-awaiting-approval",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "preview-newest-terminal",
      requestId: "req-preview-newest-terminal",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });
    await createControlledExecutionRun({
      id: "preview-recent-terminal",
      requestId: "req-preview-recent-terminal",
      sessionId: "session-1",
      playbookId: "sales-pipeline-v1",
      playbookVersion: "1.0.0",
      plan,
    });

    await updateControlledExecutionRun("preview-old-completed", { state: "completed" });
    await requestControlledApproval("preview-awaiting-approval", "human_review");
    await updateControlledExecutionRun("preview-newest-terminal", { state: "failed" });
    await updateControlledExecutionRun("preview-recent-terminal", { state: "cancelled" });

    const storeFile = path.join(tmpDir, ".openclaw-data", "controlled-execution-runs.json");
    const rawRuns = JSON.parse(await readFile(storeFile, "utf8")) as Array<{
      id: string;
      updatedAt: number;
      finishedAt?: number;
    }>;
    const adjustedRuns = rawRuns.map((run) => {
      if (run.id === "preview-old-completed") {
        return { ...run, updatedAt: 1_000, finishedAt: 1_000 };
      }
      if (run.id === "preview-recent-terminal") {
        return { ...run, updatedAt: 9_999, finishedAt: 9_999 };
      }
      if (run.id === "preview-newest-terminal") {
        return { ...run, updatedAt: 10_000, finishedAt: 10_000 };
      }
      return run;
    });
    await writeFile(storeFile, `${JSON.stringify(adjustedRuns, null, 2)}\n`);

    const preview = await previewControlledExecutionRunRetention({
      now: 10_000,
      maxAgeMs: 1_000,
      minTerminalRunsToKeep: 1,
    });

    expect(preview.policy).toEqual({
      now: 10_000,
      maxAgeMs: 1_000,
      minTerminalRunsToKeep: 1,
      cutoff: 9_000,
    });
    expect(preview.prunedRunIds).toEqual(["preview-old-completed"]);
    expect(preview.keptRunIds).toEqual(
      expect.arrayContaining([
        "preview-running",
        "preview-awaiting-approval",
        "preview-newest-terminal",
        "preview-recent-terminal",
      ]),
    );
    expect(preview.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: "preview-old-completed",
          action: "prune",
          reason: "expired_terminal_run",
        }),
        expect.objectContaining({
          runId: "preview-running",
          action: "keep",
          reason: "active_run",
        }),
        expect.objectContaining({
          runId: "preview-awaiting-approval",
          action: "keep",
          reason: "approval_blocked",
        }),
        expect.objectContaining({
          runId: "preview-newest-terminal",
          action: "keep",
          reason: "minimum_terminal_retention",
        }),
        expect.objectContaining({
          runId: "preview-recent-terminal",
          action: "keep",
          reason: "within_retention_window",
        }),
      ]),
    );
    expect(await getControlledExecutionRun("preview-old-completed")).not.toBeNull();

    const prune = await pruneControlledExecutionRuns({
      now: 10_000,
      maxAgeMs: 1_000,
      minTerminalRunsToKeep: 1,
    });

    expect(prune.prunedRunIds).toEqual(preview.prunedRunIds);
    expect([...prune.keptRunIds].sort()).toEqual([...preview.keptRunIds].sort());
    expect(await getControlledExecutionRun("preview-old-completed")).toBeNull();
  });
});
