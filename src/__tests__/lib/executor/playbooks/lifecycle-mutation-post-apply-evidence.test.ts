import { describe, expect, it } from "vitest";

import {
  validatePlaybookLifecycleMutationPostApplySequence,
  type PlaybookLifecycleMutationPostApplySequence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-sequence";
import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND,
  validatePlaybookLifecycleMutationPostApplyEvidence,
  type PlaybookLifecycleMutationPostApplyEvidence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence";

const applyReportPath =
  "docs/playbook-lifecycle-mutation-apply-reports/example-version-update-apply-report.json";
const manifestPath =
  "docs/playbook-lifecycle-mutation-manifests/example-version-update-manifest.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const sequencePath =
  "docs/playbook-lifecycle-mutation-post-apply-sequences/example-version-update-post-apply-sequence.json";

const orderedCommands = [
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
    orderedCommands,
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

function sequenceReport(sequenceOverrides = {}, reportOverrides = {}) {
  return validatePlaybookLifecycleMutationPostApplySequence(
    sequence(sequenceOverrides),
    {
      sequencePath,
      applyReport: applyReport(reportOverrides),
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
        command: orderedCommands[0],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:01Z",
        controlAudit: "playbook_control_audit_green",
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: orderedCommands[1],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:02Z",
        handoffOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: orderedCommands[2],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:03Z",
        fixtureGate: "governed_fixtures_green",
      },
      {
        command: orderedCommands[3],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:04Z",
        fixtureSummaryGate: "governed_fixture_summary_green",
      },
      {
        command: orderedCommands[4],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:05Z",
        testFiles: 81,
        tests: 413,
      },
      {
        command: orderedCommands[5],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T03:30:06Z",
        coreWorkflowGate: "core_workflows_green",
      },
      {
        command: orderedCommands[6],
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

describe("validatePlaybookLifecycleMutationPostApplyEvidence", () => {
  it("accepts complete local evidence for a green post-apply sequence", () => {
    const report = validatePlaybookLifecycleMutationPostApplyEvidence(evidence(), {
      evidencePath:
        "docs/playbook-lifecycle-mutation-post-apply-evidence/example-version-update-post-apply-evidence.json",
      sequenceReport: sequenceReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      readyForFixtureRefreshHandoff: true,
      status: "post_apply_audit_evidence_ready",
      summary: {
        findings: 0,
        requiredCommands: 7,
        commandResults: 7,
      },
      checks: {
        sequenceOk: true,
        commandResultsOrdered: true,
        commandResultsGreen: true,
        controlAuditEvidenceOk: true,
        handoffBoundaryOk: true,
        fixtureEvidenceOk: true,
        fixtureSummaryEvidenceOk: true,
        runtimeEvidenceOk: true,
        coreWorkflowEvidenceOk: true,
        diffCheckEvidenceOk: true,
        postApplyAuditBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when the referenced post-apply sequence is not green", () => {
    const report = validatePlaybookLifecycleMutationPostApplyEvidence(evidence(), {
      sequenceReport: sequenceReport(
        {
          orderedCommands: ["npm run test:controlled-runtime"],
        },
        {},
      ),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "referenced_sequence_not_green",
      readyForFixtureRefreshHandoff: false,
      findings: [
        expect.objectContaining({
          code: "invalid_referenced_sequence",
        }),
      ],
    });
  });

  it("fails closed when command evidence is missing or out of order", () => {
    const report = validatePlaybookLifecycleMutationPostApplyEvidence(
      evidence({
        commandResults: [
          {
            command: "npm run test:controlled-runtime",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:05Z",
            testFiles: 81,
            tests: 413,
          },
        ],
      }),
      {
        sequenceReport: sequenceReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandResults",
      command: "npm run playbook:control:audit",
      message:
        "Post-apply audit evidence post-apply-evidence-sales-pipeline-v1-review commandResults must match the referenced post-apply sequence commands in order.",
    });
  });

  it("requires every recorded command result to be green", () => {
    const report = validatePlaybookLifecycleMutationPostApplyEvidence(
      evidence({
        commandResults: [
          {
            command: orderedCommands[0],
            ok: false,
            exitCode: 1,
            recordedAt: "2026-07-07T03:30:01Z",
          },
          ...evidence().commandResults.slice(1),
        ],
      }),
      {
        sequenceReport: sequenceReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "command_not_green",
      severity: "error",
      field: "commandResults",
      message:
        "Post-apply audit evidence post-apply-evidence-sales-pipeline-v1-review commandResults must all record ok true, exitCode 0, and recordedAt.",
    });
  });

  it("blocks fixture refresh, publishing, and production-ready claims", () => {
    const report = validatePlaybookLifecycleMutationPostApplyEvidence(
      evidence({
        postApplyAuditBoundary: {
          fixtureRefreshPerformed: true,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: true,
          productionReady: true,
          readinessClaimed: true,
        },
      }),
      {
        sequenceReport: sequenceReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "post_apply_side_effect_performed",
      severity: "error",
      field: "postApplyAuditBoundary",
      message:
        "Post-apply audit evidence post-apply-evidence-sales-pipeline-v1-review must record no fixture refresh, store writes, external writes, publishing, production readiness, or readiness claim.",
    });
  });
});
