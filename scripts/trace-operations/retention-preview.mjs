import path from "node:path";
import { pathToFileURL } from "node:url";
import { previewControlledExecutionRunRetention } from "@/lib/server/controlled-execution-store";

const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MIN_TERMINAL_RUNS = 20;

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parseFiniteNumber(value, option) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${option} must be a finite number.`);
  }
  return parsed;
}

function parseNonNegativeNumber(value, option) {
  const parsed = parseFiniteNumber(value, option);
  if (parsed < 0) {
    throw new Error(`${option} must be greater than or equal to 0.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, option) {
  const parsed = parseNonNegativeNumber(value, option);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${option} must be an integer.`);
  }
  return parsed;
}

export function parseRetentionPreviewArgs(argv) {
  const options = {
    maxAgeMs: DEFAULT_MAX_AGE_MS,
    minTerminalRunsToKeep: DEFAULT_MIN_TERMINAL_RUNS,
    now: undefined,
    cwd: undefined,
  };
  let sawMaxAgeMs = false;
  let sawMaxAgeDays = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--max-age-ms") {
      if (sawMaxAgeDays) {
        throw new Error("--max-age-ms and --max-age-days are mutually exclusive.");
      }
      sawMaxAgeMs = true;
      options.maxAgeMs = parseNonNegativeNumber(
        readOptionValue(argv, index, arg),
        arg,
      );
      index += 1;
      continue;
    }
    if (arg === "--max-age-days") {
      if (sawMaxAgeMs) {
        throw new Error("--max-age-ms and --max-age-days are mutually exclusive.");
      }
      sawMaxAgeDays = true;
      const days = parseNonNegativeNumber(readOptionValue(argv, index, arg), arg);
      options.maxAgeMs = days * 24 * 60 * 60 * 1000;
      index += 1;
      continue;
    }
    if (arg === "--min-terminal-runs") {
      options.minTerminalRunsToKeep = parseNonNegativeInteger(
        readOptionValue(argv, index, arg),
        arg,
      );
      index += 1;
      continue;
    }
    if (arg === "--now") {
      options.now = parseFiniteNumber(readOptionValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--cwd") {
      options.cwd = path.resolve(readOptionValue(argv, index, arg));
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function buildRetentionPreviewOutput(preview, dataCwd) {
  const active = preview.decisions.filter(
    (decision) => decision.reason === "active_run",
  ).length;
  const approvalBlocked = preview.decisions.filter(
    (decision) => decision.reason === "approval_blocked",
  ).length;
  const terminal = preview.decisions.length - active - approvalBlocked;

  return {
    ok: true,
    command: "trace:retention:preview",
    mode: "dry_run",
    dataCwd,
    policy: preview.policy,
    summary: {
      totalRuns: preview.decisions.length,
      kept: preview.keptRunIds.length,
      pruned: preview.prunedRunIds.length,
      active,
      approvalBlocked,
      terminal,
    },
    keptRunIds: preview.keptRunIds,
    prunedRunIds: preview.prunedRunIds,
    decisions: preview.decisions,
  };
}

export async function runRetentionPreviewCommand(argv = process.argv.slice(2)) {
  const options = parseRetentionPreviewArgs(argv);
  if (options.cwd) {
    process.chdir(options.cwd);
  }
  const dataCwd = process.cwd();
  const preview = await previewControlledExecutionRunRetention({
    now: options.now,
    maxAgeMs: options.maxAgeMs,
    minTerminalRunsToKeep: options.minTerminalRunsToKeep,
  });
  return buildRetentionPreviewOutput(preview, dataCwd);
}

async function main() {
  const output = await runRetentionPreviewCommand();
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
