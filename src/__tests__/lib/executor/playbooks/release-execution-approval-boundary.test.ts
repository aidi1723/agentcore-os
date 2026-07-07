import { describe, expect, it } from "vitest";

import {
  RELEASE_EXECUTION_APPROVAL_CHECK_COMMAND,
  validateReleaseExecutionApprovalBoundary,
} from "@/lib/executor/playbooks/release-execution-approval-boundary";

const productionVerificationGatePath =
  "docs/release-execution-gates/example-production-verification-gate.json";

function productionVerificationGateReport(overrides = {}) {
  return {
    ok: true,
    readyForReleaseExecutionApprovalReview: true,
    productionVerificationClaim:
      "production_verification_requirements_defined",
    verificationOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
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
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function actionAuthorization(overrides = {}) {
  return {
    decision: "blocked_until_manual_operator_execution",
    approvalCapturedByBoundary: false,
    executionPerformed: false,
    credentialUseAllowed: false,
    owner: "agentcore-release-maintainers",
    notes: ["Approval boundary records requirements only; execution remains blocked."],
    ...overrides,
  };
}

function releaseExecutionApprovalBoundary(overrides = {}) {
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
    commandEvidence: commandEvidence(),
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
    notes: ["Release execution approval boundary only; execution remains blocked."],
    ...overrides,
  };
}

describe("validateReleaseExecutionApprovalBoundary", () => {
  it("marks release execution approval requirements ready without approving execution", () => {
    const report = validateReleaseExecutionApprovalBoundary(
      releaseExecutionApprovalBoundary(),
      {
        approvalPath:
          "docs/release-execution-approvals/example-release-execution-approval-boundary.json",
        productionVerificationGateReport: productionVerificationGateReport(),
      },
    );

    expect(report).toMatchObject({
      ok: true,
      command: RELEASE_EXECUTION_APPROVAL_CHECK_COMMAND,
      status: "release_execution_approval_boundary_ready",
      readyForManualReleaseExecutionDecisionReview: true,
      releaseExecutionApprovalClaim:
        "release_execution_approval_boundary_defined",
      productionReady: false,
      publishingPerformed: false,
      approvalBoundaryOnly: true,
      checks: {
        productionVerificationGateOk: true,
        identityOk: true,
        expiryOk: true,
        executionReadinessReviewOk: true,
        operatorApprovalRequirementsOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        releaseActionAuthorizationOk: true,
        releaseActionsBlocked: true,
        credentialBoundaryOk: true,
        approvalBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "manual release execution decision remains outside this checker",
    });
  });

  it("fails closed when the referenced production verification gate is not green", () => {
    const report = validateReleaseExecutionApprovalBoundary(
      releaseExecutionApprovalBoundary(),
      {
        productionVerificationGateReport: productionVerificationGateReport({
          ok: false,
          readyForReleaseExecutionApprovalReview: false,
        }),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "production_verification_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
      readyForManualReleaseExecutionDecisionReview: false,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_production_verification_gate" }),
    );
  });

  it("rejects missing owner identity and expired approvals", () => {
    const report = validateReleaseExecutionApprovalBoundary(
      releaseExecutionApprovalBoundary({
        owner: { id: "", name: "", role: "" },
        expiresAt: "2026-07-01T20:00:00Z",
      }),
      {
        productionVerificationGateReport: productionVerificationGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_owner_identity" }),
        expect.objectContaining({ code: "invalid_approval_expiry" }),
      ]),
    );
  });

  it("rejects release action authorization that approves or records execution", () => {
    const report = validateReleaseExecutionApprovalBoundary(
      releaseExecutionApprovalBoundary({
        releaseActionAuthorization: {
          packageBuild: actionAuthorization({
            decision: "approved_for_immediate_execution",
            approvalCapturedByBoundary: true,
            executionPerformed: true,
          }),
          tagCreation: actionAuthorization(),
          artifactUpload: actionAuthorization(),
          deployment: actionAuthorization(),
          externalWrites: actionAuthorization(),
          productionVerification: actionAuthorization(),
        },
      }),
      {
        productionVerificationGateReport: productionVerificationGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "release_action_authorization_over_authorized",
        }),
      ]),
    );
  });

  it("rejects command evidence drift and approval boundary breaches", () => {
    const driftedEvidence = commandEvidence({
      command: "npm run lint",
      ok: false,
      exitCode: 1,
      warningCount: undefined,
    }).reverse();

    const report = validateReleaseExecutionApprovalBoundary(
      releaseExecutionApprovalBoundary({
        commandEvidence: driftedEvidence,
        approvalBoundary: {
          approvalBoundaryOnly: true,
          commandsExecutedByChecker: false,
          releaseExecutionApproved: true,
          releaseExecutionPerformed: true,
          productionVerificationApproved: true,
          productionVerificationExecuted: true,
          publishingPerformed: true,
          tagCreated: true,
          packageBuilt: true,
          uploadPerformed: true,
          deploymentPerformed: true,
          connectorCallsPerformed: true,
          externalWritesPerformed: true,
          storeWritesPerformed: true,
          credentialsUsed: true,
          productionReady: true,
          productionReadinessClaimed: true,
        },
      }),
      {
        productionVerificationGateReport: productionVerificationGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_command_evidence_sequence",
        }),
        expect.objectContaining({ code: "command_evidence_not_green" }),
        expect.objectContaining({ code: "approval_boundary_breached" }),
      ]),
    );
  });
});
