import fs from "fs/promises";
import { parseJsonl } from "./jsonl.ts";
import { TASKBOARD_LOG, TASKBOARD_TASKS } from "./paths.ts";

type LogEvent = {
  ts: number;
  action: string;
  task_id: string;
};

type Task = { id: string; title: string; project?: string };

type TasksFile = {
  tasks: Task[];
  projects?: { id: string; name: string }[];
};

export type TaskboardSummary = {
  ok: true;
  totalMs: number;
  total: string;
  segs: number;
  topTasks: { id: string; title: string; ms: number; hhmmss: string }[];
  topProjects: { id: string; name: string; ms: number; hhmmss: string }[];
  recent: { ts: number; action: string; task_id: string; title: string }[];
};

const MAX_LOG_BYTES = 256 * 1024;

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

async function readTaskboardLogForDay(
  logPath: string,
  dayStartMs: number,
  chunkBytes = MAX_LOG_BYTES,
) {
  let handle: fs.FileHandle | undefined;

  try {
    handle = await fs.open(logPath, "r");
    const stat = await handle.stat();
    const size = Math.max(0, stat.size);
    if (size === 0) return "";

    let start = size;
    let text = "";
    const safeChunkBytes = Math.max(1024, Math.floor(chunkBytes));

    while (start > 0) {
      const length = Math.min(start, safeChunkBytes);
      start -= length;

      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);

      text = buffer.toString("utf8") + text;
      if (start > 0) {
        const newline = text.indexOf("\n");
        if (newline < 0) continue;
        text = text.slice(newline + 1);
      }

      const events = parseJsonl<LogEvent>(text);
      if (events.length === 0) continue;

      const oldestTs = events.reduce(
        (min, event) =>
          Number.isFinite(event.ts) && event.ts < min ? event.ts : min,
        Number.POSITIVE_INFINITY,
      );
      if (!Number.isFinite(oldestTs) || oldestTs >= dayStartMs) continue;
      return text;
    }

    return text;
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return "";
    throw error;
  } finally {
    await handle?.close();
  }
}

type TaskboardSummaryOptions = {
  tasksPath?: string;
  logPath?: string;
  nowMs?: number;
  dayStartMs?: number;
  tailChunkBytes?: number;
};

export async function getTaskboardSummary(
  options: TaskboardSummaryOptions = {},
): Promise<TaskboardSummary> {
  const tasksPath = options.tasksPath || TASKBOARD_TASKS;
  const logPath = options.logPath || TASKBOARD_LOG;
  const dayStartMs = options.dayStartMs ?? startOfTodayMs();
  const nowMs = options.nowMs ?? Date.now();

  const tasksRaw = await fs.readFile(tasksPath, "utf8");
  const tf = JSON.parse(tasksRaw) as TasksFile;

  const tasksById = new Map(tf.tasks.map((t) => [t.id, t] as const));
  const projectsById = new Map((tf.projects || []).map((p) => [p.id, p] as const));

  const logText = await readTaskboardLogForDay(
    logPath,
    dayStartMs,
    options.tailChunkBytes ?? MAX_LOG_BYTES,
  );
  const events = parseJsonl<LogEvent>(logText);

  const today = events.filter((e) => e.ts >= dayStartMs && tasksById.has(e.task_id));

  const open = new Map<string, number>();
  const byTask = new Map<string, number>();

  let segs = 0;
  for (const e of today) {
    const act = (e.action || "").toLowerCase();
    if (act === "start") open.set(e.task_id, e.ts);
    if (act === "pause") {
      const st = open.get(e.task_id);
      if (st) {
        byTask.set(e.task_id, (byTask.get(e.task_id) || 0) + Math.max(0, e.ts - st));
        segs += 1;
        open.delete(e.task_id);
      }
    }
  }

  for (const [tid, st] of open) {
    byTask.set(tid, (byTask.get(tid) || 0) + Math.max(0, nowMs - st));
  }
  segs += open.size;

  const byProj = new Map<string, number>();
  for (const [tid, ms] of byTask) {
    const t = tasksById.get(tid)!;
    const pid = t.project || "unknown";
    byProj.set(pid, (byProj.get(pid) || 0) + ms);
  }

  const topTasks = [...byTask.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, ms]) => ({ id, title: tasksById.get(id)?.title || id, ms, hhmmss: fmtMs(ms) }));

  const topProjects = [...byProj.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, ms]) => ({ id, name: projectsById.get(id)?.name || id, ms, hhmmss: fmtMs(ms) }));

  const totalMs = [...byTask.values()].reduce((a, b) => a + b, 0);

  return {
    ok: true,
    totalMs,
    total: fmtMs(totalMs),
    segs,
    topTasks,
    topProjects,
    recent: today.slice(-10).map((e) => ({
      ts: e.ts,
      action: e.action,
      task_id: e.task_id,
      title: tasksById.get(e.task_id)?.title || e.task_id,
    })),
  };
}
