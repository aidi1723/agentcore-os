import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND,
  validatePlaybookLifecycleMutationFixtureReplacementHandoff,
} from "@/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff";

import {
  buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult,
} from "./check-playbook-lifecycle-mutation-candidate-fixture-review.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND };

export function parsePlaybookLifecycleMutationFixtureReplacementHandoffArgs(argv) {
  const options = {
    pretty: true,
    handoffPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--handoff") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--handoff requires a path value");
      }
      options.handoffPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.handoffPath) {
    throw new Error("--handoff <path> is required");
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

export function buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult(
  options,
) {
  const cwd = options.cwd ?? process.cwd();
  const handoffPath = options.handoffPath;
  const handoff = readJsonFile(
    resolve(cwd, handoffPath),
    "fixture replacement handoff file is not valid JSON",
  );
  const candidateReviewPath = getStringField(handoff, "candidateReviewPath");
  const candidateReviewResult = candidateReviewPath
    ? buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult({
        cwd,
        reviewPath: candidateReviewPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };
  const candidateReviewReport = JSON.parse(candidateReviewResult.stdout);

  const report = validatePlaybookLifecycleMutationFixtureReplacementHandoff(
    handoff,
    {
      handoffPath,
      candidateReviewReport,
    },
  );

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationFixtureReplacementHandoffArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult(
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
