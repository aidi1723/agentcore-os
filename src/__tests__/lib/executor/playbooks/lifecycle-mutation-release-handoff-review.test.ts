import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND,
  validatePlaybookLifecycleMutationReleaseHandoffReview,
  type PlaybookLifecycleMutationReleaseHandoffReview,
} from "@/lib/executor/playbooks/lifecycle-mutation-release-handoff-review";

const postReplacementEvidencePath =
  "docs/playbook-lifecycle-mutation-post-replacement-evidence/example-version-update-post-replacement-evidence.json";
const postReplacementCommand = `npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence ${postReplacementEvidencePath}`;

function greenPostReplacementEvidenceReport(overrides = {}) {
  return {
    ok: true,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    readyForReleaseHandoffReview: true,
    evidence: {
      evidenceId: "post-replacement-evidence-sales-pipeline-v1",
      owner: "agentcore-runtime-maintainers",
    },
    findings: [],
    ...overrides,
  };
}

function review(
  overrides: Partial<PlaybookLifecycleMutationReleaseHandoffReview> = {},
): PlaybookLifecycleMutationReleaseHandoffReview {
  return {
    reviewId: "release-handoff-review-sales-pipeline-v1",
    postReplacementEvidencePath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T10:30:00Z",
    reviewSummary: {
      postReplacementEvidenceAccepted: true,
      releaseHandoffEvidenceAccepted: true,
      rollbackAvailable: true,
      rollbackNotes: [
        "Revert the local playbook mutation commit and regenerate handoff evidence if release handoff review fails.",
      ],
      nextBoundary: "local_release_handoff_review_only",
    },
    commandResults: [
      {
        command: postReplacementCommand,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:30:01Z",
        postReplacementEvidence: "post_replacement_fixture_evidence_green",
        evidenceOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: "npm run release:handoff:check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:30:02Z",
        releaseClaim: "local_release_handoff_ready",
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: "npm run release:handoff:snapshot",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:30:03Z",
        snapshotEvidence: "release_handoff_snapshot_written",
        evidenceOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: "npm run release:handoff:evidence:status",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:30:04Z",
        readyForLocalHandoffEvidence: true,
        evidenceOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: "npm run release:handoff:evidence:audit",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:30:05Z",
        releaseHandoffEvidenceAudit: "release_handoff_evidence_audit_green",
        evidenceOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:30:06Z",
        diffCheck: "git_diff_check_green",
      },
    ],
    postReplacementEvidenceResult: {
      ok: true,
      evidenceOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    releaseHandoffReviewBoundary: {
      reviewOnly: true,
      commandsExecutedByChecker: false,
      snapshotGeneratedByChecker: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      tagCreated: false,
      packageBuilt: false,
      uploadPerformed: false,
      productionReady: false,
      readinessClaimed: false,
    },
    approvalStatus: "release_handoff_review",
    notes: ["This review records local handoff evidence only."],
    ...overrides,
  };
}

function validate(overrides = {}, options = {}) {
  return validatePlaybookLifecycleMutationReleaseHandoffReview(
    review(overrides),
    {
      reviewPath:
        "docs/playbook-lifecycle-mutation-release-handoff-reviews/example-version-update-release-handoff-review.json",
      postReplacementEvidenceReport: greenPostReplacementEvidenceReport(),
      ...options,
    },
  );
}

describe("validatePlaybookLifecycleMutationReleaseHandoffReview", () => {
  it("accepts ordered green release handoff review evidence", () => {
    const report = validate();

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      reviewOnly: true,
      readyForLocalReleaseHandoffReview: true,
      status: "release_handoff_review_ready",
      summary: {
        findings: 0,
        requiredCommands: 6,
        commandResults: 6,
      },
      checks: {
        postReplacementEvidenceOk: true,
        reviewSummaryAccepted: true,
        commandResultsOrdered: true,
        commandResultsGreen: true,
        postReplacementEvidenceCommandOk: true,
        releaseHandoffCommandOk: true,
        releaseHandoffSnapshotCommandOk: true,
        releaseHandoffStatusCommandOk: true,
        releaseHandoffAuditCommandOk: true,
        diffCheckEvidenceOk: true,
        postReplacementEvidenceBoundaryOk: true,
        releaseHandoffReviewBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when post-replacement evidence is not green", () => {
    const report = validate({}, {
      postReplacementEvidenceReport: greenPostReplacementEvidenceReport({
        ok: false,
        readyForReleaseHandoffReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "post_replacement_evidence_not_green",
      readyForLocalReleaseHandoffReview: false,
      findings: [
        expect.objectContaining({
          code: "invalid_post_replacement_evidence",
        }),
      ],
    });
  });

  it("requires ordered green command evidence", () => {
    const invalid = review();
    invalid.commandResults = [
      invalid.commandResults[1],
      invalid.commandResults[0],
      ...invalid.commandResults.slice(2),
    ];
    invalid.commandResults[2] = {
      ...invalid.commandResults[2],
      ok: false,
      exitCode: 1,
    };
    const report = validate(invalid);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_command_evidence_sequence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "command_not_green",
      }),
    );
  });

  it("requires command-specific release handoff metadata", () => {
    const invalid = review();
    invalid.commandResults[0] = {
      ...invalid.commandResults[0],
      postReplacementEvidence: undefined,
    };
    invalid.commandResults[1] = {
      ...invalid.commandResults[1],
      releaseClaim: "production_ready",
    };
    invalid.commandResults[3] = {
      ...invalid.commandResults[3],
      readyForLocalHandoffEvidence: false,
    };
    invalid.commandResults[4] = {
      ...invalid.commandResults[4],
      releaseHandoffEvidenceAudit: undefined,
    };
    const report = validate(invalid);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_post_replacement_command_evidence" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_release_handoff_evidence" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_release_handoff_status_evidence" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_release_handoff_audit_evidence" }),
    );
  });

  it("requires reviewer acceptance and rollback notes", () => {
    const report = validate({
      reviewSummary: {
        postReplacementEvidenceAccepted: true,
        releaseHandoffEvidenceAccepted: false,
        rollbackAvailable: true,
        rollbackNotes: [],
        nextBoundary: "",
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "review_summary_missing",
        field: "reviewSummary",
      }),
    );
  });

  it("rejects publication, production, and checker side effects", () => {
    const report = validate({
      releaseHandoffReviewBoundary: {
        reviewOnly: true,
        commandsExecutedByChecker: true,
        snapshotGeneratedByChecker: true,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: true,
        tagCreated: true,
        packageBuilt: true,
        uploadPerformed: true,
        productionReady: true,
        readinessClaimed: true,
      },
      approvalStatus: "published",
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "release_handoff_review_side_effect_performed",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_approval_status",
      }),
    );
  });
});
