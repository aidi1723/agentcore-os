import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND,
  validatePlaybookLifecycleMutationApproval,
} from "@/lib/executor/playbooks/lifecycle-mutation-approval";

import {
  buildPlaybookLifecycleMaintenanceReadyCliResult,
} from "./check-playbook-lifecycle-maintenance-ready.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parsePlaybookLifecycleMutationApprovalArgs(argv) {
  const options = {
    pretty: true,
    approvalPath: undefined,
    now: undefined,
    currentCommit: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--approval") {
      options.approvalPath = readOptionValue(argv, index, arg);
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

  if (!options.approvalPath) {
    throw new Error("--approval <path> is required");
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

function missingEvidencePathReadinessResult() {
  return {
    exitCode: 1,
    stdout: `${JSON.stringify({
      ok: false,
      command: "playbook:lifecycle:maintenance:ready",
      evidencePath: "",
      readyForLifecycleMaintenance: false,
      productionReady: false,
      publishingPerformed: false,
      readinessOnly: true,
      status: "missing_evidence_path",
      nextCommand: "npm run playbook:lifecycle:maintenance:ready -- --evidence <path>",
    })}\n`,
  };
}

export function buildPlaybookLifecycleMutationApprovalCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const approvalPath = options.approvalPath;
  const approval = readJsonFile(
    resolve(cwd, approvalPath),
    "mutation approval file is not valid JSON",
  );
  const evidencePath = getStringField(approval, "evidencePath");
  const readinessResult = evidencePath
    ? (options.buildReadinessResult ?? buildPlaybookLifecycleMaintenanceReadyCliResult)({
        evidencePath,
        now: options.now,
        currentCommit: options.currentCommit,
        pretty: false,
      })
    : missingEvidencePathReadinessResult();
  const currentReadinessReport = JSON.parse(readinessResult.stdout);
  const report = validatePlaybookLifecycleMutationApproval(approval, {
    approvalPath,
    currentReadinessReport,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationApprovalArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationApprovalCliResult(options);
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
