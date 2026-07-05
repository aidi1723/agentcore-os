import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerTool } from "@/lib/executor/tools/registry";
import { resolveExecutionPlanFromPlaybook } from "@/lib/executor/playbooks/resolver";
import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import {
  createControlledExecutionRun,
  getControlledExecutionRun,
  resolveControlledApproval,
  updateControlledExecutionRun,
  updateControlledExecutionStep,
} from "@/lib/server/controlled-execution-store";
import { resumeControlledExecutionRun } from "@/lib/executor/runtime/resume";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-resume-test-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

const plan = resolveExecutionPlanFromPlaybook(salesPipelinePlaybook);

async function seedRun() {
  await createControlledExecutionRun({
    id: "resume-run-1",
    requestId: "resume-run-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan,
  });
  await updateControlledExecutionStep("resume-run-1", "intake", {
    state: "completed",
    output: {
      summary: "lead",
      missingFields: [],
      normalizedLead: { company: "ACME" },
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "qualify", {
    state: "completed",
    output: {
      priority: "high",
      reasons: ["fit"],
      risks: [],
      nextAction: "draft",
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "draft_outreach", {
    state: "completed",
    output: {
      subject: "Hi",
      body: "Body",
      assumptions: [],
      needsHumanCheck: [],
    },
    toolCallResults: [],
  });
  await updateControlledExecutionStep("resume-run-1", "human_review", {
    state: "awaiting_approval",
    approval: {
      executionId: "resume-run-1",
      stepId: "human_review",
      state: "pending",
      requestedAt: Date.now(),
    },
  });
  await updateControlledExecutionRun("resume-run-1", {
    state: "awaiting_approval",
    currentStepId: "human_review",
  });
}

function registerResumeTools(calls: string[]) {
  registerTool({
    name: "human_ask",
    description: "resume human ask",
    parameters: { type: "object" },
    requiresApproval: false,
    execute: async (params) => {
      const prompt = String((params as { prompt?: string }).prompt ?? "");
      calls.push(prompt);
      return {
        toolName: "human_ask",
        success: true,
        output: prompt.includes("把已批准结果写回")
          ? {
              salesAssetUpdated: true,
              knowledgeAssetCandidate: "Approved content",
            }
          : {
              approved: true,
              approvedBody: "Approved body",
              reviewNotes: "Approved",
            },
        durationMs: 0,
      };
    },
  });
}

describe("resumeControlledExecutionRun", () => {
  it("returns not_found for a missing run", async () => {
    const result = await resumeControlledExecutionRun("missing-run");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe("Controlled run not found");
  });

  it("refuses terminal runs", async () => {
    await seedRun();
    await updateControlledExecutionRun("resume-run-1", { state: "completed" });

    const result = await resumeControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain("Cannot resume completed controlled run");
  });

  it("does not execute tools while approval is pending", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();

    const result = await resumeControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toBe("Controlled run is awaiting approval");
    expect(calls).toEqual([]);
  });

  it("continues after durable approval without replaying completed steps", async () => {
    const calls: string[] = [];
    registerResumeTools(calls);
    await seedRun();
    await resolveControlledApproval("resume-run-1", "human_review", { approved: true });

    const result = await resumeControlledExecutionRun("resume-run-1");
    const run = await getControlledExecutionRun("resume-run-1");

    expect(result.ok).toBe(true);
    expect(result.resumedStepIds).toEqual(["human_review"]);
    expect(run?.state).toBe("awaiting_approval");
    expect(run?.currentStepId).toBe("writeback");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("人工确认草稿");
  });
});
