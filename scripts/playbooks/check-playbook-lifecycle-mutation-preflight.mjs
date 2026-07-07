import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND,
  validatePlaybookLifecycleMutationPreflight,
} from "@/lib/executor/playbooks/lifecycle-mutation-preflight";

import {
  buildProjectCloseoutCheckCliResult,
} from "../project-closeout/check-project-closeout.mjs";
import {
  buildPlaybookLifecycleMutationDryRunCliResult,
} from "./check-playbook-lifecycle-mutation-dry-run.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parsePlaybookLifecycleMutationPreflightArgs(argv) {
  const options = {
    pretty: true,
    evidencePath: undefined,
    dryRunPath: undefined,
    now: undefined,
    currentCommit: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
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
    throw new Error(`Unknown option: ${arg}`);
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

function parseCliJsonResult(result) {
  return JSON.parse(result.stdout);
}

export function buildPlaybookLifecycleMutationPreflightCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = readJsonFile(
    resolve(cwd, options.dryRunPath),
    "mutation dry-run file is not valid JSON",
  );
  const closeoutResult = (options.buildCloseoutResult ??
    buildProjectCloseoutCheckCliResult)({
    cwd,
    evidencePath: options.evidencePath,
    dryRunPath: options.dryRunPath,
    now: options.now,
    currentCommit: options.currentCommit,
    pretty: false,
  });
  const dryRunResult = (options.buildDryRunResult ??
    buildPlaybookLifecycleMutationDryRunCliResult)({
    cwd,
    dryRunPath: options.dryRunPath,
    now: options.now,
    currentCommit: options.currentCommit,
    pretty: false,
  });
  const report = validatePlaybookLifecycleMutationPreflight(dryRun, {
    dryRunPath: options.dryRunPath,
    evidencePath: options.evidencePath,
    closeoutReport: parseCliJsonResult(closeoutResult),
    dryRunReport: parseCliJsonResult(dryRunResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationPreflightArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationPreflightCliResult(options);
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
