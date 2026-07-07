import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  RELEASE_EXECUTION_PLAN_CHECK_COMMAND,
  validateReleaseExecutionPlan,
} from "@/lib/executor/playbooks/release-execution-plan";

import {
  buildProductionReleaseApprovalCheckCliResult,
} from "../release-approval/check-production-release-approval.mjs";

export { RELEASE_EXECUTION_PLAN_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseReleaseExecutionPlanCheckArgs(argv) {
  const options = {
    planPath: undefined,
    pretty: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--plan") {
      options.planPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.planPath) {
    throw new Error("--plan <path> is required");
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

export function buildReleaseExecutionPlanCheckCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const planPath = options.planPath;
  const plan = readJsonFile(
    resolve(cwd, planPath),
    "release execution plan file is not valid JSON",
  );
  const approvalPath = getStringField(plan, "approvalPath");

  const approvalResult = approvalPath
    ? (options.buildProductionApprovalResult ??
        buildProductionReleaseApprovalCheckCliResult)({
        cwd,
        approvalPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };

  const report = validateReleaseExecutionPlan(plan, {
    planPath,
    approvalReport: parseCliJsonResult(approvalResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseReleaseExecutionPlanCheckArgs(process.argv.slice(2));
  const result = buildReleaseExecutionPlanCheckCliResult(options);
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
