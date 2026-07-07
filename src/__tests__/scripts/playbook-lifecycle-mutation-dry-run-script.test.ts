import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND,
  buildPlaybookLifecycleMutationDryRunCliResult,
  parsePlaybookLifecycleMutationDryRunArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-dry-run.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const approvalPath =
  "docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json";
const migrationPlanPath =
  "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";

function approvalResult(ok = true) {
  const report = {
    ok,
    command: "playbook:lifecycle:mutation:approval:check",
    approvedForLifecycleMutation: ok,
    status: ok ? "approved_for_lifecycle_mutation" : "readiness_not_green",
    productionReady: false,
    publishingPerformed: false,
    approvalOnly: true,
    approvalPath,
    nextCommand: "npm run playbook:lifecycle:maintenance:ready -- --evidence docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json",
  };

  return {
    exitCode: ok ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function migrationPlanResult(ok = true) {
  const report = {
    ok,
    command: "playbook:lifecycle:migration:plan:check",
    productionReady: false,
    publishingPerformed: false,
    planOnly: true,
    planPath: migrationPlanPath,
    plan: {
      planId: "example-sales-pipeline-v1-review-plan",
      migrationType: "version_update",
      fromPlaybookId: "sales-pipeline-v1",
      toPlaybookId: "sales-pipeline-v1",
      owner: "agentcore-runtime-maintainers",
    },
    fixtureReview: {
      expectedFixtureIds: ["sales-pipeline-governed"],
    },
    nextCommand: "npm run playbook:lifecycle:handoff",
  };

  return {
    exitCode: ok ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function writeDryRunFixture(overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-mutation-dry-run-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-dry-runs"), {
    recursive: true,
  });
  writeFileSync(
    join(cwd, dryRunPath),
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, dryRunPath };
}

describe("playbook lifecycle mutation dry-run script", () => {
  it("parses dry-run, compact, now, and current commit arguments", () => {
    expect(
      parsePlaybookLifecycleMutationDryRunArgs([
        "--dry-run",
        dryRunPath,
        "--now",
        "2026-07-07T03:00:00Z",
        "--current-commit",
        fullCommit,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });
  });

  it("requires a dry-run path", () => {
    expect(() => parsePlaybookLifecycleMutationDryRunArgs([])).toThrow(
      "--dry-run <path> is required",
    );
  });

  it("builds a successful dry-run result for the tracked example", () => {
    const result = buildPlaybookLifecycleMutationDryRunCliResult({
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_DRY_RUN_COMMAND,
      readyForLifecycleMutationDryRun: true,
      status: "dry_run_ready",
      productionReady: false,
      publishingPerformed: false,
      dryRunOnly: true,
      checks: {
        approvalOk: true,
        migrationPlanOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when injected approval is not green", () => {
    const { cwd, dryRunPath } = writeDryRunFixture();
    const result = buildPlaybookLifecycleMutationDryRunCliResult({
      cwd,
      dryRunPath,
      buildApprovalResult: () => approvalResult(false),
      buildMigrationPlanResult: () => migrationPlanResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
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

  it("fails closed when the dry-run target path is not scoped", () => {
    const { cwd, dryRunPath } = writeDryRunFixture({
      plannedTargets: [
        {
          kind: "registered_playbook_contract",
          path: "/tmp/sales-pipeline.ts",
          operation: "review_only",
        },
      ],
    });
    const result = buildPlaybookLifecycleMutationDryRunCliResult({
      cwd,
      dryRunPath,
      buildApprovalResult: () => approvalResult(),
      buildMigrationPlanResult: () => migrationPlanResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "dry_run_not_valid",
      findings: [
        expect.objectContaining({
          code: "invalid_target_path",
        }),
      ],
    });
  });
});
