import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PRODUCTION_RELEASE_COMPLETION_EVIDENCE_CHECK_COMMAND,
  validateProductionReleaseCompletionEvidence,
} from "@/lib/executor/playbooks/production-release-completion-evidence";

import { buildReleaseExecutionApprovalCheckCliResult } from "./check-release-execution-approval.mjs";

export { PRODUCTION_RELEASE_COMPLETION_EVIDENCE_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseProductionReleaseCompletionEvidenceCheckArgs(argv) {
  const options = {
    evidencePath: undefined,
    pretty: true,
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.evidencePath) {
    throw new Error("--evidence <path> is required");
  }

  return options;
}

function readTextFile(path) {
  return readFileSync(path, "utf8");
}

function readJsonFile(path, invalidMessage) {
  try {
    return JSON.parse(readTextFile(path));
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

function parseCliJsonResult(result) {
  return JSON.parse(result.stdout);
}

export function buildProductionReleaseCompletionEvidenceCheckCliResult(
  options = {},
) {
  const cwd = options.cwd ?? process.cwd();
  const evidencePath = options.evidencePath;
  const evidence = readJsonFile(
    resolve(cwd, evidencePath),
    "production release completion evidence file is not valid JSON",
  );
  const releaseExecutionApprovalPath = getStringField(
    evidence,
    "releaseExecutionApprovalPath",
  );

  const releaseExecutionApprovalResult = releaseExecutionApprovalPath
    ? (options.buildReleaseExecutionApprovalResult ??
        buildReleaseExecutionApprovalCheckCliResult)({
        cwd,
        approvalPath: releaseExecutionApprovalPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };

  const report = validateProductionReleaseCompletionEvidence(evidence, {
    evidencePath,
    releaseExecutionApprovalReport: parseCliJsonResult(
      releaseExecutionApprovalResult,
    ),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseProductionReleaseCompletionEvidenceCheckArgs(
    process.argv.slice(2),
  );
  const result = buildProductionReleaseCompletionEvidenceCheckCliResult(options);
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
