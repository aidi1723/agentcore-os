import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND,
  validatePlaybookLifecycleMutationPreflight,
} from "@/lib/executor/playbooks/lifecycle-mutation-preflight";

const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";

function closeoutReport(overrides = {}) {
  return {
    ok: true,
    command: "project:closeout:check",
    status: "current_milestone_closeout_ready",
    readyForCurrentMilestoneCloseout: true,
    productionReady: false,
    publishingPerformed: false,
    closeoutOnly: true,
    nextCommand: "npm run test:controlled-runtime",
    ...overrides,
  };
}

function dryRunReport(overrides = {}) {
  return {
    ok: true,
    command: "playbook:lifecycle:mutation:dry-run:check",
    status: "dry_run_ready",
    readyForLifecycleMutationDryRun: true,
    productionReady: false,
    publishingPerformed: false,
    dryRunOnly: true,
    checks: {
      approvalOk: true,
      migrationPlanOk: true,
      targetPathsScoped: true,
      fixtureImpactOk: true,
      executionBoundaryOk: true,
    },
    findings: [],
    nextCommand: "npm run playbook:lifecycle:handoff",
    ...overrides,
  };
}

function dryRun(overrides = {}) {
  return {
    dryRunId: "dry-run-sales-pipeline-v1-review",
    approvalPath:
      "docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json",
    migrationPlanPath:
      "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json",
    targetPlaybookId: "sales-pipeline-v1",
    plannedTargets: [
      {
        kind: "registered_playbook_contract",
        path: "src/lib/executor/playbooks/sales-pipeline.ts",
        operation: "update_contract",
      },
    ],
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

describe("validatePlaybookLifecycleMutationPreflight", () => {
  it("accepts a green closeout and dry-run with scoped update targets", () => {
    const report = validatePlaybookLifecycleMutationPreflight(dryRun(), {
      dryRunPath,
      evidencePath,
      closeoutReport: closeoutReport(),
      dryRunReport: dryRunReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND,
      status: "ready_for_mutation_executor_preflight",
      readyForLifecycleMutationPreflight: true,
      productionReady: false,
      publishingPerformed: false,
      preflightOnly: true,
      checks: {
        closeoutOk: true,
        dryRunOk: true,
        approvalOk: true,
        updateContractTargetPresent: true,
        targetScopeOk: true,
        executionBoundaryOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when project closeout is not green", () => {
    const report = validatePlaybookLifecycleMutationPreflight(dryRun(), {
      dryRunPath,
      evidencePath,
      closeoutReport: closeoutReport({
        ok: false,
        status: "closeout_not_ready",
        nextCommand: "npm run project:closeout:check -- --evidence <path> --dry-run <path>",
      }),
      dryRunReport: dryRunReport(),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "closeout_not_green",
      readyForLifecycleMutationPreflight: false,
      findings: [
        expect.objectContaining({
          code: "closeout_not_green",
        }),
      ],
    });
  });

  it("rejects review-only dry-run targets before mutation executor work", () => {
    const report = validatePlaybookLifecycleMutationPreflight(
      dryRun({
        plannedTargets: [
          {
            kind: "registered_playbook_contract",
            path: "src/lib/executor/playbooks/sales-pipeline.ts",
            operation: "review_only",
          },
        ],
      }),
      {
        dryRunPath,
        evidencePath,
        closeoutReport: closeoutReport(),
        dryRunReport: dryRunReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "preflight_not_valid",
      findings: [
        expect.objectContaining({
          code: "missing_update_contract_target",
          field: "plannedTargets",
        }),
      ],
    });
  });

  it("rejects dry-run execution boundaries that already performed mutation", () => {
    const report = validatePlaybookLifecycleMutationPreflight(
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
        dryRunPath,
        evidencePath,
        closeoutReport: closeoutReport(),
        dryRunReport: dryRunReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "preflight_not_valid",
      findings: [
        expect.objectContaining({
          code: "execution_boundary_breached",
          field: "executionBoundary.mutationPerformed",
        }),
      ],
    });
  });
});
