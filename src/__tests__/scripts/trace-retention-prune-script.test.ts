import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseRetentionPruneArgs } from "../../../scripts/trace-operations/retention-prune.mjs";

let tmpDir: string;

const baseRun = {
  requestId: "req",
  sessionId: "session",
  playbookId: "sales-pipeline-v1",
  playbookVersion: "1.0.0",
  planId: "plan",
  plan: {
    id: "plan",
    goal: "Controlled runtime",
    totalSteps: 1,
    requiresApproval: false,
    steps: [],
  },
  steps: [],
};

function buildRuns() {
  return [
    {
      ...baseRun,
      id: "expired-completed",
      requestId: "req-expired-completed",
      state: "completed",
      createdAt: 1_000,
      updatedAt: 1_000,
      finishedAt: 1_000,
    },
    {
      ...baseRun,
      id: "active-running",
      requestId: "req-active-running",
      state: "running",
      createdAt: 1_000,
      updatedAt: 1_000,
    },
    {
      ...baseRun,
      id: "approval-blocked",
      requestId: "req-approval-blocked",
      state: "awaiting_approval",
      createdAt: 1_000,
      updatedAt: 1_000,
    },
    {
      ...baseRun,
      id: "protected-failed",
      requestId: "req-protected-failed",
      state: "failed",
      createdAt: 10_000,
      updatedAt: 10_000,
      finishedAt: 10_000,
    },
    {
      ...baseRun,
      id: "recent-cancelled",
      requestId: "req-recent-cancelled",
      state: "cancelled",
      createdAt: 9_999,
      updatedAt: 9_999,
      finishedAt: 9_999,
    },
  ];
}

async function writeRuns(records = buildRuns()) {
  const dataDir = path.join(tmpDir, ".openclaw-data");
  const storeFile = path.join(dataDir, "controlled-execution-runs.json");
  await mkdir(dataDir, { recursive: true });
  const json = `${JSON.stringify(records, null, 2)}\n`;
  await writeFile(storeFile, json, "utf8");
  return { storeFile, json };
}

function runPrune(args: string[]) {
  return spawnSync("npm", ["run", "trace:retention:prune", "--silent", "--", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "trace-retention-prune-cli-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("trace retention prune script", () => {
  it("rejects prune args without explicit confirmation", () => {
    expect(() =>
      parseRetentionPruneArgs([
        "--expected-pruned-run-ids",
        "expired-completed",
      ]),
    ).toThrow("--confirm-prune is required before retention pruning.");
  });

  it("refuses to prune without confirmation and leaves storage unchanged", async () => {
    const { storeFile, json } = await writeRuns();

    const result = runPrune([
      "--cwd",
      tmpDir,
      "--now",
      "10000",
      "--max-age-ms",
      "1000",
      "--min-terminal-runs",
      "1",
      "--expected-pruned-run-ids",
      "expired-completed",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--confirm-prune is required before retention pruning.");
    expect(await readFile(storeFile, "utf8")).toBe(json);
  });

  it("refuses stale expected prune ids and leaves storage unchanged", async () => {
    const { storeFile, json } = await writeRuns();

    const result = runPrune([
      "--cwd",
      tmpDir,
      "--now",
      "10000",
      "--max-age-ms",
      "1000",
      "--min-terminal-runs",
      "1",
      "--expected-pruned-run-ids",
      "other-run",
      "--confirm-prune",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(
      "Expected pruned run ids do not match current retention preview.",
    );
    expect(await readFile(storeFile, "utf8")).toBe(json);
  });

  it("prunes only matching expired terminal runs after explicit confirmation", async () => {
    const { storeFile } = await writeRuns();

    const result = runPrune([
      "--cwd",
      tmpDir,
      "--now",
      "10000",
      "--max-age-ms",
      "1000",
      "--min-terminal-runs",
      "1",
      "--expected-pruned-run-ids",
      "expired-completed",
      "--confirm-prune",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      mode: string;
      guard: {
        confirmed: boolean;
        expectedPrunedRunIds: string[];
        matchedPreview: boolean;
      };
      prune: { prunedRunIds: string[]; keptRunIds: string[] };
      handoff: {
        pruned: number;
        kept: number;
        activeKept: number;
        approvalBlockedKept: number;
      };
    };

    expect(output).toMatchObject({
      ok: true,
      command: "trace:retention:prune",
      mode: "guarded_prune",
      guard: {
        confirmed: true,
        expectedPrunedRunIds: ["expired-completed"],
        matchedPreview: true,
      },
      prune: {
        prunedRunIds: ["expired-completed"],
      },
      handoff: {
        pruned: 1,
        kept: 4,
        activeKept: 1,
        approvalBlockedKept: 1,
      },
    });

    const remaining = JSON.parse(await readFile(storeFile, "utf8")) as Array<{ id: string }>;
    expect(remaining.map((run) => run.id).sort()).toEqual([
      "active-running",
      "approval-blocked",
      "protected-failed",
      "recent-cancelled",
    ]);
  });

  it("accepts expected none when there are no prune candidates without rewriting storage", async () => {
    const freshRuns = buildRuns().map((run) => ({
      ...run,
      updatedAt: 10_000,
      finishedAt:
        run.state === "completed" || run.state === "failed" || run.state === "cancelled"
          ? 10_000
          : undefined,
    }));
    const { storeFile, json } = await writeRuns(freshRuns);

    const result = runPrune([
      "--cwd",
      tmpDir,
      "--now",
      "10000",
      "--max-age-ms",
      "1000",
      "--min-terminal-runs",
      "20",
      "--expected-pruned-run-ids",
      "none",
      "--confirm-prune",
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as {
      prune: { prunedRunIds: string[]; keptRunIds: string[] };
      handoff: { pruned: number; kept: number };
    };
    expect(output.prune.prunedRunIds).toEqual([]);
    expect(output.handoff).toMatchObject({ pruned: 0, kept: 5 });
    expect(await readFile(storeFile, "utf8")).toBe(json);
  });
});
