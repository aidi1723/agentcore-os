import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND,
  scanCandidateFixtureSensitiveMarkers,
  validatePlaybookLifecycleMutationCandidateFixtureReview,
} from "@/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review";
import {
  replayControlledTraceFixture,
} from "@/lib/executor/runtime/trace-replay";
import {
  validateControlledTraceFixture,
} from "@/lib/executor/runtime/trace-fixtures";

import {
  buildPlaybookLifecycleMutationFixtureRefreshHandoffCliResult,
} from "./check-playbook-lifecycle-mutation-fixture-refresh-handoff.mjs";

export { PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND };

export function parsePlaybookLifecycleMutationCandidateFixtureReviewArgs(argv) {
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

function safeValidateCandidateFixture(candidateFixture) {
  try {
    return validateControlledTraceFixture(candidateFixture);
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof Error ? error.message : String(error),
      ],
    };
  }
}

function safeReplayCandidateFixture(candidateFixture) {
  try {
    return replayControlledTraceFixture(candidateFixture);
  } catch (error) {
    return {
      ok: false,
      fixtureId: "",
      playbookId: "",
      checkedStepIds: [],
      errors: [
        error instanceof Error ? error.message : String(error),
      ],
      warnings: [],
      diagnostics: {
        fixtureId: "",
        playbookId: "",
        fixturePlaybookVersion: "",
        planStepOrder: [],
        expectedStepOrder: [],
        fixtureStepOrder: [],
        missingApprovalStepIds: [],
        missingWritebackTargets: [],
        missingCompletedStepAttempts: [],
        nonApprovedApprovalStepIds: [],
        writebackTargetsMissingStableMetadata: [],
      },
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    };
  }
}

export function buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult(
  options,
) {
  const cwd = options.cwd ?? process.cwd();
  const reviewPath = options.reviewPath;
  const review = readJsonFile(
    resolve(cwd, reviewPath),
    "candidate fixture review file is not valid JSON",
  );
  const handoffPath = getStringField(review, "handoffPath");
  const candidateFixturePath = getStringField(review, "candidateFixturePath");
  const committedFixturePath = getStringField(review, "committedFixturePath");

  const handoffResult = handoffPath
    ? buildPlaybookLifecycleMutationFixtureRefreshHandoffCliResult({
        cwd,
        handoffPath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };
  const handoffReport = JSON.parse(handoffResult.stdout);

  const candidateFixtureAbsolutePath = resolve(cwd, candidateFixturePath);
  const candidateFixtureText = candidateFixturePath
    ? readTextFile(candidateFixtureAbsolutePath)
    : "{}";
  const candidateFixture = candidateFixturePath
    ? JSON.parse(candidateFixtureText)
    : {};
  const committedFixture = committedFixturePath
    ? readJsonFile(
        resolve(cwd, committedFixturePath),
        "committed fixture file is not valid JSON",
      )
    : undefined;
  const candidateValidation = safeValidateCandidateFixture(candidateFixture);
  const candidateReplay = safeReplayCandidateFixture(candidateFixture);
  const candidateSensitiveStringMatches =
    scanCandidateFixtureSensitiveMarkers(candidateFixtureText);

  const report = validatePlaybookLifecycleMutationCandidateFixtureReview(review, {
    reviewPath,
    handoffReport,
    candidateFixture,
    committedFixture,
    candidateValidation,
    candidateReplay,
    candidateSensitiveStringMatches,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationCandidateFixtureReviewArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult(
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
