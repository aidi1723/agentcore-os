import salesPipelineFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json" with { type: "json" };
import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND,
  validatePlaybookLifecycleMutationCandidateFixtureReview,
  type PlaybookLifecycleMutationCandidateFixtureReview,
} from "@/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";
import {
  validateControlledTraceFixture,
  type ControlledTraceFixture,
} from "@/lib/executor/runtime/trace-fixtures";

const handoffPath =
  "docs/playbook-lifecycle-mutation-fixture-refresh-handoffs/example-version-update-fixture-refresh-handoff.json";
const candidateFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const committedFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";

const candidateFixture = salesPipelineFixture as ControlledTraceFixture;

function greenHandoffReport(overrides = {}) {
  return {
    ok: true,
    productionReady: false,
    publishingPerformed: false,
    handoffOnly: true,
    readyForFixtureRefreshReview: true,
    handoff: {
      targetPlaybookId: "sales-pipeline-v1",
      intendedFixtureIds: ["sales-pipeline-governed"],
    },
    findings: [],
    ...overrides,
  };
}

function review(
  overrides: Partial<PlaybookLifecycleMutationCandidateFixtureReview> = {},
): PlaybookLifecycleMutationCandidateFixtureReview {
  return {
    reviewId: "candidate-fixture-review-sales-pipeline-v1",
    owner: "agentcore-runtime-maintainers",
    handoffPath,
    catalogFixtureId: "sales-pipeline-governed",
    candidateFixturePath,
    committedFixturePath,
    targetPlaybookId: "sales-pipeline-v1",
    reviewReason: "Validate fixture candidate before any committed fixture replacement.",
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
  };
}

function validate(overrides = {}, options = {}) {
  return validatePlaybookLifecycleMutationCandidateFixtureReview(
    review(overrides),
    {
      reviewPath:
        "docs/playbook-lifecycle-mutation-candidate-fixture-reviews/example-version-update-candidate-fixture-review.json",
      handoffReport: greenHandoffReport(),
      candidateFixture,
      committedFixture: candidateFixture,
      candidateValidation: validateControlledTraceFixture(candidateFixture),
      candidateReplay: replayControlledTraceFixture(candidateFixture),
      candidateSensitiveStringMatches: [],
      ...options,
    },
  );
}

describe("validatePlaybookLifecycleMutationCandidateFixtureReview", () => {
  it("accepts a reviewed candidate fixture with green handoff, validation, and replay", () => {
    const report = validate();

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      reviewOnly: true,
      readyForManualFixtureReplacementReview: true,
      status: "candidate_fixture_review_ready",
      summary: {
        findings: 0,
        candidateValidationErrors: 0,
        candidateReplayErrors: 0,
        sensitiveStringMatches: 0,
      },
      checks: {
        handoffOk: true,
        catalogFixtureIntended: true,
        targetPlaybookAligned: true,
        candidateFixtureValid: true,
        candidateReplayOk: true,
        reviewEvidenceComplete: true,
        sensitiveStringSearchOk: true,
        reviewBoundaryOk: true,
        policiesOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when the fixture refresh handoff is not green", () => {
    const report = validate({}, {
      handoffReport: greenHandoffReport({
        ok: false,
        readyForFixtureRefreshReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "fixture_refresh_handoff_not_green",
      readyForManualFixtureReplacementReview: false,
      findings: [
        expect.objectContaining({
          code: "invalid_fixture_refresh_handoff",
        }),
      ],
    });
  });

  it("requires catalog fixture id and target playbook to match the handoff", () => {
    const report = validate({
      catalogFixtureId: "support-resolution-governed",
      targetPlaybookId: "support-resolution-v1",
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "catalog_fixture_not_intended",
        field: "catalogFixtureId",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "target_playbook_mismatch",
        field: "targetPlaybookId",
      }),
    );
  });

  it("fails when candidate validation or replay is not green", () => {
    const brokenFixture = {
      ...candidateFixture,
      sourceRunId: "",
      steps: candidateFixture.steps.map((step, index) =>
        index === 0 ? { ...step, hasRedactedInput: false } : step,
      ),
    };
    const report = validate({}, {
      candidateFixture: brokenFixture,
      candidateValidation: validateControlledTraceFixture(brokenFixture),
      candidateReplay: replayControlledTraceFixture(brokenFixture),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "candidate_fixture_not_valid",
      checks: {
        candidateFixtureValid: false,
        candidateReplayOk: false,
      },
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "candidate_fixture_validation_failed",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "candidate_fixture_replay_failed",
      }),
    );
  });

  it("requires review evidence and blocks replacement side effects", () => {
    const report = validate({
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
      reviewBoundary: {
        reviewOnly: true,
        candidateFixtureProvided: true,
        committedFixtureReplaced: true,
        fixtureRefreshPerformed: true,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: true,
        productionReady: true,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "incomplete_review_evidence",
        field: "reviewEvidence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "candidate_review_side_effect_performed",
        field: "reviewBoundary",
      }),
    );
  });

  it("fails when sensitive marker scan finds unsafe candidate text", () => {
    const report = validate({}, {
      candidateSensitiveStringMatches: ["sk-live-example"],
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "sensitive_marker_detected",
        field: "candidateFixturePath",
      }),
    );
  });
});
