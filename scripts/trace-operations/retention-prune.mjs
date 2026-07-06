import { pathToFileURL } from "node:url";
import {
  buildRetentionPreviewOutput,
  parseRetentionPreviewArgs,
} from "./retention-preview.mjs";
import {
  previewControlledExecutionRunRetention,
  pruneControlledExecutionRuns,
} from "@/lib/server/controlled-execution-store";

function normalizeRunIdList(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return [];
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortedUniqueIds(ids) {
  return Array.from(new Set(ids)).sort((left, right) => left.localeCompare(right, "en"));
}

function sameIdSet(left, right) {
  const normalizedLeft = sortedUniqueIds(left);
  const normalizedRight = sortedUniqueIds(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

export function parseRetentionPruneArgs(argv) {
  const policyArgs = [];
  let confirmPrune = false;
  let expectedPrunedRunIds = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--confirm-prune") {
      confirmPrune = true;
      continue;
    }
    if (arg === "--expected-pruned-run-ids") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--expected-pruned-run-ids requires a value.");
      }
      expectedPrunedRunIds = normalizeRunIdList(value);
      index += 1;
      continue;
    }
    policyArgs.push(arg);
    if (
      [
        "--max-age-ms",
        "--max-age-days",
        "--min-terminal-runs",
        "--now",
        "--cwd",
      ].includes(arg)
    ) {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        policyArgs.push(value);
        index += 1;
      }
    }
  }

  if (!confirmPrune) {
    throw new Error("--confirm-prune is required before retention pruning.");
  }
  if (!expectedPrunedRunIds) {
    throw new Error("--expected-pruned-run-ids is required before retention pruning.");
  }

  return {
    ...parseRetentionPreviewArgs(policyArgs),
    confirmPrune,
    expectedPrunedRunIds: sortedUniqueIds(expectedPrunedRunIds),
  };
}

export function buildRetentionPruneOutput({ preview, prune, dataCwd, expectedPrunedRunIds }) {
  const previewOutput = buildRetentionPreviewOutput(preview, dataCwd);
  const activeKept = preview.decisions.filter(
    (decision) => decision.action === "keep" && decision.reason === "active_run",
  ).length;
  const approvalBlockedKept = preview.decisions.filter(
    (decision) => decision.action === "keep" && decision.reason === "approval_blocked",
  ).length;

  return {
    ok: true,
    command: "trace:retention:prune",
    mode: "guarded_prune",
    dataCwd,
    guard: {
      confirmed: true,
      expectedPrunedRunIds,
      matchedPreview: true,
    },
    preview: previewOutput,
    prune,
    handoff: {
      pruned: prune.prunedRunIds.length,
      kept: prune.keptRunIds.length,
      activeKept,
      approvalBlockedKept,
    },
  };
}

export async function runRetentionPruneCommand(argv = process.argv.slice(2)) {
  const options = parseRetentionPruneArgs(argv);
  if (options.cwd) {
    process.chdir(options.cwd);
  }

  const dataCwd = process.cwd();
  const policy = {
    now: options.now,
    maxAgeMs: options.maxAgeMs,
    minTerminalRunsToKeep: options.minTerminalRunsToKeep,
  };
  const preview = await previewControlledExecutionRunRetention(policy);

  if (!sameIdSet(preview.prunedRunIds, options.expectedPrunedRunIds)) {
    throw new Error(
      `Expected pruned run ids do not match current retention preview. expected=${options.expectedPrunedRunIds.join(",") || "none"} actual=${preview.prunedRunIds.join(",") || "none"}`,
    );
  }

  const prune =
    preview.prunedRunIds.length === 0
      ? { prunedRunIds: [], keptRunIds: preview.keptRunIds }
      : await pruneControlledExecutionRuns(policy);
  return buildRetentionPruneOutput({
    preview,
    prune,
    dataCwd,
    expectedPrunedRunIds: options.expectedPrunedRunIds,
  });
}

async function main() {
  const output = await runRetentionPruneCommand();
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
