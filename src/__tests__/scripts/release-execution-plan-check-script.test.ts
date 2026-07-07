import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildReleaseExecutionPlanCheckCliResult,
  parseReleaseExecutionPlanCheckArgs,
} from "../../../scripts/release-execution/check-release-execution-plan.mjs";

const approvalPath =
  "docs/release-approvals/example-production-release-approval.json";
const policyPath = "docs/release-policies/example-production-release-policy.json";

function writePlanFile(plan: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-release-execution-plan-"));
  const planPath = "plan.json";
  writeFileSync(
    join(cwd, planPath),
    typeof plan === "string" ? plan : JSON.stringify(plan),
    "utf8",
  );
  return { cwd, planPath };
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

function validPlan() {
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
    commandEvidence: [
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
    ],
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
  };
}

function okApprovalResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForReleaseExecutionPlanning: true,
      approvalClaim: "production_release_approval_packet_defined",
      approvalPacketOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("release execution plan check script", () => {
  it("parses plan and compact flags", () => {
    expect(
      parseReleaseExecutionPlanCheckArgs([
        "--plan",
        "docs/release-execution-plans/example-release-execution-plan.json",
        "--compact",
      ]),
    ).toEqual({
      planPath: "docs/release-execution-plans/example-release-execution-plan.json",
      pretty: false,
    });
  });

  it("requires a plan path", () => {
    expect(() => parseReleaseExecutionPlanCheckArgs([])).toThrow(
      "--plan <path> is required",
    );
  });

  it("builds a green planning result from a valid plan file", () => {
    const { cwd, planPath } = writePlanFile(validPlan());
    const result = buildReleaseExecutionPlanCheckCliResult({
      cwd,
      planPath,
      pretty: false,
      buildProductionApprovalResult: okApprovalResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:execution-plan:check",
      executionPlanClaim: "release_execution_plan_defined",
      readyForReleaseExecutionGateDesign: true,
      productionReady: false,
      publishingPerformed: false,
      planningOnly: true,
    });
  });

  it("fails when the reused production approval report is not green", () => {
    const { cwd, planPath } = writePlanFile(validPlan());
    const result = buildReleaseExecutionPlanCheckCliResult({
      cwd,
      planPath,
      pretty: false,
      buildProductionApprovalResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForReleaseExecutionPlanning: false,
          approvalPacketOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "production_release_approval_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("rejects invalid JSON", () => {
    const { cwd, planPath } = writePlanFile("{");

    expect(() =>
      buildReleaseExecutionPlanCheckCliResult({
        cwd,
        planPath,
        buildProductionApprovalResult: okApprovalResult,
      }),
    ).toThrow("release execution plan file is not valid JSON");
  });
});
