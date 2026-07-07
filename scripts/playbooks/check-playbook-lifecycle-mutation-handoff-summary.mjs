import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND,
  validatePlaybookLifecycleMutationHandoffSummary,
} from "@/lib/executor/playbooks/lifecycle-mutation-handoff-summary";

import {
  buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult,
} from "./check-playbook-lifecycle-mutation-release-handoff-review.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND };

export function parsePlaybookLifecycleMutationHandoffSummaryArgs(argv) {
  const options = {
    pretty: true,
    summaryPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--summary") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--summary requires a path value");
      }
      options.summaryPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.summaryPath) {
    throw new Error("--summary <path> is required");
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

export function buildPlaybookLifecycleMutationHandoffSummaryCliResult(options) {
  const cwd = options.cwd ?? process.cwd();
  const summaryPath = options.summaryPath;
  const summary = readJsonFile(
    resolve(cwd, summaryPath),
    "handoff summary file is not valid JSON",
  );
  const releaseHandoffReviewPath = getStringField(
    summary,
    "releaseHandoffReviewPath",
  );
  const releaseHandoffReviewResult = releaseHandoffReviewPath
    ? buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult({
        cwd,
        reviewPath: releaseHandoffReviewPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };
  const releaseHandoffReviewReport = JSON.parse(
    releaseHandoffReviewResult.stdout,
  );

  const report = validatePlaybookLifecycleMutationHandoffSummary(summary, {
    summaryPath,
    releaseHandoffReviewReport,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationHandoffSummaryArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationHandoffSummaryCliResult(options);
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
