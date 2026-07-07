import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_REPLACEMENT_EVIDENCE_COMMAND,
  validatePlaybookLifecycleMutationPostReplacementEvidence,
  type PlaybookLifecycleMutationPostReplacementEvidence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-replacement-evidence";

const replacementHandoffPath =
  "docs/playbook-lifecycle-mutation-fixture-replacement-handoffs/example-version-update-fixture-replacement-handoff.json";
const candidateFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const committedFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const handoffCommand = `npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff ${replacementHandoffPath}`;

function greenReplacementHandoffReport(overrides = {}) {
  return {
    ok: true,
    productionReady: false,
    publishingPerformed: false,
    handoffOnly: true,
    readyForManualCommittedFixtureReplacement: true,
    handoff: {
      catalogFixtureId: "sales-pipeline-governed",
      targetPlaybookId: "sales-pipeline-v1",
    },
    candidateFixturePath,
    committedFixturePath,
    findings: [],
    ...overrides,
  };
}

function evidence(
  overrides: Partial<PlaybookLifecycleMutationPostReplacementEvidence> = {},
): PlaybookLifecycleMutationPostReplacementEvidence {
  return {
    evidenceId: "post-replacement-evidence-sales-pipeline-v1",
    replacementHandoffPath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T10:10:00Z",
    replacementSummary: {
      committedFixtureReplacementPerformed: true,
      catalogFixtureId: "sales-pipeline-governed",
      targetPlaybookId: "sales-pipeline-v1",
      candidateFixturePath,
      committedFixturePath,
      replacementReviewedInGitDiff: true,
      rollbackAvailable: true,
      rollbackNotes: [
        "Revert the committed fixture JSON replacement if governed fixture validation fails.",
      ],
    },
    commandResults: [
      {
        command: handoffCommand,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:10:01Z",
        fixtureReplacementHandoff: "fixture_replacement_handoff_green",
        handoffOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: "npm run trace:fixtures --silent",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:10:02Z",
        fixtureGate: "governed_fixtures_green",
      },
      {
        command: "npm run trace:fixtures:summary --silent",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:10:03Z",
        fixtureSummaryGate: "governed_fixture_summary_green",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:10:04Z",
        testFiles: 89,
        tests: 457,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:10:05Z",
        coreWorkflowGate: "core_workflows_green",
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T10:10:06Z",
        diffCheck: "git_diff_check_green",
      },
    ],
    replacementHandoffResult: {
      ok: true,
      handoffOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    postReplacementBoundary: {
      evidenceOnly: true,
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      productionReady: false,
      readinessClaimed: false,
    },
    approvalStatus: "post_replacement_fixture_evidence",
    notes: ["This evidence validates recorded commands only."],
    ...overrides,
  };
}

function validate(overrides = {}, options = {}) {
  return validatePlaybookLifecycleMutationPostReplacementEvidence(
    evidence(overrides),
    {
      evidencePath:
        "docs/playbook-lifecycle-mutation-post-replacement-evidence/example-version-update-post-replacement-evidence.json",
      replacementHandoffReport: greenReplacementHandoffReport(),
      ...options,
    },
  );
}

describe("validatePlaybookLifecycleMutationPostReplacementEvidence", () => {
  it("accepts ordered green post-replacement evidence", () => {
    const report = validate();

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_POST_REPLACEMENT_EVIDENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      readyForReleaseHandoffReview: true,
      status: "post_replacement_fixture_evidence_ready",
      summary: {
        findings: 0,
        requiredCommands: 6,
        commandResults: 6,
      },
      checks: {
        replacementHandoffOk: true,
        replacementSummaryAligned: true,
        replacementReviewedAndRollbackReady: true,
        commandResultsOrdered: true,
        commandResultsGreen: true,
        handoffEvidenceOk: true,
        fixtureEvidenceOk: true,
        fixtureSummaryEvidenceOk: true,
        runtimeEvidenceOk: true,
        coreWorkflowEvidenceOk: true,
        diffCheckEvidenceOk: true,
        replacementHandoffBoundaryOk: true,
        postReplacementBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when replacement handoff is not green", () => {
    const report = validate({}, {
      replacementHandoffReport: greenReplacementHandoffReport({
        ok: false,
        readyForManualCommittedFixtureReplacement: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "fixture_replacement_handoff_not_green",
      readyForReleaseHandoffReview: false,
      findings: [
        expect.objectContaining({
          code: "invalid_fixture_replacement_handoff",
        }),
      ],
    });
  });

  it("requires replacement summary to match the handoff", () => {
    const report = validate({
      replacementSummary: {
        committedFixtureReplacementPerformed: true,
        catalogFixtureId: "support-resolution-governed",
        targetPlaybookId: "support-resolution-v1",
        candidateFixturePath,
        committedFixturePath,
        replacementReviewedInGitDiff: true,
        rollbackAvailable: true,
        rollbackNotes: ["Rollback scoped fixture replacement."],
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "replacement_summary_mismatch",
        field: "replacementSummary",
      }),
    );
  });

  it("requires ordered green command evidence", () => {
    const invalid = evidence();
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

  it("requires command-specific fixture, runtime, workflow, and diff metadata", () => {
    const invalid = evidence();
    invalid.commandResults[0] = {
      ...invalid.commandResults[0],
      fixtureReplacementHandoff: undefined,
    };
    invalid.commandResults[1] = {
      ...invalid.commandResults[1],
      fixtureGate: undefined,
    };
    invalid.commandResults[3] = {
      ...invalid.commandResults[3],
      testFiles: 0,
      tests: 0,
    };
    invalid.commandResults[5] = {
      ...invalid.commandResults[5],
      diffCheck: undefined,
    };
    const report = validate(invalid);

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_handoff_evidence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_fixture_evidence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_runtime_evidence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_diff_check_evidence",
      }),
    );
  });

  it("requires rollback readiness and blocks production side effects", () => {
    const report = validate({
      replacementSummary: {
        committedFixtureReplacementPerformed: true,
        catalogFixtureId: "sales-pipeline-governed",
        targetPlaybookId: "sales-pipeline-v1",
        candidateFixturePath,
        committedFixturePath,
        replacementReviewedInGitDiff: false,
        rollbackAvailable: false,
        rollbackNotes: [],
      },
      postReplacementBoundary: {
        evidenceOnly: true,
        fixtureRefreshPerformed: true,
        storeWritesPerformed: false,
        externalWritesPerformed: true,
        publishingPerformed: true,
        productionReady: true,
        readinessClaimed: true,
      },
      approvalStatus: "approved_for_release" as never,
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "replacement_review_or_rollback_missing",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "post_replacement_side_effect_performed",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        code: "invalid_approval_status",
      }),
    );
  });
});
