import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND,
  runPlaybookLifecycleMutationExecutor,
} from "@/lib/executor/playbooks/lifecycle-mutation-executor";

import {
  buildPlaybookLifecycleMutationPreflightCliResult,
} from "./check-playbook-lifecycle-mutation-preflight.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parsePlaybookLifecycleMutationExecutorArgs(argv) {
  const options = {
    pretty: true,
    mode: "preview",
    manifestPath: undefined,
    evidencePath: undefined,
    dryRunPath: undefined,
    now: undefined,
    currentCommit: undefined,
    confirmApply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--mode") {
      const mode = readOptionValue(argv, index, arg);
      if (mode !== "preview" && mode !== "apply") {
        throw new Error("--mode must be preview or apply");
      }
      options.mode = mode;
      index += 1;
      continue;
    }
    if (arg === "--manifest") {
      options.manifestPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--evidence") {
      options.evidencePath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRunPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--now") {
      options.now = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--current-commit") {
      options.currentCommit = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--confirm-apply") {
      options.confirmApply = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.manifestPath) {
    throw new Error("--manifest <path> is required");
  }
  if (!options.evidencePath) {
    throw new Error("--evidence <path> is required");
  }
  if (!options.dryRunPath) {
    throw new Error("--dry-run <path> is required");
  }

  return options;
}

function readJsonFile(path, invalidMessage) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(invalidMessage);
    }
    throw error;
  }
}

function plannedTargetPathsFromDryRun(dryRun) {
  if (!dryRun || typeof dryRun !== "object" || Array.isArray(dryRun)) {
    return [];
  }
  if (!Array.isArray(dryRun.plannedTargets)) return [];
  return dryRun.plannedTargets
    .filter(
      (target) =>
        target &&
        typeof target === "object" &&
        !Array.isArray(target) &&
        target.kind === "registered_playbook_contract" &&
        target.operation === "update_contract" &&
        typeof target.path === "string",
    )
    .map((target) => target.path);
}

export function buildPlaybookLifecycleMutationExecutorCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const manifest = readJsonFile(
    resolve(cwd, options.manifestPath),
    "mutation manifest file is not valid JSON",
  );
  const dryRun = readJsonFile(
    resolve(cwd, options.dryRunPath),
    "mutation dry-run file is not valid JSON",
  );
  const preflightResult = (options.buildPreflightResult ??
    buildPlaybookLifecycleMutationPreflightCliResult)({
    cwd,
    evidencePath: options.evidencePath,
    dryRunPath: options.dryRunPath,
    now: options.now,
    currentCommit: options.currentCommit,
    pretty: false,
  });
  const preflightReport = JSON.parse(preflightResult.stdout);
  const report = runPlaybookLifecycleMutationExecutor(manifest, {
    cwd,
    mode: options.mode ?? "preview",
    confirmApply: options.confirmApply === true,
    dryRunPath: options.dryRunPath,
    evidencePath: options.evidencePath,
    preflightReport,
    allowedTargetPaths: plannedTargetPathsFromDryRun(dryRun),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationExecutorArgs(process.argv.slice(2));
  const result = buildPlaybookLifecycleMutationExecutorCliResult(options);
  process.stdout.write(result.stdout);
  process.exitCode = result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
