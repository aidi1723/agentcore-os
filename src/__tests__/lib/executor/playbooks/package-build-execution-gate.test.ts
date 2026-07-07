import { describe, expect, it } from "vitest";

import {
  PACKAGE_BUILD_GATE_CHECK_COMMAND,
  validatePackageBuildExecutionGate,
} from "@/lib/executor/playbooks/package-build-execution-gate";

const executionPlanPath =
  "docs/release-execution-plans/example-release-execution-plan.json";

function executionPlanReport(overrides = {}) {
  return {
    ok: true,
    readyForReleaseExecutionGateDesign: true,
    executionPlanClaim: "release_execution_plan_defined",
    planningOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:execution-plan:check -- --plan ${executionPlanPath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:01Z",
      gate: "release_execution_plan_green",
    },
    {
      command: "npm run release:hygiene:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:02Z",
      gate: "release_hygiene_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:03Z",
      testFiles: 105,
      tests: 543,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T14:00:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function packageBuildGate(overrides = {}) {
  return {
    gateId: "package-build-gate-2026-07-07",
    executionPlanPath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "package_build_gate_reviewer",
    },
    recordedAt: "2026-07-07T14:00:00Z",
    targetVersion: "1.3.0",
    releaseAction: "packaging",
    releaseExecutionPlanResult: {
      ok: true,
      planningOnly: true,
      executionPlanClaim: "release_execution_plan_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    packageBuildRequest: {
      packageCommand: "npm run desktop:package",
      packageTarget: "desktop",
      artifactType: "desktop_installer",
      outputPathPolicy: "blocked_until_operator_execution_approval",
      buildEnvironment: "local maintainer workstation",
    },
    sourceReview: {
      licenseReviewed: true,
      packageScriptsReviewed: true,
      lockfileReviewed: true,
      dependencyProvenanceReviewed: true,
      trackedArtifactBoundaryReviewed: true,
    },
    commandEvidence: commandEvidence(),
    rollbackPlan: {
      owner: "agentcore-release-maintainers",
      documented: true,
      rollbackCommandDeclared: true,
      executed: false,
    },
    monitoringPlan: {
      owner: "agentcore-runtime-maintainers",
      documented: true,
      smokeTestDeclared: true,
      executed: false,
    },
    artifactHandling: {
      artifactPathDeclared: true,
      artifactCreated: false,
      artifactUploaded: false,
      checksumCreated: false,
      retentionPolicyDocumented: true,
    },
    credentialBoundary: {
      credentialsRequiredForGate: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    packageBuildDecision: {
      decision: "blocked_until_operator_execution_approval",
      executionApproved: false,
      executionPerformed: false,
      executionGateRequired: true,
      credentialUseAllowed: false,
      productionReadinessClaimed: false,
    },
    packageBuildBoundary: {
      gateOnly: true,
      commandsExecutedByChecker: false,
      packageBuilt: false,
      artifactsCreated: false,
      publishingPerformed: false,
      tagCreated: false,
      uploadPerformed: false,
      deploymentPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "package_build_execution_gate_review",
    notes: ["Package build gate only; package build remains blocked."],
    ...overrides,
  };
}

describe("validatePackageBuildExecutionGate", () => {
  it("marks package build gate ready while keeping package build blocked", () => {
    const report = validatePackageBuildExecutionGate(packageBuildGate(), {
      gatePath: "docs/release-execution-gates/example-package-build-gate.json",
      executionPlanReport: executionPlanReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PACKAGE_BUILD_GATE_CHECK_COMMAND,
      status: "package_build_gate_ready",
      readyForPackageBuildOperatorReview: true,
      packageBuildGateClaim: "package_build_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
      checks: {
        releaseExecutionPlanOk: true,
        identityOk: true,
        packageBuildRequestOk: true,
        sourceReviewOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        rollbackPlanOk: true,
        monitoringPlanOk: true,
        artifactHandlingOk: true,
        credentialBoundaryOk: true,
        packageBuildDecisionOk: true,
        packageBuildBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start tag creation execution gate design",
    });
  });

  it("fails closed when the referenced execution plan is not green", () => {
    const report = validatePackageBuildExecutionGate(packageBuildGate(), {
      executionPlanReport: executionPlanReport({
        ok: false,
        readyForReleaseExecutionGateDesign: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "release_execution_plan_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_release_execution_plan",
        }),
      ],
    });
    expect(report).not.toHaveProperty("packageBuildGateClaim");
  });

  it("rejects missing package build request metadata", () => {
    const report = validatePackageBuildExecutionGate(
      packageBuildGate({
        packageBuildRequest: {
          packageCommand: "",
          packageTarget: "",
          artifactType: "",
        },
      }),
      {
        executionPlanReport: executionPlanReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package_build_request_missing",
        }),
      ]),
    );
  });

  it("rejects package build execution approval or credential allowance", () => {
    const report = validatePackageBuildExecutionGate(
      packageBuildGate({
        packageBuildDecision: {
          decision: "approved_for_execution",
          executionApproved: true,
          executionPerformed: false,
          executionGateRequired: true,
          credentialUseAllowed: true,
          productionReadinessClaimed: false,
        },
      }),
      {
        executionPlanReport: executionPlanReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "package_build_decision_over_authorized",
        }),
      ]),
    );
  });

  it("rejects package build boundary breaches", () => {
    const report = validatePackageBuildExecutionGate(
      packageBuildGate({
        packageBuildBoundary: {
          gateOnly: true,
          commandsExecutedByChecker: false,
          packageBuilt: true,
          artifactsCreated: true,
          publishingPerformed: false,
          tagCreated: false,
          uploadPerformed: false,
          deploymentPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          credentialsUsed: false,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      {
        executionPlanReport: executionPlanReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "package_build_boundary_breached" }),
      ]),
    );
  });
});
