import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PRODUCTION_RELEASE_APPROVAL_CHECK_COMMAND,
  validateProductionReleaseApprovalPacket,
} from "@/lib/executor/playbooks/production-release-approval";

import {
  buildProductionReleasePolicyCheckCliResult,
} from "../release-policy/check-production-release-policy.mjs";

export { PRODUCTION_RELEASE_APPROVAL_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseProductionReleaseApprovalCheckArgs(argv) {
  const options = {
    approvalPath: undefined,
    pretty: true,
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
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.approvalPath) {
    throw new Error("--approval <path> is required");
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

export function buildProductionReleaseApprovalCheckCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const approvalPath = options.approvalPath;
  const approval = readJsonFile(
    resolve(cwd, approvalPath),
    "production release approval file is not valid JSON",
  );
  const productionPolicyPath = getStringField(
    approval,
    "productionPolicyPath",
  );

  const productionPolicyResult = productionPolicyPath
    ? (options.buildProductionPolicyResult ??
        buildProductionReleasePolicyCheckCliResult)({
        cwd,
        policyPath: productionPolicyPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };

  const report = validateProductionReleaseApprovalPacket(approval, {
    approvalPath,
    productionPolicyReport: parseCliJsonResult(productionPolicyResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseProductionReleaseApprovalCheckArgs(
    process.argv.slice(2),
  );
  const result = buildProductionReleaseApprovalCheckCliResult(options);
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
