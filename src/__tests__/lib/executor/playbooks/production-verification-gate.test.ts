import { describe, expect, it } from "vitest";

import {
  PRODUCTION_VERIFICATION_GATE_CHECK_COMMAND,
  validateProductionVerificationGate,
} from "@/lib/executor/playbooks/production-verification-gate";

const externalWriteGatePath =
  "docs/release-execution-gates/example-external-write-gate.json";

function externalWriteGateReport(overrides = {}) {
  return {
    ok: true,
    readyForExternalWriteOperatorReview: true,
    externalWriteGateClaim: "external_write_execution_gate_defined",
    gateOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:external-write:gate:check -- --gate ${externalWriteGatePath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:01Z",
      gate: "external_write_gate_green",
    },
    {
      command: "npm run release:hygiene:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:02Z",
      gate: "release_hygiene_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:03Z",
      testFiles: 115,
      tests: 593,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T19:00:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function productionVerificationGate(overrides = {}) {
  return {
    gateId: "production-verification-gate-2026-07-07",
    externalWriteGatePath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "production_verification_gate_reviewer",
    },
    recordedAt: "2026-07-07T19:00:00Z",
    targetVersion: "1.3.0",
    releaseAction: "production_verification",
    externalWriteGateResult: {
      ok: true,
      gateOnly: true,
      externalWriteGateClaim: "external_write_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    verificationPlan: {
      verificationEnvironment: "production_release_candidate",
      verificationWindow: "manual_post_execution_window",
      verificationCommandIntent:
        "run post-release smoke, artifact, deployment, and external-write checks for v1.3.0",
      acceptanceCriteria: "all declared post-action checks green",
      verificationPathPolicy: "blocked_until_operator_execution_approval",
    },
    postActionChecks: {
      deploymentHealthCheckDeclared: true,
      externalWriteVerificationDeclared: true,
      artifactAvailabilityVerificationDeclared: true,
      rollbackVerificationDeclared: true,
      checksExecutedByGate: false,
    },
    monitoringReadiness: {
      owner: "agentcore-runtime-maintainers",
      alertChannelDeclared: true,
      healthDashboardDeclared: true,
      incidentHandoffDeclared: true,
      executedByGate: false,
    },
    incidentRollbackReadiness: {
      incidentOwner: "agentcore-runtime-maintainers",
      rollbackOwner: "agentcore-release-maintainers",
      rollbackTriggerDeclared: true,
      escalationPathDeclared: true,
      rollbackExecutedByGate: false,
    },
    commandEvidence: commandEvidence(),
    credentialBoundary: {
      credentialsRequiredForGate: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    verificationDecision: {
      decision: "blocked_until_operator_execution_approval",
      verificationApproved: false,
      verificationExecuted: false,
      releaseExecutionApproved: false,
      releaseExecutionPerformed: false,
      externalWritesApproved: false,
      externalWritesPerformed: false,
      storeWritesApproved: false,
      storeWritesPerformed: false,
      executionApprovalGateRequired: true,
      credentialUseAllowed: false,
      productionReadinessClaimed: false,
    },
    verificationBoundary: {
      verificationOnly: true,
      commandsExecutedByChecker: false,
      productionVerificationExecuted: false,
      releaseExecutionPerformed: false,
      connectorCallsPerformed: false,
      externalWritesPerformed: false,
      storeWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "production_verification_gate_review",
    notes: ["Production verification gate only; execution remains blocked."],
    ...overrides,
  };
}

describe("validateProductionVerificationGate", () => {
  it("marks production verification requirements ready without claiming production readiness", () => {
    const report = validateProductionVerificationGate(
      productionVerificationGate(),
      {
        gatePath:
          "docs/release-execution-gates/example-production-verification-gate.json",
        externalWriteGateReport: externalWriteGateReport(),
      },
    );

    expect(report).toMatchObject({
      ok: true,
      command: PRODUCTION_VERIFICATION_GATE_CHECK_COMMAND,
      status: "production_verification_gate_ready",
      readyForReleaseExecutionApprovalReview: true,
      productionVerificationClaim:
        "production_verification_requirements_defined",
      productionReady: false,
      publishingPerformed: false,
      verificationOnly: true,
      checks: {
        externalWriteGateOk: true,
        identityOk: true,
        verificationPlanOk: true,
        postActionChecksOk: true,
        monitoringReadinessOk: true,
        incidentRollbackReadinessOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        credentialBoundaryOk: true,
        verificationDecisionOk: true,
        verificationBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start release execution approval boundary design",
    });
  });

  it("fails closed when the referenced external-write gate is not green", () => {
    const report = validateProductionVerificationGate(
      productionVerificationGate(),
      {
        externalWriteGateReport: externalWriteGateReport({
          ok: false,
          readyForExternalWriteOperatorReview: false,
        }),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "external_write_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
      readyForReleaseExecutionApprovalReview: false,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_external_write_gate" }),
    );
  });

  it("rejects verification plans that do not keep the path blocked", () => {
    const report = validateProductionVerificationGate(
      productionVerificationGate({
        verificationPlan: {
          verificationEnvironment: "production_release_candidate",
          verificationWindow: "manual_post_execution_window",
          verificationCommandIntent:
            "run post-release smoke, artifact, deployment, and external-write checks for v1.3.0",
          acceptanceCriteria: "all declared post-action checks green",
          verificationPathPolicy: "approved_for_execution",
        },
      }),
      { externalWriteGateReport: externalWriteGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "verification_plan_missing" }),
    );
  });

  it("rejects executed post-action checks and boundary breaches", () => {
    const report = validateProductionVerificationGate(
      productionVerificationGate({
        postActionChecks: {
          deploymentHealthCheckDeclared: true,
          externalWriteVerificationDeclared: true,
          artifactAvailabilityVerificationDeclared: true,
          rollbackVerificationDeclared: true,
          checksExecutedByGate: true,
        },
        verificationBoundary: {
          verificationOnly: true,
          commandsExecutedByChecker: false,
          productionVerificationExecuted: true,
          releaseExecutionPerformed: false,
          connectorCallsPerformed: false,
          externalWritesPerformed: false,
          storeWritesPerformed: false,
          credentialsUsed: false,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      { externalWriteGateReport: externalWriteGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "post_action_checks_missing" }),
        expect.objectContaining({ code: "verification_boundary_breached" }),
      ]),
    );
  });

  it("rejects over-authorized verification decisions and command evidence drift", () => {
    const report = validateProductionVerificationGate(
      productionVerificationGate({
        commandEvidence: commandEvidence({
          command: "npm run lint",
          ok: false,
          exitCode: 1,
        }),
        verificationDecision: {
          decision: "approved_for_execution",
          verificationApproved: true,
          verificationExecuted: false,
          releaseExecutionApproved: true,
          releaseExecutionPerformed: false,
          externalWritesApproved: true,
          externalWritesPerformed: false,
          storeWritesApproved: true,
          storeWritesPerformed: false,
          executionApprovalGateRequired: false,
          credentialUseAllowed: true,
          productionReadinessClaimed: true,
        },
      }),
      { externalWriteGateReport: externalWriteGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "command_evidence_not_green" }),
        expect.objectContaining({
          code: "verification_decision_over_authorized",
        }),
      ]),
    );
    expect(report).not.toHaveProperty("productionVerificationClaim");
  });
});
