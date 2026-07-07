import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND,
  buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult,
  parsePlaybookLifecycleMutationCandidateFixtureReviewArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-candidate-fixture-review.mjs";

const handoffPath =
  "docs/playbook-lifecycle-mutation-fixture-refresh-handoffs/example-version-update-fixture-refresh-handoff.json";
const candidateFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const committedFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const exampleReviewPath =
  "docs/playbook-lifecycle-mutation-candidate-fixture-reviews/example-version-update-candidate-fixture-review.json";

function createReviewFile(overrides = {}) {
  const cwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "playbook-candidate-fixture-review-"));
  const reviewPath = join(dir, "candidate-fixture-review.json");
  writeFileSync(
    reviewPath,
    `${JSON.stringify(
      {
        reviewId: "candidate-fixture-review-sales-pipeline-v1",
        owner: "agentcore-runtime-maintainers",
        handoffPath,
        catalogFixtureId: "sales-pipeline-governed",
        candidateFixturePath,
        committedFixturePath,
        targetPlaybookId: "sales-pipeline-v1",
        reviewReason:
          "Validate fixture candidate before any committed fixture replacement.",
        reviewEvidence: {
          sourceIdentityGate: true,
          redactionGate: true,
          playbookContractGate: true,
          approvalTerminalStateGate: true,
          writebackIdentityGate: true,
          failureTriageGate: true,
          sensitiveStringSearchGate: true,
          replacementDiffGate: true,
          catalogGate: true,
          runtimeRegressionGate: true,
          rollbackNotes: [
            "Reject the candidate if validation, replay, sensitive string search, or replacement diff review fails.",
          ],
        },
        reviewBoundary: {
          reviewOnly: true,
          candidateFixtureProvided: true,
          committedFixtureReplaced: false,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
        },
        candidatePolicy: "manual_committed_fixture_replacement_required",
        publishingPolicy: "no_publish_or_release",
        productionPolicy: "no_production_ready_claim",
        approvalStatus: "candidate_fixture_review_only",
        notes: ["This review does not replace committed fixture JSON."],
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, reviewPath };
}

describe("playbook lifecycle mutation candidate fixture review script", () => {
  it("parses review and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationCandidateFixtureReviewArgs([
        "--review",
        exampleReviewPath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      reviewPath: exampleReviewPath,
    });
  });

  it("requires a review path", () => {
    expect(() => parsePlaybookLifecycleMutationCandidateFixtureReviewArgs([])).toThrow(
      "--review <path> is required",
    );
  });

  it("builds a successful CLI result for a valid candidate fixture review", () => {
    const { cwd, reviewPath } = createReviewFile();
    const result = buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult({
      cwd,
      reviewPath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      reviewOnly: true,
      readyForManualFixtureReplacementReview: true,
      reviewPath,
      handoffPath,
      candidateFixturePath,
      committedFixturePath,
      summary: {
        findings: 0,
        candidateValidationErrors: 0,
        candidateReplayErrors: 0,
        sensitiveStringMatches: 0,
      },
    });
  });

  it("returns non-zero when candidate fixture review evidence is incomplete", () => {
    const { cwd, reviewPath } = createReviewFile({
      reviewEvidence: {
        sourceIdentityGate: true,
        redactionGate: false,
        playbookContractGate: true,
        approvalTerminalStateGate: true,
        writebackIdentityGate: true,
        failureTriageGate: true,
        sensitiveStringSearchGate: true,
        replacementDiffGate: true,
        catalogGate: true,
        runtimeRegressionGate: true,
        rollbackNotes: [],
      },
    });
    const result = buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult({
      cwd,
      reviewPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "incomplete_review_evidence",
        },
      ],
    });
  });

  it("returns non-zero when candidate fixture JSON has an invalid shape", () => {
    const dir = mkdtempSync(join(tmpdir(), "playbook-candidate-fixture-review-invalid-"));
    const invalidFixturePath = join(dir, "candidate.fixture.json");
    writeFileSync(invalidFixturePath, "{}\n");
    const { cwd, reviewPath } = createReviewFile({
      candidateFixturePath: invalidFixturePath,
    });
    const result = buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult({
      cwd,
      reviewPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "target_playbook_mismatch",
        },
        {
          code: "candidate_fixture_validation_failed",
        },
        {
          code: "candidate_fixture_replay_failed",
        },
      ],
    });
  });

  it("rejects invalid JSON candidate fixture review files", () => {
    const { cwd, reviewPath } = createReviewFile();
    writeFileSync(reviewPath, "not json");

    expect(() =>
      buildPlaybookLifecycleMutationCandidateFixtureReviewCliResult({
        cwd,
        reviewPath,
      }),
    ).toThrow("candidate fixture review file is not valid JSON");
  });
});
