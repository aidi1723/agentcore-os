import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND,
  buildPlaybookLifecycleMutationPreflightCliResult,
  parsePlaybookLifecycleMutationPreflightArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-preflight.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";

function cliResult(report, exitCode = report.ok ? 0 : 1) {
  return {
    exitCode,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function closeoutResult(ok = true) {
  return cliResult({
    ok,
    command: "project:closeout:check",
    status: ok ? "current_milestone_closeout_ready" : "closeout_not_ready",
    readyForCurrentMilestoneCloseout: ok,
    productionReady: false,
    publishingPerformed: false,
    closeoutOnly: true,
    nextCommand: "npm run test:controlled-runtime",
  });
}

function dryRunResult(ok = true) {
  return cliResult({
    ok,
    command: "playbook:lifecycle:mutation:dry-run:check",
    status: ok ? "dry_run_ready" : "dry_run_not_valid",
    readyForLifecycleMutationDryRun: ok,
    productionReady: false,
    publishingPerformed: false,
    dryRunOnly: true,
    checks: {
      approvalOk: ok,
      migrationPlanOk: true,
      targetPathsScoped: true,
      fixtureImpactOk: true,
      executionBoundaryOk: true,
    },
    findings: [],
    nextCommand: "npm run playbook:lifecycle:handoff",
  });
}

function writeDryRunFixture(overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-mutation-preflight-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-dry-runs"), {
    recursive: true,
  });
  writeFileSync(
    join(cwd, dryRunPath),
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, dryRunPath };
}

describe("playbook lifecycle mutation preflight script", () => {
  it("parses evidence, dry-run, now, current commit, and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationPreflightArgs([
        "--evidence",
        evidencePath,
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
      evidencePath,
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });
  });

  it("requires evidence and dry-run paths", () => {
    expect(() => parsePlaybookLifecycleMutationPreflightArgs([])).toThrow(
      "--evidence <path> is required",
    );
    expect(() =>
      parsePlaybookLifecycleMutationPreflightArgs(["--evidence", evidencePath]),
    ).toThrow("--dry-run <path> is required");
  });

  it("builds a successful preflight result for the tracked example", () => {
    const result = buildPlaybookLifecycleMutationPreflightCliResult({
      evidencePath,
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_PREFLIGHT_COMMAND,
      readyForLifecycleMutationPreflight: true,
      status: "ready_for_mutation_executor_preflight",
      productionReady: false,
      publishingPerformed: false,
      preflightOnly: true,
    });
  });

  it("fails closed when injected closeout is not green", () => {
    const { cwd, dryRunPath } = writeDryRunFixture();
    const result = buildPlaybookLifecycleMutationPreflightCliResult({
      cwd,
      evidencePath,
      dryRunPath,
      buildCloseoutResult: () => closeoutResult(false),
      buildDryRunResult: () => dryRunResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "closeout_not_green",
      findings: [
        expect.objectContaining({
          code: "closeout_not_green",
        }),
      ],
    });
  });

  it("fails closed when the target is only review-only", () => {
    const { cwd, dryRunPath } = writeDryRunFixture({
      plannedTargets: [
        {
          kind: "registered_playbook_contract",
          path: "src/lib/executor/playbooks/sales-pipeline.ts",
          operation: "review_only",
        },
      ],
    });
    const result = buildPlaybookLifecycleMutationPreflightCliResult({
      cwd,
      evidencePath,
      dryRunPath,
      buildCloseoutResult: () => closeoutResult(),
      buildDryRunResult: () => dryRunResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "preflight_not_valid",
      findings: [
        expect.objectContaining({
          code: "missing_update_contract_target",
        }),
      ],
    });
  });
});
