import { describe, expect, it } from "vitest";

import {
  DEPLOYMENT_GATE_CHECK_COMMAND,
  validateDeploymentExecutionGate,
} from "@/lib/executor/playbooks/deployment-execution-gate";

const artifactUploadGatePath =
  "docs/release-execution-gates/example-artifact-upload-gate.json";

function artifactUploadGateReport(overrides = {}) {
  return {
    ok: true,
    readyForArtifactUploadOperatorReview: true,
    artifactUploadGateClaim: "artifact_upload_execution_gate_defined",
    gateOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:artifact-upload:gate:check -- --gate ${artifactUploadGatePath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:01Z",
      gate: "artifact_upload_gate_green",
    },
    {
      command: "npm run release:hygiene:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:02Z",
      gate: "release_hygiene_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:03Z",
      testFiles: 111,
      tests: 573,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T17:00:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function deploymentGate(overrides = {}) {
  return {
    gateId: "deployment-gate-2026-07-07",
    artifactUploadGatePath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "deployment_gate_reviewer",
    },
    recordedAt: "2026-07-07T17:00:00Z",
    targetVersion: "1.3.0",
    releaseAction: "deployment",
    artifactUploadGateResult: {
      ok: true,
      gateOnly: true,
      artifactUploadGateClaim: "artifact_upload_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    deploymentRequest: {
      environment: "production",
      deploymentTarget: "agentcore-os-desktop-release-channel",
      deploymentCommand:
        "npx wrangler deploy --env production --tag v1.3.0",
      deploymentArtifact: "agentcore-os-v1.3.0-desktop-installer.zip",
      deploymentStrategy: "manual_operator_triggered",
      deploymentPathPolicy: "blocked_until_operator_execution_approval",
    },
    deploymentEnvironmentReview: {
      environmentReviewed: true,
      targetReviewed: true,
      artifactReleaseLinkageReviewed: true,
      rollbackWindowReviewed: true,
      maintenanceWindowReviewed: true,
    },
    preDeploymentChecks: {
      healthCheckDeclared: true,
      configReviewDocumented: true,
      migrationImpactReviewed: true,
      smokePathDeclared: true,
      checksExecutedByGate: false,
    },
    commandEvidence: commandEvidence(),
    rollbackPlan: {
      owner: "agentcore-release-maintainers",
      documented: true,
      rollbackCommandDeclared: true,
      previousVersionIdentified: true,
      executed: false,
    },
    monitoringPlan: {
      owner: "agentcore-runtime-maintainers",
      documented: true,
      postDeployHealthCheckDeclared: true,
      alertReviewDeclared: true,
      executed: false,
    },
    credentialBoundary: {
      credentialsRequiredForGate: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    deploymentDecision: {
      decision: "blocked_until_operator_execution_approval",
      deploymentApproved: false,
      deploymentPerformed: false,
      externalWritesApproved: false,
      externalWritesPerformed: false,
      executionGateRequired: true,
      credentialUseAllowed: false,
      productionReadinessClaimed: false,
    },
    deploymentBoundary: {
      gateOnly: true,
      commandsExecutedByChecker: false,
      deploymentPerformed: false,
      externalWritesPerformed: false,
      storeWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "deployment_execution_gate_review",
    notes: ["Deployment gate only; deployment remains blocked."],
    ...overrides,
  };
}

describe("validateDeploymentExecutionGate", () => {
  it("marks deployment gate ready while keeping deployment blocked", () => {
    const report = validateDeploymentExecutionGate(deploymentGate(), {
      gatePath: "docs/release-execution-gates/example-deployment-gate.json",
      artifactUploadGateReport: artifactUploadGateReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: DEPLOYMENT_GATE_CHECK_COMMAND,
      status: "deployment_gate_ready",
      readyForDeploymentOperatorReview: true,
      deploymentGateClaim: "deployment_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
      checks: {
        artifactUploadGateOk: true,
        identityOk: true,
        deploymentRequestOk: true,
        deploymentEnvironmentReviewOk: true,
        preDeploymentChecksOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        rollbackPlanOk: true,
        monitoringPlanOk: true,
        credentialBoundaryOk: true,
        deploymentDecisionOk: true,
        deploymentBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start external write execution gate design",
    });
  });

  it("fails closed when the referenced artifact upload gate is not green", () => {
    const report = validateDeploymentExecutionGate(deploymentGate(), {
      artifactUploadGateReport: artifactUploadGateReport({
        ok: false,
        readyForArtifactUploadOperatorReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "artifact_upload_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
      readyForDeploymentOperatorReview: false,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_artifact_upload_gate" }),
    );
  });

  it("rejects deployment requests that do not keep the path blocked", () => {
    const report = validateDeploymentExecutionGate(
      deploymentGate({
        deploymentRequest: {
          environment: "production",
          deploymentTarget: "agentcore-os-desktop-release-channel",
          deploymentCommand:
            "npx wrangler deploy --env production --tag v1.3.0",
          deploymentArtifact: "agentcore-os-v1.3.0-desktop-installer.zip",
          deploymentStrategy: "manual_operator_triggered",
          deploymentPathPolicy: "approved_for_execution",
        },
      }),
      { artifactUploadGateReport: artifactUploadGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "deployment_request_missing" }),
    );
  });

  it("rejects executed pre-deployment checks and boundary breaches", () => {
    const report = validateDeploymentExecutionGate(
      deploymentGate({
        preDeploymentChecks: {
          healthCheckDeclared: true,
          configReviewDocumented: true,
          migrationImpactReviewed: true,
          smokePathDeclared: true,
          checksExecutedByGate: true,
        },
        deploymentBoundary: {
          gateOnly: true,
          commandsExecutedByChecker: false,
          deploymentPerformed: true,
          externalWritesPerformed: false,
          storeWritesPerformed: false,
          credentialsUsed: false,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      { artifactUploadGateReport: artifactUploadGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "pre_deployment_checks_missing" }),
        expect.objectContaining({ code: "deployment_boundary_breached" }),
      ]),
    );
  });

  it("rejects over-authorized deployment decisions and command evidence drift", () => {
    const report = validateDeploymentExecutionGate(
      deploymentGate({
        commandEvidence: commandEvidence({
          command: "npm run lint",
          ok: false,
          exitCode: 1,
        }),
        deploymentDecision: {
          decision: "approved_for_execution",
          deploymentApproved: true,
          deploymentPerformed: false,
          externalWritesApproved: true,
          externalWritesPerformed: false,
          executionGateRequired: true,
          credentialUseAllowed: true,
          productionReadinessClaimed: true,
        },
      }),
      { artifactUploadGateReport: artifactUploadGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "command_evidence_not_green" }),
        expect.objectContaining({
          code: "deployment_decision_over_authorized",
        }),
      ]),
    );
    expect(report).not.toHaveProperty("deploymentGateClaim");
  });
});
