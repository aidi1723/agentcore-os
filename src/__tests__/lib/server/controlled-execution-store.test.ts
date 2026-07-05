import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
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
});
