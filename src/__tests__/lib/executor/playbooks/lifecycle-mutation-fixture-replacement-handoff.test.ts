import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND,
  validatePlaybookLifecycleMutationFixtureReplacementHandoff,
  type PlaybookLifecycleMutationFixtureReplacementHandoff,
} from "@/lib/executor/playbooks/lifecycle-mutation-fixture-replacement-handoff";

const candidateReviewPath =
  "docs/playbook-lifecycle-mutation-candidate-fixture-reviews/example-version-update-candidate-fixture-review.json";
const candidateFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const committedFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";

function greenCandidateReviewReport(overrides = {}) {
  return {
    ok: true,
    productionReady: false,
    publishingPerformed: false,
    reviewOnly: true,
    readyForManualFixtureReplacementReview: true,
    review: {
      catalogFixtureId: "sales-pipeline-governed",
      targetPlaybookId: "sales-pipeline-v1",
    },
    candidateFixturePath,
    committedFixturePath,
    findings: [],
    ...overrides,
  };
}

function handoff(
  overrides: Partial<PlaybookLifecycleMutationFixtureReplacementHandoff> = {},
): PlaybookLifecycleMutationFixtureReplacementHandoff {
  return {
    handoffId: "fixture-replacement-handoff-sales-pipeline-v1",
    owner: "agentcore-runtime-maintainers",
    candidateReviewPath,
    catalogFixtureId: "sales-pipeline-governed",
    targetPlaybookId: "sales-pipeline-v1",
    candidateFixturePath,
    committedFixturePath,
    replacementReason:
      "Prepare explicit manual committed fixture replacement after candidate review.",
    rollbackEvidence: {
      priorCommittedFixtureReviewed: true,
      replacementDiffReviewPlanned: true,
      scopedRestorePath: true,
      restorePlanDocumented: true,
      rollbackNotes: [
        "If post-replacement validation fails, revert only the committed governed fixture JSON change before retrying review.",
      ],
    },
    postReplacementValidationPlan: {
      governedFixtureCatalogGate: true,
      fixtureSummaryGate: true,
      controlledRuntimeGate: true,
      coreWorkflowGate: true,
      diffCheckGate: true,
      postReplacementEvidenceRequired: true,
    },
    replacementBoundary: {
      handoffOnly: true,
      committedFixtureReplacementPerformed: false,
      candidateFixtureGenerated: false,
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      productionReady: false,
    },
    replacementPolicy: "manual_replacement_requires_post_replacement_evidence",
    publishingPolicy: "no_publish_or_release",
    productionPolicy: "no_production_ready_claim",
    approvalStatus: "fixture_replacement_handoff_only",
    notes: ["This handoff does not replace committed fixture JSON."],
    ...overrides,
  };
}

function validate(overrides = {}, options = {}) {
  return validatePlaybookLifecycleMutationFixtureReplacementHandoff(
    handoff(overrides),
    {
      handoffPath:
        "docs/playbook-lifecycle-mutation-fixture-replacement-handoffs/example-version-update-fixture-replacement-handoff.json",
      candidateReviewReport: greenCandidateReviewReport(),
      ...options,
    },
  );
}

describe("validatePlaybookLifecycleMutationFixtureReplacementHandoff", () => {
  it("accepts a replacement handoff with green candidate review and rollback evidence", () => {
    const report = validate();

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      handoffOnly: true,
      readyForManualCommittedFixtureReplacement: true,
      status: "fixture_replacement_handoff_ready",
      checks: {
        candidateReviewOk: true,
        targetAligned: true,
        fixturePathsAligned: true,
        committedFixturePathScoped: true,
        rollbackEvidenceComplete: true,
        postReplacementValidationPlanComplete: true,
        replacementBoundaryOk: true,
        policiesOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when candidate review is not green", () => {
    const report = validate({}, {
      candidateReviewReport: greenCandidateReviewReport({
        ok: false,
        readyForManualFixtureReplacementReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "candidate_fixture_review_not_green",
      readyForManualCommittedFixtureReplacement: false,
      findings: [
        expect.objectContaining({
          code: "invalid_candidate_fixture_review",
        }),
      ],
    });
  });

  it("requires target and fixture paths to match the candidate review", () => {
    const report = validate({
      catalogFixtureId: "support-resolution-governed",
      targetPlaybookId: "support-resolution-v1",
      candidateFixturePath:
        "src/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json",
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "target_or_catalog_mismatch",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "fixture_path_mismatch",
      }),
    );
  });

  it("requires scoped committed fixture path", () => {
    const report = validate({
      committedFixturePath: "output/tmp/replacement.fixture.json",
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "committed_fixture_path_out_of_scope",
        field: "committedFixturePath",
      }),
    );
  });

  it("requires rollback evidence and post-replacement validation plan", () => {
    const report = validate({
      rollbackEvidence: {
        priorCommittedFixtureReviewed: true,
        replacementDiffReviewPlanned: false,
        scopedRestorePath: true,
        restorePlanDocumented: true,
        rollbackNotes: [],
      },
      postReplacementValidationPlan: {
        governedFixtureCatalogGate: true,
        fixtureSummaryGate: false,
        controlledRuntimeGate: true,
        coreWorkflowGate: true,
        diffCheckGate: true,
        postReplacementEvidenceRequired: true,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "incomplete_rollback_evidence",
        field: "rollbackEvidence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "incomplete_post_replacement_validation_plan",
        field: "postReplacementValidationPlan",
      }),
    );
  });

  it("blocks side effects, publishing, and production-ready claims", () => {
    const report = validate({
      replacementBoundary: {
        handoffOnly: true,
        committedFixtureReplacementPerformed: true,
        candidateFixtureGenerated: false,
        fixtureRefreshPerformed: true,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: true,
        productionReady: true,
      },
      approvalStatus: "approved_for_publish" as never,
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "fixture_replacement_side_effect_performed",
        field: "replacementBoundary",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_approval_status",
        field: "approvalStatus",
      }),
    );
  });
});
