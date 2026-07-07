import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPackageBuildGateCheckCliResult,
  parsePackageBuildGateCheckArgs,
} from "../../../scripts/release-execution/check-package-build-gate.mjs";

const executionPlanPath =
  "docs/release-execution-plans/example-release-execution-plan.json";

function writeGateFile(gate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-package-build-gate-"));
  const gatePath = "gate.json";
  writeFileSync(
    join(cwd, gatePath),
    typeof gate === "string" ? gate : JSON.stringify(gate),
    "utf8",
  );
  return { cwd, gatePath };
}

function validGate() {
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
    commandEvidence: [
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
    ],
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
  };
}

function okExecutionPlanResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForReleaseExecutionGateDesign: true,
      executionPlanClaim: "release_execution_plan_defined",
      planningOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("package build gate check script", () => {
  it("parses gate and compact flags", () => {
    expect(
      parsePackageBuildGateCheckArgs([
        "--gate",
        "docs/release-execution-gates/example-package-build-gate.json",
        "--compact",
      ]),
    ).toEqual({
      gatePath: "docs/release-execution-gates/example-package-build-gate.json",
      pretty: false,
    });
  });

  it("requires a gate path", () => {
    expect(() => parsePackageBuildGateCheckArgs([])).toThrow(
      "--gate <path> is required",
    );
  });

  it("builds a green gate result from a valid gate file", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildPackageBuildGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildReleaseExecutionPlanResult: okExecutionPlanResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:package-build:gate:check",
      packageBuildGateClaim: "package_build_execution_gate_defined",
      readyForPackageBuildOperatorReview: true,
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
    });
  });

  it("fails when the reused execution plan report is not green", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildPackageBuildGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildReleaseExecutionPlanResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForReleaseExecutionGateDesign: false,
          planningOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "release_execution_plan_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("rejects invalid JSON", () => {
    const { cwd, gatePath } = writeGateFile("{");

    expect(() =>
      buildPackageBuildGateCheckCliResult({
        cwd,
        gatePath,
        buildReleaseExecutionPlanResult: okExecutionPlanResult,
      }),
    ).toThrow("package build gate file is not valid JSON");
  });
});
