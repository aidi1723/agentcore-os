import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND,
  validatePlaybookLifecycleMutationReleaseHandoffReview,
} from "@/lib/executor/playbooks/lifecycle-mutation-release-handoff-review";

import {
  buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult,
} from "./check-playbook-lifecycle-mutation-post-replacement-evidence.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND };

export function parsePlaybookLifecycleMutationReleaseHandoffReviewArgs(argv) {
  const options = {
    pretty: true,
    reviewPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--review") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--review requires a path value");
      }
      options.reviewPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.reviewPath) {
    throw new Error("--review <path> is required");
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

export function buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult(
  options,
) {
  const cwd = options.cwd ?? process.cwd();
  const reviewPath = options.reviewPath;
  const review = readJsonFile(
    resolve(cwd, reviewPath),
    "release handoff review file is not valid JSON",
  );
  const postReplacementEvidencePath = getStringField(
    review,
    "postReplacementEvidencePath",
  );
  const postReplacementEvidenceResult = postReplacementEvidencePath
    ? buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult({
        cwd,
        evidencePath: postReplacementEvidencePath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };
  const postReplacementEvidenceReport = JSON.parse(
    postReplacementEvidenceResult.stdout,
  );

  const report = validatePlaybookLifecycleMutationReleaseHandoffReview(
    review,
    {
      reviewPath,
      postReplacementEvidenceReport,
    },
  );

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationReleaseHandoffReviewArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult(
    options,
  );
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
