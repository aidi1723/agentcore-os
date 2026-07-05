import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GET } from "@/app/api/runtime/executor/controlled-runs/[runId]/route";
import { createControlledExecutionRun } from "@/lib/server/controlled-execution-store";

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

describe("controlled run route", () => {
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
});
