import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";

const { parseOpenclawStatus } = await import("../lib/openclawStatus.ts");
const { parseJsonl } = await import("../lib/jsonl.ts");
const { getTaskboardSummary } = await import("../lib/taskboardSummary.ts");

test("parseOpenclawStatus extracts gateway and node count", () => {
  const parsed = parseOpenclawStatus(`Gateway: running\nPaired nodes: 3\nChannels: telegram`);

  assert.equal(parsed.gatewayOnline, true);
  assert.equal(parsed.nodesCount, 3);
  assert.equal(parsed.channelsHint, "Channels: telegram");
});

test("parseOpenclawStatus tolerates missing node info", () => {
  const parsed = parseOpenclawStatus(`daemon online\nno devices listed`);

  assert.equal(parsed.gatewayOnline, true);
  assert.equal(parsed.nodesCount, null);
});

test("parseJsonl skips invalid lines and preserves valid objects", () => {
  const rows = parseJsonl(`{"id":1}\nnot-json\n\n{"id":2,"name":"ok"}`);

  assert.deepEqual(rows, [{ id: 1 }, { id: 2, name: "ok" }]);
});

test("parseJsonl keeps later valid rows after truncated first line", () => {
  const rows = parseJsonl(`{"id":1\n{"id":2}\n{"id":3}`);

  assert.deepEqual(rows, [{ id: 2 }, { id: 3 }]);
});

test("getTaskboardSummary scans further back when the first tail chunk misses today's start event", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openclaw-os-taskboard-"));

  try {
    const taskboardDir = path.join(root, "taskboard");
    await mkdir(taskboardDir, { recursive: true });

    const tasksPath = path.join(taskboardDir, "tasks.json");
    const logPath = path.join(taskboardDir, "time_log.jsonl");
    const dayStartMs = 1_700_000_000_000;

    await writeFile(
      tasksPath,
      JSON.stringify({
        tasks: [{ id: "task-1", title: "Follow up quote", project: "proj-1" }],
        projects: [{ id: "proj-1", name: "Window Sales" }],
      }),
      "utf8",
    );

    const filler = Array.from({ length: 10 }, (_, index) =>
      JSON.stringify({
        ts: dayStartMs + 1_500 + index,
        action: "noop",
        task_id: `ignored-${index}`,
      }),
    ).join("\n");

    const logText = [
      JSON.stringify({ ts: dayStartMs - 1_000, action: "pause", task_id: "yesterday" }),
      JSON.stringify({ ts: dayStartMs + 1_000, action: "start", task_id: "task-1" }),
      filler,
      JSON.stringify({ ts: dayStartMs + 5_000, action: "pause", task_id: "task-1" }),
    ].join("\n");

    await writeFile(logPath, logText, "utf8");

    const summary = await getTaskboardSummary({
      tasksPath,
      logPath,
      dayStartMs,
      nowMs: dayStartMs + 9_000,
      tailChunkBytes: 160,
    });

    assert.equal(summary.totalMs, 4_000);
    assert.equal(summary.total, "00:00:04");
    assert.equal(summary.segs, 1);
    assert.equal(summary.topTasks[0]?.id, "task-1");
    assert.equal(summary.topProjects[0]?.id, "proj-1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
