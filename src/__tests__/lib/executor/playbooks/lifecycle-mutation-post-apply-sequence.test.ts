import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_SEQUENCE_COMMAND,
  validatePlaybookLifecycleMutationPostApplySequence,
  type PlaybookLifecycleMutationPostApplySequence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-sequence";

const applyReportPath =
  "docs/playbook-lifecycle-mutation-apply-reports/example-version-update-apply-report.json";
const manifestPath =
  "docs/playbook-lifecycle-mutation-manifests/example-version-update-manifest.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";

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
    checks: {
      preflightOk: true,
      dryRunPathAligned: true,
      executionBoundaryOk: true,
      targetScopeOk: true,
      targetsDeclaredByDryRun: true,
      currentHashesOk: true,
      nextContentHashesOk: true,
      applyConfirmationOk: true,
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

describe("validatePlaybookLifecycleMutationPostApplySequence", () => {
  it("accepts a complete post-apply audit sequence for a successful apply report", () => {
    const report = validatePlaybookLifecycleMutationPostApplySequence(sequence(), {
      sequencePath:
        "docs/playbook-lifecycle-mutation-post-apply-sequences/example-version-update-post-apply-sequence.json",
      applyReport: applyReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_SEQUENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      sequenceOnly: true,
      readyForPostApplyAuditSequence: true,
      status: "post_apply_audit_sequence_ready",
      summary: {
        findings: 0,
        requiredCommands: 7,
        orderedCommands: 7,
      },
      checks: {
        applyReportOk: true,
        commandSequenceValid: true,
        noFixtureRefreshBeforeAudit: true,
        publishingPolicyOk: true,
        productionPolicyOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when the referenced executor report is not an apply completion", () => {
    const report = validatePlaybookLifecycleMutationPostApplySequence(sequence(), {
      applyReport: applyReport({
        mode: "preview",
        status: "mutation_preview_ready",
        executionBoundary: {
          mutationPerformed: false,
        },
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "apply_report_not_green",
      readyForPostApplyAuditSequence: false,
      findings: [
        expect.objectContaining({
          code: "apply_report_not_green",
        }),
      ],
    });
  });

  it("fails closed when post-apply audit commands are missing or out of order", () => {
    const report = validatePlaybookLifecycleMutationPostApplySequence(
      sequence({
        orderedCommands: [
          "npm run test:controlled-runtime",
          "npm run playbook:control:audit",
        ],
      }),
      {
        applyReport: applyReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_command_sequence",
      severity: "error",
      field: "orderedCommands",
      command: "npm run playbook:control:audit",
      message:
        "Post-apply audit sequence post-apply-sequence-sales-pipeline-v1-review orderedCommands must include required commands in the exact post-apply order.",
    });
  });

  it("requires no fixture refresh, no publish, and no production-ready policies", () => {
    const report = validatePlaybookLifecycleMutationPostApplySequence(
      sequence({
        fixtureRefreshPolicy:
          "refresh_fixture_immediately" as PlaybookLifecycleMutationPostApplySequence["fixtureRefreshPolicy"],
        publishingPolicy:
          "publish_after_apply" as PlaybookLifecycleMutationPostApplySequence["publishingPolicy"],
        productionPolicy:
          "production_ready_after_apply" as PlaybookLifecycleMutationPostApplySequence["productionPolicy"],
      }),
      {
        applyReport: applyReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_fixture_refresh_policy",
      severity: "error",
      field: "fixtureRefreshPolicy",
      message:
        "Post-apply audit sequence post-apply-sequence-sales-pipeline-v1-review fixtureRefreshPolicy must be no_fixture_refresh_until_post_apply_audit_green.",
    });
    expect(report.findings).toContainEqual({
      code: "invalid_publishing_policy",
      severity: "error",
      field: "publishingPolicy",
      message:
        "Post-apply audit sequence post-apply-sequence-sales-pipeline-v1-review publishingPolicy must be no_publish_or_release.",
    });
    expect(report.findings).toContainEqual({
      code: "invalid_production_policy",
      severity: "error",
      field: "productionPolicy",
      message:
        "Post-apply audit sequence post-apply-sequence-sales-pipeline-v1-review productionPolicy must be no_production_ready_claim.",
    });
  });
});
