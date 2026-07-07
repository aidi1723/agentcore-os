import { describe, expect, it } from "vitest";

import {
  EXTERNAL_WRITE_GATE_CHECK_COMMAND,
  validateExternalWriteExecutionGate,
} from "@/lib/executor/playbooks/external-write-execution-gate";

const deploymentGatePath =
  "docs/release-execution-gates/example-deployment-gate.json";

function deploymentGateReport(overrides = {}) {
  return {
    ok: true,
    readyForDeploymentOperatorReview: true,
    deploymentGateClaim: "deployment_execution_gate_defined",
    gateOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:deployment:gate:check -- --gate ${deploymentGatePath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:01Z",
      gate: "deployment_gate_green",
    },
    {
      command: "npm run release:hygiene:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:02Z",
      gate: "release_hygiene_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:03Z",
      testFiles: 113,
      tests: 583,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T18:00:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function externalWriteGate(overrides = {}) {
  return {
    gateId: "external-write-gate-2026-07-07",
    deploymentGatePath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "external_write_gate_reviewer",
    },
    recordedAt: "2026-07-07T18:00:00Z",
    targetVersion: "1.3.0",
    releaseAction: "external_write",
    deploymentGateResult: {
      ok: true,
      gateOnly: true,
      deploymentGateClaim: "deployment_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    externalWriteRequest: {
      targetSystem: "github_release_metadata",
      writeIntent: "publish_release_notes_and_artifact_links",
      writeCommand:
        "gh release edit v1.3.0 --notes-file docs/release-notes/v1.3.0.md",
      writePayload: "release_notes_and_artifact_links",
      writePathPolicy: "blocked_until_operator_execution_approval",
    },
    externalSystemReview: {
      targetSystemReviewed: true,
      writeScopeReviewed: true,
      payloadReviewed: true,
      idempotencyReviewed: true,
      rollbackTargetReviewed: true,
    },
    idempotencyPolicy: {
      idempotencyRequired: true,
      idempotencyKeyDeclared: true,
      duplicateWriteHandlingDeclared: true,
      retryPolicyDocumented: true,
      checksExecutedByGate: false,
    },
    commandEvidence: commandEvidence(),
    rollbackPlan: {
      owner: "agentcore-release-maintainers",
      documented: true,
      rollbackTargetDeclared: true,
      rollbackCommandDeclared: true,
      executed: false,
    },
    monitoringPlan: {
      owner: "agentcore-runtime-maintainers",
      documented: true,
      postWriteVerificationDeclared: true,
      alertReviewDeclared: true,
      executed: false,
    },
    credentialBoundary: {
      credentialsRequiredForGate: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    externalWriteDecision: {
      decision: "blocked_until_operator_execution_approval",
      externalWriteApproved: false,
      externalWritePerformed: false,
      connectorCallsApproved: false,
      connectorCallsPerformed: false,
      storeWritesApproved: false,
      storeWritesPerformed: false,
      executionGateRequired: true,
      credentialUseAllowed: false,
      productionReadinessClaimed: false,
    },
    externalWriteBoundary: {
      gateOnly: true,
      commandsExecutedByChecker: false,
      connectorCallsPerformed: false,
      externalWritesPerformed: false,
      storeWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "external_write_execution_gate_review",
    notes: ["External-write gate only; external writes remain blocked."],
    ...overrides,
  };
}

describe("validateExternalWriteExecutionGate", () => {
  it("marks external-write gate ready while keeping writes blocked", () => {
    const report = validateExternalWriteExecutionGate(externalWriteGate(), {
      gatePath: "docs/release-execution-gates/example-external-write-gate.json",
      deploymentGateReport: deploymentGateReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: EXTERNAL_WRITE_GATE_CHECK_COMMAND,
      status: "external_write_gate_ready",
      readyForExternalWriteOperatorReview: true,
      externalWriteGateClaim: "external_write_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
      checks: {
        deploymentGateOk: true,
        identityOk: true,
        externalWriteRequestOk: true,
        externalSystemReviewOk: true,
        idempotencyPolicyOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        rollbackPlanOk: true,
        monitoringPlanOk: true,
        credentialBoundaryOk: true,
        externalWriteDecisionOk: true,
        externalWriteBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start production verification gate design",
    });
  });

  it("fails closed when the referenced deployment gate is not green", () => {
    const report = validateExternalWriteExecutionGate(externalWriteGate(), {
      deploymentGateReport: deploymentGateReport({
        ok: false,
        readyForDeploymentOperatorReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "deployment_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
      readyForExternalWriteOperatorReview: false,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_deployment_gate" }),
    );
  });

  it("rejects external write requests that do not keep the path blocked", () => {
    const report = validateExternalWriteExecutionGate(
      externalWriteGate({
        externalWriteRequest: {
          targetSystem: "github_release_metadata",
          writeIntent: "publish_release_notes_and_artifact_links",
          writeCommand:
            "gh release edit v1.3.0 --notes-file docs/release-notes/v1.3.0.md",
          writePayload: "release_notes_and_artifact_links",
          writePathPolicy: "approved_for_execution",
        },
      }),
      { deploymentGateReport: deploymentGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "external_write_request_missing" }),
    );
  });

  it("rejects executed idempotency checks and boundary breaches", () => {
    const report = validateExternalWriteExecutionGate(
      externalWriteGate({
        idempotencyPolicy: {
          idempotencyRequired: true,
          idempotencyKeyDeclared: true,
          duplicateWriteHandlingDeclared: true,
          retryPolicyDocumented: true,
          checksExecutedByGate: true,
        },
        externalWriteBoundary: {
          gateOnly: true,
          commandsExecutedByChecker: false,
          connectorCallsPerformed: true,
          externalWritesPerformed: false,
          storeWritesPerformed: false,
          credentialsUsed: false,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      { deploymentGateReport: deploymentGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "idempotency_policy_missing" }),
        expect.objectContaining({ code: "external_write_boundary_breached" }),
      ]),
    );
  });

  it("rejects over-authorized write decisions and command evidence drift", () => {
    const report = validateExternalWriteExecutionGate(
      externalWriteGate({
        commandEvidence: commandEvidence({
          command: "npm run lint",
          ok: false,
          exitCode: 1,
        }),
        externalWriteDecision: {
          decision: "approved_for_execution",
          externalWriteApproved: true,
          externalWritePerformed: false,
          connectorCallsApproved: true,
          connectorCallsPerformed: false,
          storeWritesApproved: true,
          storeWritesPerformed: false,
          executionGateRequired: true,
          credentialUseAllowed: true,
          productionReadinessClaimed: true,
        },
      }),
      { deploymentGateReport: deploymentGateReport() },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "command_evidence_not_green" }),
        expect.objectContaining({
          code: "external_write_decision_over_authorized",
        }),
      ]),
    );
    expect(report).not.toHaveProperty("externalWriteGateClaim");
  });
});
