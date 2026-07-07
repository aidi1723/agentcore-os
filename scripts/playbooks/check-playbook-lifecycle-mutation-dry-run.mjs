import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND,
  validatePlaybookLifecycleMutationDryRun,
} from "@/lib/executor/playbooks/lifecycle-mutation-dry-run";

import {
  buildPlaybookLifecycleMigrationPlanCliResult,
} from "./check-playbook-lifecycle-migration-plan.mjs";
import {
  buildPlaybookLifecycleMutationApprovalCliResult,
} from "./check-playbook-lifecycle-mutation-approval.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parsePlaybookLifecycleMutationDryRunArgs(argv) {
  const options = {
    pretty: true,
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

function getStringField(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return typeof value[field] === "string" ? value[field] : "";
}

export function buildPlaybookLifecycleMutationDryRunCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dryRunPath = options.dryRunPath;
  const dryRun = readJsonFile(
    resolve(cwd, dryRunPath),
    "mutation dry-run file is not valid JSON",
  );
  const approvalPath = getStringField(dryRun, "approvalPath");
  const migrationPlanPath = getStringField(dryRun, "migrationPlanPath");
  const approvalResult = (options.buildApprovalResult ??
    buildPlaybookLifecycleMutationApprovalCliResult)({
    cwd,
    approvalPath,
    now: options.now,
    currentCommit: options.currentCommit,
    pretty: false,
  });
  const migrationPlanResult = (options.buildMigrationPlanResult ??
    buildPlaybookLifecycleMigrationPlanCliResult)({
    cwd,
    planPath: migrationPlanPath,
    pretty: false,
  });
  const approvalReport = JSON.parse(approvalResult.stdout);
  const migrationPlanReport = JSON.parse(migrationPlanResult.stdout);
  const report = validatePlaybookLifecycleMutationDryRun(dryRun, {
    dryRunPath,
    approvalReport,
    migrationPlanReport,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationDryRunArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationDryRunCliResult(options);
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
