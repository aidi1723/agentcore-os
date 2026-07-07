import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  DELIVERY_CANDIDATE_CHECK_COMMAND,
  validateDeliveryCandidateReadiness,
} from "@/lib/executor/playbooks/delivery-candidate-readiness";

import {
  buildDeliveryReadyReport,
} from "../delivery-ready/check-delivery-ready.mjs";
import {
  buildPlaybookLifecycleMutationHandoffSummaryCliResult,
} from "../playbooks/check-playbook-lifecycle-mutation-handoff-summary.mjs";

export { DELIVERY_CANDIDATE_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseDeliveryCandidateCheckArgs(argv) {
  const options = {
    candidatePath: undefined,
    pretty: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--candidate") {
      options.candidatePath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.candidatePath) {
    throw new Error("--candidate <path> is required");
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

function buildDeliveryReadyCliResult(options = {}) {
  const result = buildDeliveryReadyReport(options.deliveryReadyOptions);
  return {
    exitCode: result.exitCode,
    stdout: `${JSON.stringify(result.report)}\n`,
  };
}

export function buildDeliveryCandidateCheckCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const candidatePath = options.candidatePath;
  const candidate = readJsonFile(
    resolve(cwd, candidatePath),
    "delivery candidate file is not valid JSON",
  );
  const handoffSummaryPath = getStringField(candidate, "handoffSummaryPath");

  const handoffSummaryResult = handoffSummaryPath
    ? (options.buildHandoffSummaryResult ??
        buildPlaybookLifecycleMutationHandoffSummaryCliResult)({
        cwd,
        summaryPath: handoffSummaryPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };
  const deliveryReadyResult = (options.buildDeliveryReadyResult ??
    buildDeliveryReadyCliResult)({
    pretty: false,
  });

  const report = validateDeliveryCandidateReadiness(candidate, {
    candidatePath,
    handoffSummaryReport: parseCliJsonResult(handoffSummaryResult),
    deliveryReadyReport: parseCliJsonResult(deliveryReadyResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseDeliveryCandidateCheckArgs(process.argv.slice(2));
  const result = buildDeliveryCandidateCheckCliResult(options);
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
