import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { POST } from "@/app/api/runtime/executor/controlled-runs/[runId]/resume/route";
import {
  createControlledExecutionRun,
  updateControlledExecutionRun,
} from "@/lib/server/controlled-execution-store";

let tmpDir: string;
let originalCwd: () => string;
let originalApiToken: string | undefined;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "controlled-resume-route-test-"));
  originalCwd = process.cwd;
  originalApiToken = process.env.AGENTCORE_API_AUTH_TOKEN;
  process.cwd = () => tmpDir;
  delete process.env.AGENTCORE_API_AUTH_TOKEN;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  if (originalApiToken === undefined) {
    delete process.env.AGENTCORE_API_AUTH_TOKEN;
  } else {
    process.env.AGENTCORE_API_AUTH_TOKEN = originalApiToken;
  }
  await rm(tmpDir, { recursive: true, force: true });
});

async function seedRun(state: "running" | "completed" | "failed" | "cancelled") {
  await createControlledExecutionRun({
    id: `route-${state}`,
    requestId: `route-${state}`,
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-route-resume",
      goal: "route resume",
      totalSteps: 0,
      requiresApproval: false,
      steps: [],
    },
  });
  await updateControlledExecutionRun(`route-${state}`, { state });
}

async function seedResumableRun() {
  await createControlledExecutionRun({
    id: "route-resumable",
    requestId: "route-resumable",
    sessionId: "session-1",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    plan: {
      id: "plan-route-resumable",
      goal: "route resumable",
      totalSteps: 1,
      requiresApproval: false,
      steps: [
        {
          id: "route_step",
          title: "Route step",
          description: "Complete from the resume route",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
        },
      ],
    },
  });
}

describe("controlled run resume route", () => {
  it("returns 404 for a missing controlled run", async () => {
    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/missing/resume"),
      { params: Promise.resolve({ runId: "missing" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("Controlled run not found");
  });

  it("returns 409 for terminal controlled runs", async () => {
    await seedRun("completed");

    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/route-completed/resume"),
      { params: Promise.resolve({ runId: "route-completed" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Cannot resume completed controlled run");
  });

  it("returns the updated run and resumed step ids", async () => {
    await seedResumableRun();

    const response = await POST(
      new Request("http://localhost/api/runtime/executor/controlled-runs/route-resumable/resume"),
      { params: Promise.resolve({ runId: "route-resumable" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.state).toBe("completed");
    expect(data.data.resumedStepIds).toEqual(["route_step"]);
    expect(data.data.run.steps[0].state).toBe("completed");
  });
});
