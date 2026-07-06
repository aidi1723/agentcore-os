import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseRetentionPreviewArgs } from "../../../scripts/trace-operations/retention-preview.mjs";

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

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "trace-retention-preview-cli-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("trace retention preview script", () => {
  it("rejects invalid numeric options", () => {
    expect(() => parseRetentionPreviewArgs(["--max-age-ms", "soon"])).toThrow(
      "--max-age-ms must be a finite number.",
    );
    expect(() =>
      parseRetentionPreviewArgs(["--max-age-ms", "1000", "--max-age-days", "1"]),
    ).toThrow("--max-age-ms and --max-age-days are mutually exclusive.");
  });

  it("prints dry-run JSON and does not mutate controlled run storage", async () => {
    const dataDir = path.join(tmpDir, ".openclaw-data");
    const storeFile = path.join(dataDir, "controlled-execution-runs.json");
    await mkdir(dataDir, { recursive: true });

    const runs = [
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
    const originalJson = `${JSON.stringify(runs, null, 2)}\n`;
    await writeFile(storeFile, originalJson, "utf8");

    const result = spawnSync(
      "npm",
      [
        "run",
        "trace:retention:preview",
        "--silent",
        "--",
        "--cwd",
        tmpDir,
        "--now",
        "10000",
        "--max-age-ms",
        "1000",
        "--min-terminal-runs",
        "1",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");
    expect(await readFile(storeFile, "utf8")).toBe(originalJson);

    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      command: string;
      mode: string;
      summary: { totalRuns: number; kept: number; pruned: number };
      prunedRunIds: string[];
      decisions: Array<{ runId: string; action: string; reason: string }>;
    };
    expect(output).toMatchObject({
      ok: true,
      command: "trace:retention:preview",
      mode: "dry_run",
      summary: {
        totalRuns: 5,
        kept: 4,
        pruned: 1,
      },
      prunedRunIds: ["expired-completed"],
    });
    expect(output.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: "expired-completed",
          action: "prune",
          reason: "expired_terminal_run",
        }),
        expect.objectContaining({
          runId: "active-running",
          action: "keep",
          reason: "active_run",
        }),
        expect.objectContaining({
          runId: "approval-blocked",
          action: "keep",
          reason: "approval_blocked",
        }),
        expect.objectContaining({
          runId: "protected-failed",
          action: "keep",
          reason: "minimum_terminal_retention",
        }),
        expect.objectContaining({
          runId: "recent-cancelled",
          action: "keep",
          reason: "within_retention_window",
        }),
      ]),
    );
  });
});
