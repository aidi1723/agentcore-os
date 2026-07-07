import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildReleaseExecutionApprovalCheckCliResult,
  parseReleaseExecutionApprovalCheckArgs,
} from "../../../scripts/release-execution/check-release-execution-approval.mjs";

const productionVerificationGatePath =
  "docs/release-execution-gates/example-production-verification-gate.json";

function writeApprovalFile(approval: Record<string, unknown> | string) {
  const cwd = mkdtempSync(
    join(tmpdir(), "agentcore-release-execution-approval-"),
  );
  const approvalPath = "approval.json";
  writeFileSync(
    join(cwd, approvalPath),
    typeof approval === "string" ? approval : JSON.stringify(approval),
    "utf8",
  );
  return { cwd, approvalPath };
}

function validApproval() {
  return {
    approvalId: "release-execution-approval-boundary-2026-07-07",
    productionVerificationGatePath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "release_execution_approval_boundary_reviewer",
    },
    recordedAt: "2026-07-07T20:00:00Z",
    expiresAt: "2026-07-14T20:00:00Z",
    targetVersion: "1.3.0",
    approvalScope: "release_execution_approval_boundary",
    productionVerificationGateResult: {
      ok: true,
      verificationOnly: true,
      productionVerificationClaim:
        "production_verification_requirements_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    executionReadinessReview: {
      packageBuildGateReviewed: true,
      tagCreationGateReviewed: true,
      artifactUploadGateReviewed: true,
      deploymentGateReviewed: true,
      externalWriteGateReviewed: true,
      productionVerificationGateReviewed: true,
      allExecutionStillBlocked: true,
    },
    operatorApprovalRequirements: {
      approverRole: "release_execution_operator",
      twoPersonReviewRequired: true,
      changeWindowDeclared: true,
      rollbackOwnerDeclared: true,
      monitoringOwnerDeclared: true,
      credentialUseRequiresSeparateApproval: true,
    },
    commandEvidence: [
      {
        command: `npm run release:production-verification:gate:check -- --gate ${productionVerificationGatePath}`,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:01Z",
        gate: "production_verification_gate_green",
      },
      {
        command: "npm run release:hygiene:check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:02Z",
        gate: "release_hygiene_green",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:03Z",
        testFiles: 115,
        tests: 593,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:04Z",
        gate: "core_workflows_green",
      },
      {
        command: "npm run lint",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:05Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "npm run build",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:06Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T20:00:07Z",
        gate: "git_diff_check_green",
      },
    ],
    releaseActionAuthorization: {
      packageBuild: actionAuthorization(),
      tagCreation: actionAuthorization(),
      artifactUpload: actionAuthorization(),
      deployment: actionAuthorization(),
      externalWrites: actionAuthorization(),
      productionVerification: actionAuthorization(),
    },
    credentialBoundary: {
      credentialsRequiredForBoundary: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    approvalBoundary: {
      approvalBoundaryOnly: true,
      commandsExecutedByChecker: false,
      releaseExecutionApproved: false,
      releaseExecutionPerformed: false,
      productionVerificationApproved: false,
      productionVerificationExecuted: false,
      publishingPerformed: false,
      tagCreated: false,
      packageBuilt: false,
      uploadPerformed: false,
      deploymentPerformed: false,
      connectorCallsPerformed: false,
      externalWritesPerformed: false,
      storeWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "release_execution_approval_boundary_review",
    notes: ["Release execution approval boundary only."],
  };
}

function actionAuthorization() {
  return {
    decision: "blocked_until_manual_operator_execution",
    approvalCapturedByBoundary: false,
    executionPerformed: false,
    credentialUseAllowed: false,
    owner: "agentcore-release-maintainers",
    notes: ["Approval boundary records requirements only."],
  };
}

function okProductionVerificationGateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForReleaseExecutionApprovalReview: true,
      productionVerificationClaim:
        "production_verification_requirements_defined",
      verificationOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("release execution approval boundary check script", () => {
  it("parses approval and compact flags", () => {
    expect(
      parseReleaseExecutionApprovalCheckArgs([
        "--approval",
        "docs/release-execution-approvals/example-release-execution-approval-boundary.json",
        "--compact",
      ]),
    ).toEqual({
      approvalPath:
        "docs/release-execution-approvals/example-release-execution-approval-boundary.json",
      pretty: false,
    });
  });

  it("requires an approval path", () => {
    expect(() => parseReleaseExecutionApprovalCheckArgs([])).toThrow(
      "--approval <path> is required",
    );
  });

  it("builds a green approval boundary result from a valid file", () => {
    const { cwd, approvalPath } = writeApprovalFile(validApproval());
    const result = buildReleaseExecutionApprovalCheckCliResult({
      cwd,
      approvalPath,
      pretty: false,
      buildProductionVerificationGateResult: okProductionVerificationGateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:execution-approval:check",
      releaseExecutionApprovalClaim:
        "release_execution_approval_boundary_defined",
      readyForManualReleaseExecutionDecisionReview: true,
      productionReady: false,
      publishingPerformed: false,
      approvalBoundaryOnly: true,
    });
  });

  it("fails when the reused production verification gate is not green", () => {
    const { cwd, approvalPath } = writeApprovalFile(validApproval());
    const result = buildReleaseExecutionApprovalCheckCliResult({
      cwd,
      approvalPath,
      pretty: false,
      buildProductionVerificationGateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          verificationOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_production_verification_gate" }),
    );
  });

  it("reports invalid JSON clearly", () => {
    const { cwd, approvalPath } = writeApprovalFile("{nope");

    expect(() =>
      buildReleaseExecutionApprovalCheckCliResult({
        cwd,
        approvalPath,
        buildProductionVerificationGateResult: okProductionVerificationGateResult,
      }),
    ).toThrow("release execution approval file is not valid JSON");
  });
});
