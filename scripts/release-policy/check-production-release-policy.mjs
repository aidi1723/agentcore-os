import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PRODUCTION_RELEASE_POLICY_CHECK_COMMAND,
  validateProductionReleasePolicy,
} from "@/lib/executor/playbooks/production-release-policy";

import {
  buildDeliveryCandidateCheckCliResult,
} from "../delivery-candidate/check-delivery-candidate.mjs";

export { PRODUCTION_RELEASE_POLICY_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseProductionReleasePolicyCheckArgs(argv) {
  const options = {
    policyPath: undefined,
    pretty: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--policy") {
      options.policyPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.policyPath) {
    throw new Error("--policy <path> is required");
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

export function buildProductionReleasePolicyCheckCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const policyPath = options.policyPath;
  const policy = readJsonFile(
    resolve(cwd, policyPath),
    "production release policy file is not valid JSON",
  );
  const deliveryCandidatePath = getStringField(policy, "deliveryCandidatePath");

  const deliveryCandidateResult = deliveryCandidatePath
    ? (options.buildDeliveryCandidateResult ??
        buildDeliveryCandidateCheckCliResult)({
        cwd,
        candidatePath: deliveryCandidatePath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };

  const report = validateProductionReleasePolicy(policy, {
    policyPath,
    deliveryCandidateReport: parseCliJsonResult(deliveryCandidateResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseProductionReleasePolicyCheckArgs(process.argv.slice(2));
  const result = buildProductionReleasePolicyCheckCliResult(options);
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
