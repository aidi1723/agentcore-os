import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND,
  buildPlaybookLifecycleMutationApprovalCliResult,
  parsePlaybookLifecycleMutationApprovalArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-approval.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";
const approvalPath =
  "docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json";

function readinessResult(ok = true) {
  const report = {
    ok,
    command: "playbook:lifecycle:maintenance:ready",
    evidencePath,
    readyForLifecycleMaintenance: ok,
    productionReady: false,
    publishingPerformed: false,
    readinessOnly: true,
    status: ok ? "ready_for_lifecycle_maintenance" : "evidence_not_ready",
    nextCommand: ok
      ? "npm run trace:fixtures --silent"
      : `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence ${evidencePath}`,
  };

  return {
    exitCode: ok ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function writeApprovalFixture(overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-mutation-approval-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-approvals"), {
    recursive: true,
  });
  writeFileSync(
    join(cwd, approvalPath),
    `${JSON.stringify(
      {
        approvalId: "approval-sales-pipeline-v1-review",
        evidencePath,
        approver: "agentcore-runtime-maintainers",
        approvedAt: "2026-07-07T03:10:00Z",
        decision: "approved",
        approvalScope: "playbook_lifecycle_mutation",
        readiness: {
          command:
            `npm run playbook:lifecycle:maintenance:ready -- --evidence ${evidencePath}`,
          status: "ready_for_lifecycle_maintenance",
          readyForLifecycleMaintenance: true,
          productionReady: false,
          publishingPerformed: false,
          readinessOnly: true,
        },
        mutationBoundary: {
          mutationApproved: true,
          executionPerformed: false,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          allowedTargets: ["registered_playbook_contract"],
        },
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, approvalPath };
}

describe("playbook lifecycle mutation approval script", () => {
  it("parses approval, compact, now, and current commit arguments", () => {
    expect(
      parsePlaybookLifecycleMutationApprovalArgs([
        "--approval",
        approvalPath,
        "--now",
        "2026-07-07T03:00:00Z",
        "--current-commit",
        fullCommit,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      approvalPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });
  });

  it("requires an approval path", () => {
    expect(() => parsePlaybookLifecycleMutationApprovalArgs([])).toThrow(
      "--approval <path> is required",
    );
  });

  it("builds a successful approval result for the tracked example receipt", () => {
    const result = buildPlaybookLifecycleMutationApprovalCliResult({
      approvalPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND,
      approvedForLifecycleMutation: true,
      status: "approved_for_lifecycle_mutation",
      productionReady: false,
      publishingPerformed: false,
      approvalOnly: true,
      checks: {
        currentReadinessGreen: true,
      },
      findings: [],
    });
  });

  it("fails closed when injected readiness is not green", () => {
    const { cwd, approvalPath } = writeApprovalFixture();
    const result = buildPlaybookLifecycleMutationApprovalCliResult({
      cwd,
      approvalPath,
      buildReadinessResult: () => readinessResult(false),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      approvedForLifecycleMutation: false,
      status: "readiness_not_green",
      findings: [
        expect.objectContaining({
          code: "current_readiness_not_green",
        }),
      ],
    });
  });

  it("fails closed when the approval receipt boundary is breached", () => {
    const { cwd, approvalPath } = writeApprovalFixture({
      mutationBoundary: {
        mutationApproved: true,
        executionPerformed: false,
        fixtureRefreshPerformed: true,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: false,
        allowedTargets: ["registered_playbook_contract"],
      },
    });
    const result = buildPlaybookLifecycleMutationApprovalCliResult({
      cwd,
      approvalPath,
      buildReadinessResult: () => readinessResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      approvedForLifecycleMutation: false,
      status: "mutation_boundary_breached",
      findings: [
        expect.objectContaining({
          code: "mutation_boundary_breached",
          field: "mutationBoundary.fixtureRefreshPerformed",
        }),
      ],
    });
  });
});
