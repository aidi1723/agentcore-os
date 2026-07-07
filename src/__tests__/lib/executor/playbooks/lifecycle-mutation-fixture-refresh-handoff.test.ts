import { describe, expect, it } from "vitest";

import {
  validatePlaybookLifecycleMutationFixtureRefreshHandoff,
  type PlaybookLifecycleMutationFixtureRefreshHandoff,
  PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REFRESH_HANDOFF_COMMAND,
} from "@/lib/executor/playbooks/lifecycle-mutation-fixture-refresh-handoff";
import {
  validatePlaybookLifecycleMutationPostApplyEvidence,
  type PlaybookLifecycleMutationPostApplyEvidence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence";
import {
  validatePlaybookLifecycleMutationPostApplySequence,
  type PlaybookLifecycleMutationPostApplySequence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-sequence";

const applyReportPath =
  "docs/playbook-lifecycle-mutation-apply-reports/example-version-update-apply-report.json";
const manifestPath =
  "docs/playbook-lifecycle-mutation-manifests/example-version-update-manifest.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const sequencePath =
  "docs/playbook-lifecycle-mutation-post-apply-sequences/example-version-update-post-apply-sequence.json";
const evidencePath =
  "docs/playbook-lifecycle-mutation-post-apply-evidence/example-version-update-post-apply-evidence.json";

const postApplyCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run trace:fixtures:summary --silent",
  "npm run test:controlled-runtime",
  "npm run test:core-workflows",
  "git diff --check",
];

function applyReport(overrides = {}) {
  return {
    ok: true,
    command: "playbook:lifecycle:mutation:executor",
    mode: "apply",
    status: "mutation_apply_complete",
    productionReady: false,
    publishingPerformed: false,
    mutationExecutorOnly: true,
    readyForLifecycleMutationExecutor: true,
    manifest: {
      manifestId: "mutation-manifest-sales-pipeline-v1-review",
      dryRunPath,
      targetPlaybookId: "sales-pipeline-v1",
    },
    dryRunPath,
    summary: {
      findings: 0,
      targets: 1,
      mutatedTargets: 1,
    },
    executionBoundary: {
      mutationExecutorOnly: true,
      previewOnly: false,
      applyConfirmationRequired: true,
      applyConfirmed: true,
      mutationPerformed: true,
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      productionReady: false,
    },
    findings: [],
    ...overrides,
  };
}

function sequence(
  overrides: Partial<PlaybookLifecycleMutationPostApplySequence> = {},
): PlaybookLifecycleMutationPostApplySequence {
  return {
    sequenceId: "post-apply-sequence-sales-pipeline-v1-review",
    owner: "agentcore-runtime-maintainers",
    applyReportPath,
    manifestPath,
    dryRunPath,
    targetPlaybookId: "sales-pipeline-v1",
    orderedCommands: postApplyCommands,
    applyExpectation: "mutation_apply_complete",
    controlAuditExpectation: "playbook_control_audit_green",
    handoffExpectation: "ready_for_lifecycle_handoff",
    fixtureExpectation: "governed_fixtures_green",
    fixtureSummaryExpectation: "governed_fixture_summary_green",
    runtimeTestExpectation: "controlled_runtime_green",
    coreWorkflowExpectation: "core_workflows_green",
    diffCheckExpectation: "git_diff_check_green",
    fixtureRefreshPolicy: "no_fixture_refresh_until_post_apply_audit_green",
    publishingPolicy: "no_publish_or_release",
    productionPolicy: "no_production_ready_claim",
    notes: ["This checker declares the post-apply audit order only."],
    ...overrides,
  };
}

function sequenceReport(sequenceOverrides = {}, applyOverrides = {}) {
  return validatePlaybookLifecycleMutationPostApplySequence(
    sequence(sequenceOverrides),
    {
      sequencePath,
      applyReport: applyReport(applyOverrides),
    },
  );
}

function evidence(
  overrides: Partial<PlaybookLifecycleMutationPostApplyEvidence> = {},
): PlaybookLifecycleMutationPostApplyEvidence {
  return {
    evidenceId: "post-apply-evidence-sales-pipeline-v1-review",
    sequencePath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T03:30:00Z",
    commandResults: [
      {
        command: postApplyCommands[0],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:01Z",
        controlAudit: "playbook_control_audit_green",
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: postApplyCommands[1],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:02Z",
        handoffOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: postApplyCommands[2],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:03Z",
        fixtureGate: "governed_fixtures_green",
      },
      {
        command: postApplyCommands[3],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:04Z",
        fixtureSummaryGate: "governed_fixture_summary_green",
      },
      {
        command: postApplyCommands[4],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:05Z",
        testFiles: 83,
        tests: 423,
      },
      {
        command: postApplyCommands[5],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:06Z",
        coreWorkflowGate: "core_workflows_green",
      },
      {
        command: postApplyCommands[6],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:07Z",
        diffCheck: "git_diff_check_green",
      },
    ],
    sequenceResult: {
      ok: true,
      sequenceOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    postApplyAuditBoundary: {
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      productionReady: false,
      readinessClaimed: false,
    },
    approvalStatus: "post_apply_audit_evidence",
    ...overrides,
  };
}

function evidenceReport(evidenceOverrides = {}, sequenceOverrides = {}) {
  const seqReport = sequenceReport(sequenceOverrides);
  return {
    seqReport,
    report: validatePlaybookLifecycleMutationPostApplyEvidence(
      evidence(evidenceOverrides),
      {
        evidencePath,
        sequenceReport: seqReport,
      },
    ),
  };
}

function handoff(
  overrides: Partial<PlaybookLifecycleMutationFixtureRefreshHandoff> = {},
): PlaybookLifecycleMutationFixtureRefreshHandoff {
  return {
    handoffId: "fixture-refresh-handoff-sales-pipeline-v1-review",
    owner: "agentcore-runtime-maintainers",
    postApplyEvidencePath: evidencePath,
    targetPlaybookId: "sales-pipeline-v1",
    intendedFixtureIds: ["sales-pipeline-governed"],
    refreshReason:
      "Post-apply audit evidence is green; start manual fixture refresh review.",
    reviewChecklist: {
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
        "Reject the candidate fixture if catalog replay, redaction, or diff review fails.",
      ],
    },
    handoffBoundary: {
      handoffOnly: true,
      candidateFixtureGenerated: false,
      committedFixtureReplaced: false,
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      productionReady: false,
    },
    fixtureRefreshPolicy: "manual_fixture_refresh_review_required",
    publishingPolicy: "no_publish_or_release",
    productionPolicy: "no_production_ready_claim",
    approvalStatus: "fixture_refresh_handoff_only",
    notes: ["This gate does not build or replace fixture JSON."],
    ...overrides,
  };
}

describe("validatePlaybookLifecycleMutationFixtureRefreshHandoff", () => {
  it("accepts a handoff with green post-apply evidence and manual review gates", () => {
    const { report, seqReport } = evidenceReport();
    const handoffReport = validatePlaybookLifecycleMutationFixtureRefreshHandoff(
      handoff(),
      {
        handoffPath:
          "docs/playbook-lifecycle-mutation-fixture-refresh-handoffs/example-version-update-fixture-refresh-handoff.json",
        postApplyEvidenceReport: report,
        postApplySequenceReport: seqReport,
      },
    );

    expect(handoffReport).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REFRESH_HANDOFF_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      handoffOnly: true,
      readyForFixtureRefreshReview: true,
      status: "fixture_refresh_handoff_ready",
      summary: {
        findings: 0,
        intendedFixtureIds: 1,
      },
      checks: {
        postApplyEvidenceOk: true,
        targetPlaybookAligned: true,
        intendedFixturesDeclared: true,
        reviewChecklistComplete: true,
        handoffBoundaryOk: true,
        policiesOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when post-apply evidence is not green", () => {
    const { report, seqReport } = evidenceReport({
      postApplyAuditBoundary: {
        fixtureRefreshPerformed: true,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: false,
        productionReady: false,
        readinessClaimed: false,
      },
    });
    const handoffReport = validatePlaybookLifecycleMutationFixtureRefreshHandoff(
      handoff(),
      {
        postApplyEvidenceReport: report,
        postApplySequenceReport: seqReport,
      },
    );

    expect(handoffReport).toMatchObject({
      ok: false,
      status: "post_apply_evidence_not_green",
      readyForFixtureRefreshReview: false,
      findings: [
        expect.objectContaining({
          code: "invalid_post_apply_evidence",
        }),
      ],
    });
  });

  it("requires target playbook to match the post-apply sequence", () => {
    const { report, seqReport } = evidenceReport();
    const handoffReport = validatePlaybookLifecycleMutationFixtureRefreshHandoff(
      handoff({
        targetPlaybookId: "support-resolution-v1",
      }),
      {
        postApplyEvidenceReport: report,
        postApplySequenceReport: seqReport,
      },
    );

    expect(handoffReport.ok).toBe(false);
    expect(handoffReport.findings).toContainEqual({
      code: "target_playbook_mismatch",
      severity: "error",
      field: "targetPlaybookId",
      message:
        "Fixture refresh handoff fixture-refresh-handoff-sales-pipeline-v1-review targetPlaybookId must match the referenced post-apply sequence target.",
    });
  });

  it("requires intended fixture ids and a complete manual review checklist", () => {
    const { report, seqReport } = evidenceReport();
    const handoffReport = validatePlaybookLifecycleMutationFixtureRefreshHandoff(
      handoff({
        intendedFixtureIds: [],
        reviewChecklist: {
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
      }),
      {
        postApplyEvidenceReport: report,
        postApplySequenceReport: seqReport,
      },
    );

    expect(handoffReport.ok).toBe(false);
    expect(handoffReport.findings).toContainEqual({
      code: "missing_fixture_targets",
      severity: "error",
      field: "intendedFixtureIds",
      message:
        "Fixture refresh handoff fixture-refresh-handoff-sales-pipeline-v1-review must declare at least one intended governed fixture id.",
    });
    expect(handoffReport.findings).toContainEqual({
      code: "incomplete_review_checklist",
      severity: "error",
      field: "reviewChecklist",
      message:
        "Fixture refresh handoff fixture-refresh-handoff-sales-pipeline-v1-review must declare every manual fixture refresh review gate and rollback notes.",
    });
  });

  it("blocks candidate generation, committed fixture replacement, publishing, and production-ready claims", () => {
    const { report, seqReport } = evidenceReport();
    const handoffReport = validatePlaybookLifecycleMutationFixtureRefreshHandoff(
      handoff({
        handoffBoundary: {
          handoffOnly: true,
          candidateFixtureGenerated: true,
          committedFixtureReplaced: true,
          fixtureRefreshPerformed: true,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: true,
          productionReady: true,
        },
      }),
      {
        postApplyEvidenceReport: report,
        postApplySequenceReport: seqReport,
      },
    );

    expect(handoffReport.ok).toBe(false);
    expect(handoffReport.findings).toContainEqual({
      code: "fixture_refresh_side_effect_performed",
      severity: "error",
      field: "handoffBoundary",
      message:
        "Fixture refresh handoff fixture-refresh-handoff-sales-pipeline-v1-review must remain handoff-only with no candidate generation, committed fixture replacement, fixture refresh, store writes, external writes, publishing, or production readiness.",
    });
  });
});
