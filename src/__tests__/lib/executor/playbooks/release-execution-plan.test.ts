import { describe, expect, it } from "vitest";

import {
  RELEASE_EXECUTION_PLAN_CHECK_COMMAND,
  validateReleaseExecutionPlan,
} from "@/lib/executor/playbooks/release-execution-plan";

const approvalPath =
  "docs/release-approvals/example-production-release-approval.json";
const policyPath = "docs/release-policies/example-production-release-policy.json";

function approvalReport(overrides = {}) {
  return {
    ok: true,
    readyForReleaseExecutionPlanning: true,
    approvalClaim: "production_release_approval_packet_defined",
    approvalPacketOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:production-approval:check -- --approval ${approvalPath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:01Z",
      gate: "production_release_approval_green",
    },
    {
      command: `npm run release:production-policy:check -- --policy ${policyPath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:02Z",
      gate: "production_release_policy_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:03Z",
      testFiles: 101,
      tests: 523,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T13:00:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function plannedAction(overrides = {}) {
  return {
    owner: "agentcore-release-maintainers",
    executionGate: "separate_action_execution_gate",
    executionCommand: "declared by a future execution gate",
    executionCommandDeclared: true,
    executionGateRequired: true,
    rollbackStepDocumented: true,
    monitoringStepDocumented: true,
    executed: false,
    approvedForExecution: false,
    credentialUseAllowed: false,
    productionReadinessClaimed: false,
    notes: ["Planning only; execution remains blocked."],
    ...overrides,
  };
}

function executionPlan(overrides = {}) {
  return {
    planId: "release-execution-plan-2026-07-07",
    approvalPath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "release_execution_planner",
    },
    recordedAt: "2026-07-07T13:00:00Z",
    targetVersion: "1.3.0",
    productionReleaseApprovalResult: {
      ok: true,
      approvalPacketOnly: true,
      approvalClaim: "production_release_approval_packet_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    plannedActions: {
      packaging: plannedAction({ executionGate: "package_build_execution_gate" }),
      tagCreation: plannedAction({ executionGate: "tag_creation_execution_gate" }),
      artifactUpload: plannedAction({
        executionGate: "artifact_upload_execution_gate",
      }),
      deployment: plannedAction({ executionGate: "deployment_execution_gate" }),
      externalWrites: plannedAction({
        executionGate: "external_write_execution_gate",
      }),
    },
    commandEvidence: commandEvidence(),
    preconditions: {
      approvalPacketGreen: true,
      productionPolicyGreen: true,
      controlledRuntimeGreen: true,
      coreWorkflowsGreen: true,
      localDiffClean: true,
    },
    rollbackPlan: {
      owner: "agentcore-release-maintainers",
      documented: true,
      rollbackCommandsDeclared: true,
      executed: false,
    },
    monitoringPlan: {
      owner: "agentcore-runtime-maintainers",
      documented: true,
      monitoringCommandsDeclared: true,
      executed: false,
    },
    credentialBoundary: {
      credentialsRequiredForPlanning: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    executionBoundary: {
      planningOnly: true,
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
    approvalStatus: "release_execution_planning",
    notes: ["Execution plan only; all release actions remain blocked."],
    ...overrides,
  };
}

describe("validateReleaseExecutionPlan", () => {
  it("marks execution planning ready while keeping release execution blocked", () => {
    const report = validateReleaseExecutionPlan(executionPlan(), {
      planPath: "docs/release-execution-plans/example-release-execution-plan.json",
      approvalReport: approvalReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: RELEASE_EXECUTION_PLAN_CHECK_COMMAND,
      status: "release_execution_plan_ready",
      readyForReleaseExecutionGateDesign: true,
      executionPlanClaim: "release_execution_plan_defined",
      productionReady: false,
      publishingPerformed: false,
      planningOnly: true,
      checks: {
        productionApprovalOk: true,
        identityOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        plannedActionsOk: true,
        releaseActionsBlocked: true,
        preconditionsOk: true,
        rollbackPlanOk: true,
        monitoringPlanOk: true,
        credentialBoundaryOk: true,
        executionBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start individual release execution gate design",
    });
  });

  it("fails closed when the referenced approval packet is not green", () => {
    const report = validateReleaseExecutionPlan(executionPlan(), {
      approvalReport: approvalReport({
        ok: false,
        readyForReleaseExecutionPlanning: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "production_release_approval_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_production_release_approval",
        }),
      ],
    });
    expect(report).not.toHaveProperty("executionPlanClaim");
  });

  it("rejects executed or approved release actions", () => {
    const report = validateReleaseExecutionPlan(
      executionPlan({
        plannedActions: {
          packaging: plannedAction({
            executed: true,
            approvedForExecution: true,
          }),
          tagCreation: plannedAction(),
          artifactUpload: plannedAction(),
          deployment: plannedAction(),
          externalWrites: plannedAction(),
        },
      }),
      {
        approvalReport: approvalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "release_action_planned_execution_breached",
        }),
      ]),
    );
  });

  it("rejects credential use and production readiness claims", () => {
    const report = validateReleaseExecutionPlan(
      executionPlan({
        plannedActions: {
          packaging: plannedAction({
            credentialUseAllowed: true,
            productionReadinessClaimed: true,
          }),
          tagCreation: plannedAction(),
          artifactUpload: plannedAction(),
          deployment: plannedAction(),
          externalWrites: plannedAction(),
        },
      }),
      {
        approvalReport: approvalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "release_action_credential_or_readiness_breached",
        }),
      ]),
    );
  });

  it("rejects execution boundary breaches", () => {
    const report = validateReleaseExecutionPlan(
      executionPlan({
        executionBoundary: {
          planningOnly: true,
          commandsExecutedByChecker: false,
          publishingPerformed: false,
          tagCreated: true,
          packageBuilt: false,
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
        approvalReport: approvalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "execution_boundary_breached" }),
      ]),
    );
  });
});
