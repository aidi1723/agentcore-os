import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND,
  validatePlaybookLifecycleMutationHandoffSummary,
  type PlaybookLifecycleMutationHandoffSummary,
} from "@/lib/executor/playbooks/lifecycle-mutation-handoff-summary";

const releaseHandoffReviewPath =
  "docs/playbook-lifecycle-mutation-release-handoff-reviews/example-version-update-release-handoff-review.json";
const reviewCommand = `npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review ${releaseHandoffReviewPath}`;

function greenReleaseHandoffReviewReport(overrides = {}) {
  return {
    ok: true,
    productionReady: false,
    publishingPerformed: false,
    reviewOnly: true,
    readyForLocalReleaseHandoffReview: true,
    review: {
      reviewId: "release-handoff-review-sales-pipeline-v1",
      owner: "agentcore-runtime-maintainers",
    },
    findings: [],
    ...overrides,
  };
}

function summary(
  overrides: Partial<PlaybookLifecycleMutationHandoffSummary> = {},
): PlaybookLifecycleMutationHandoffSummary {
  return {
    summaryId: "handoff-summary-sales-pipeline-v1",
    releaseHandoffReviewPath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T10:45:00Z",
    handoffSummary: {
      targetPlaybookId: "sales-pipeline-v1",
      lifecycleMutationStatus: "local_mutation_reviewed",
      evidenceChainStatus: "release_handoff_review_green",
      localReleaseClaim: "local_release_handoff_ready",
      maintainerDecision: "ready_for_non_production_handoff_review",
      nextBoundary: "unified_policy_or_authoring_hardening",
    },
    commandSummary: [
      {
        command: reviewCommand,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:45:01Z",
        gate: "release_handoff_review_green",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:45:02Z",
        testFiles: 93,
        tests: 481,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:45:03Z",
        gate: "core_workflows_green",
      },
      {
        command: "npm run lint",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:45:04Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "npm run build",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:45:05Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:45:06Z",
        gate: "git_diff_check_green",
      },
    ],
    riskSummary: {
      productionReady: false,
      publishingApproved: false,
      externalWritesApproved: false,
      deferredItems: [
        "unified policy/guardrail hardening",
        "real replay depth",
        "authoring UI",
      ],
    },
    rollbackSummary: {
      rollbackAvailable: true,
      rollbackNotes: [
        "Revert the local mutation and regenerate review evidence if summary checks fail.",
      ],
    },
    releaseHandoffReviewResult: {
      ok: true,
      reviewOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    handoffSummaryBoundary: {
      summaryOnly: true,
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
    approvalStatus: "handoff_summary_review",
    notes: ["This summary is a local non-production handoff summary only."],
    ...overrides,
  };
}

function validate(overrides = {}, options = {}) {
  return validatePlaybookLifecycleMutationHandoffSummary(summary(overrides), {
    summaryPath:
      "docs/playbook-lifecycle-mutation-handoff-summaries/example-version-update-handoff-summary.json",
    releaseHandoffReviewReport: greenReleaseHandoffReviewReport(),
    ...options,
  });
}

describe("validatePlaybookLifecycleMutationHandoffSummary", () => {
  it("accepts a green handoff summary", () => {
    const report = validate();

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      summaryOnly: true,
      readyForMaintainerHandoffSummary: true,
      status: "handoff_summary_ready",
      summary: {
        findings: 0,
        requiredCommands: 6,
        commandSummary: 6,
      },
      checks: {
        releaseHandoffReviewOk: true,
        handoffSummaryComplete: true,
        commandSummaryOrdered: true,
        commandSummaryGreen: true,
        commandMetadataOk: true,
        riskSummaryOk: true,
        rollbackSummaryOk: true,
        releaseHandoffReviewBoundaryOk: true,
        handoffSummaryBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when release handoff review is not green", () => {
    const report = validate({}, {
      releaseHandoffReviewReport: greenReleaseHandoffReviewReport({
        ok: false,
        readyForLocalReleaseHandoffReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "release_handoff_review_not_green",
      readyForMaintainerHandoffSummary: false,
      findings: [
        expect.objectContaining({
          code: "invalid_release_handoff_review",
        }),
      ],
    });
  });

  it("requires ordered green command summaries", () => {
    const invalid = summary();
    invalid.commandSummary = [
      invalid.commandSummary[1],
      invalid.commandSummary[0],
      ...invalid.commandSummary.slice(2),
    ];
    invalid.commandSummary[2] = {
      ...invalid.commandSummary[2],
      ok: false,
      exitCode: 1,
    };
    const report = validate(invalid);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_command_summary_sequence" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "command_summary_not_green" }),
    );
  });

  it("requires command-specific metadata", () => {
    const invalid = summary();
    invalid.commandSummary[0] = {
      ...invalid.commandSummary[0],
      gate: undefined,
    };
    invalid.commandSummary[1] = {
      ...invalid.commandSummary[1],
      testFiles: 0,
      tests: 0,
    };
    invalid.commandSummary[5] = {
      ...invalid.commandSummary[5],
      gate: undefined,
    };
    const report = validate(invalid);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_command_summary_metadata" }),
    );
  });

  it("requires risk and rollback summaries", () => {
    const report = validate({
      riskSummary: {
        productionReady: false,
        publishingApproved: false,
        externalWritesApproved: false,
        deferredItems: [],
      },
      rollbackSummary: {
        rollbackAvailable: true,
        rollbackNotes: [],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "risk_summary_missing" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "rollback_summary_missing" }),
    );
  });

  it("rejects publishing and production side effects", () => {
    const report = validate({
      handoffSummaryBoundary: {
        summaryOnly: true,
        commandsExecutedByChecker: true,
        snapshotGeneratedByChecker: true,
        storeWritesPerformed: false,
        externalWritesPerformed: true,
        publishingPerformed: true,
        tagCreated: true,
        packageBuilt: true,
        uploadPerformed: true,
        productionReady: true,
        readinessClaimed: true,
      },
      approvalStatus: "production_ready",
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "handoff_summary_side_effect_performed" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_approval_status" }),
    );
  });
});
