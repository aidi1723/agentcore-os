import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND,
  validatePlaybookLifecycleMutationDryRun,
} from "@/lib/executor/playbooks/lifecycle-mutation-dry-run";

const approvalPath =
  "docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json";
const migrationPlanPath =
  "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";

function approvalReport(overrides = {}) {
  return {
    ok: true,
    command: "playbook:lifecycle:mutation:approval:check",
    approvedForLifecycleMutation: true,
    status: "approved_for_lifecycle_mutation",
    productionReady: false,
    publishingPerformed: false,
    approvalOnly: true,
    approvalPath,
    nextCommand: "npm run playbook:lifecycle:handoff",
    ...overrides,
  };
}

function migrationPlanReport(overrides = {}) {
  return {
    ok: true,
    command: "playbook:lifecycle:migration:plan:check",
    productionReady: false,
    publishingPerformed: false,
    planOnly: true,
    planPath: migrationPlanPath,
    proposalPath:
      "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json",
    plan: {
      planId: "example-sales-pipeline-v1-review-plan",
      migrationType: "version_update",
      fromPlaybookId: "sales-pipeline-v1",
      toPlaybookId: "sales-pipeline-v1",
      owner: "agentcore-runtime-maintainers",
    },
    summary: {
      expectedFixtureIds: 1,
    },
    fixtureReview: {
      expectedFixtureIds: ["sales-pipeline-governed"],
    },
    nextCommand: "npm run playbook:lifecycle:handoff",
    ...overrides,
  };
}

function dryRun(overrides = {}) {
  return {
    dryRunId: "dry-run-sales-pipeline-v1-review",
    approvalPath,
    migrationPlanPath,
    owner: "agentcore-runtime-maintainers",
    createdAt: "2026-07-07T03:20:00Z",
    mutationType: "registered_playbook_contract_update",
    targetPlaybookId: "sales-pipeline-v1",
    plannedTargets: [
      {
        kind: "registered_playbook_contract",
        path: "src/lib/executor/playbooks/sales-pipeline.ts",
        operation: "review_only",
      },
    ],
    fixtureImpact: {
      expectedFixtureIds: ["sales-pipeline-governed"],
      refreshRequired: false,
      notes: ["No fixture refresh is performed by the dry-run checker."],
    },
    executionBoundary: {
      dryRunOnly: true,
      mutationPerformed: false,
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      productionReady: false,
    },
    ...overrides,
  };
}

describe("validatePlaybookLifecycleMutationDryRun", () => {
  it("accepts a valid dry-run with green approval and migration plan", () => {
    const report = validatePlaybookLifecycleMutationDryRun(dryRun(), {
      dryRunPath:
        "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json",
      approvalReport: approvalReport(),
      migrationPlanReport: migrationPlanReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      dryRunOnly: true,
      readyForLifecycleMutationDryRun: true,
      status: "dry_run_ready",
      checks: {
        approvalOk: true,
        migrationPlanOk: true,
        targetPlaybookAligned: true,
        targetPathsScoped: true,
        fixtureImpactOk: true,
        executionBoundaryOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when approval is not green", () => {
    const report = validatePlaybookLifecycleMutationDryRun(dryRun(), {
      approvalReport: approvalReport({
        ok: false,
        approvedForLifecycleMutation: false,
        status: "readiness_not_green",
      }),
      migrationPlanReport: migrationPlanReport(),
    });

    expect(report).toMatchObject({
      ok: false,
      readyForLifecycleMutationDryRun: false,
      status: "approval_not_green",
      findings: [
        expect.objectContaining({
          code: "approval_not_green",
        }),
      ],
    });
  });

  it("fails closed when migration plan is not green", () => {
    const report = validatePlaybookLifecycleMutationDryRun(dryRun(), {
      approvalReport: approvalReport(),
      migrationPlanReport: migrationPlanReport({ ok: false }),
    });

    expect(report).toMatchObject({
      ok: false,
      readyForLifecycleMutationDryRun: false,
      status: "migration_plan_not_green",
      findings: [
        expect.objectContaining({
          code: "migration_plan_not_green",
        }),
      ],
    });
  });

  it("rejects target paths outside the registered playbook scope", () => {
    const report = validatePlaybookLifecycleMutationDryRun(
      dryRun({
        plannedTargets: [
          {
            kind: "registered_playbook_contract",
            path: "../outside.ts",
            operation: "review_only",
          },
        ],
      }),
      {
        approvalReport: approvalReport(),
        migrationPlanReport: migrationPlanReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "dry_run_not_valid",
      findings: [
        expect.objectContaining({
          code: "invalid_target_path",
          field: "plannedTargets",
        }),
      ],
    });
  });

  it("rejects dry-runs whose execution boundary says mutation happened", () => {
    const report = validatePlaybookLifecycleMutationDryRun(
      dryRun({
        executionBoundary: {
          dryRunOnly: true,
          mutationPerformed: true,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
        },
      }),
      {
        approvalReport: approvalReport(),
        migrationPlanReport: migrationPlanReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "dry_run_not_valid",
      findings: [
        expect.objectContaining({
          code: "execution_boundary_breached",
          field: "executionBoundary.mutationPerformed",
        }),
      ],
    });
  });
});
