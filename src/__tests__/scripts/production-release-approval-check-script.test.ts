import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildProductionReleaseApprovalCheckCliResult,
  parseProductionReleaseApprovalCheckArgs,
} from "../../../scripts/release-approval/check-production-release-approval.mjs";

const productionPolicyPath =
  "docs/release-policies/example-production-release-policy.json";

function writeApprovalFile(approval: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-release-approval-"));
  const approvalPath = "approval.json";
  writeFileSync(
    join(cwd, approvalPath),
    typeof approval === "string" ? approval : JSON.stringify(approval),
    "utf8",
  );
  return { cwd, approvalPath };
}

function actionDecision(overrides = {}) {
  return {
    decision: "blocked_until_execution_gate",
    approvalRequired: true,
    executionGateRequired: true,
    executed: false,
    owner: "agentcore-release-maintainers",
    notes: ["Approval packet records intent only."],
    ...overrides,
  };
}

function validApproval() {
  return {
    approvalId: "production-release-approval-2026-07-07",
    productionPolicyPath,
    reviewer: {
      id: "maintainer-aidi",
      name: "AgentCore Maintainer",
      role: "release_reviewer",
    },
    recordedAt: "2026-07-07T12:00:00Z",
    expiresAt: "2026-07-14T12:00:00Z",
    approvalScope: "production_release_approval_packet",
    productionReleasePolicyResult: {
      ok: true,
      policyOnly: true,
      policyClaim: "production_release_policy_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    commandEvidence: [
      {
        command: `npm run release:production-policy:check -- --policy ${productionPolicyPath}`,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T12:00:01Z",
        gate: "production_release_policy_green",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T12:00:02Z",
        testFiles: 101,
        tests: 523,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T12:00:03Z",
        gate: "core_workflows_green",
      },
      {
        command: "npm run lint",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T12:00:04Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "npm run build",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T12:00:05Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T12:00:06Z",
        gate: "git_diff_check_green",
      },
    ],
    releaseActionDecisions: {
      packaging: actionDecision(),
      tagCreation: actionDecision(),
      artifactUpload: actionDecision(),
      deployment: actionDecision(),
      externalWrites: actionDecision(),
    },
    rollbackOwner: {
      owner: "agentcore-release-maintainers",
      contact: "release-maintainers",
      rollbackPlanDocumented: true,
    },
    monitoringOwner: {
      owner: "agentcore-runtime-maintainers",
      contact: "runtime-maintainers",
      monitoringPlanDocumented: true,
    },
    riskAcceptance: {
      acceptedForExecutionPlanning: true,
      productionReady: false,
      publishingApproved: false,
      tagApproved: false,
      packageApproved: false,
      uploadApproved: false,
      deploymentApproved: false,
      externalWritesApproved: false,
      credentialUseApproved: false,
      deferredExecutionGates: ["package_build_execution_gate"],
    },
    approvalBoundary: {
      approvalPacketOnly: true,
      commandsExecutedByChecker: false,
      publishingPerformed: false,
      tagCreated: false,
      packageBuilt: false,
      uploadPerformed: false,
      deploymentPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "approved_for_release_execution_planning",
    notes: ["Approval packet only; release execution remains blocked."],
  };
}

function okProductionPolicyResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForProductionReleasePolicyReview: true,
      policyClaim: "production_release_policy_defined",
      policyOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("production release approval check script", () => {
  it("parses approval and compact flags", () => {
    expect(
      parseProductionReleaseApprovalCheckArgs([
        "--approval",
        "docs/release-approvals/example-production-release-approval.json",
        "--compact",
      ]),
    ).toEqual({
      approvalPath: "docs/release-approvals/example-production-release-approval.json",
      pretty: false,
    });
  });

  it("requires an approval path", () => {
    expect(() => parseProductionReleaseApprovalCheckArgs([])).toThrow(
      "--approval <path> is required",
    );
  });

  it("builds a green approval result from a valid approval file", () => {
    const { cwd, approvalPath } = writeApprovalFile(validApproval());
    const result = buildProductionReleaseApprovalCheckCliResult({
      cwd,
      approvalPath,
      pretty: false,
      buildProductionPolicyResult: okProductionPolicyResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:production-approval:check",
      approvalClaim: "production_release_approval_packet_defined",
      readyForReleaseExecutionPlanning: true,
      productionReady: false,
      publishingPerformed: false,
      approvalPacketOnly: true,
    });
  });

  it("fails when the reused production policy report is not green", () => {
    const { cwd, approvalPath } = writeApprovalFile(validApproval());
    const result = buildProductionReleaseApprovalCheckCliResult({
      cwd,
      approvalPath,
      pretty: false,
      buildProductionPolicyResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForProductionReleasePolicyReview: false,
          policyOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "production_release_policy_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("rejects invalid JSON", () => {
    const { cwd, approvalPath } = writeApprovalFile("{");

    expect(() =>
      buildProductionReleaseApprovalCheckCliResult({
        cwd,
        approvalPath,
        buildProductionPolicyResult: okProductionPolicyResult,
      }),
    ).toThrow("production release approval file is not valid JSON");
  });
});
