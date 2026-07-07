import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildDeploymentGateCheckCliResult,
  parseDeploymentGateCheckArgs,
} from "../../../scripts/release-execution/check-deployment-gate.mjs";

const artifactUploadGatePath =
  "docs/release-execution-gates/example-artifact-upload-gate.json";

function writeGateFile(gate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-deployment-gate-"));
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
    commandEvidence: [
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
    ],
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
  };
}

function okArtifactUploadGateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForArtifactUploadOperatorReview: true,
      artifactUploadGateClaim: "artifact_upload_execution_gate_defined",
      gateOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("deployment gate check script", () => {
  it("parses gate and compact flags", () => {
    expect(
      parseDeploymentGateCheckArgs([
        "--gate",
        "docs/release-execution-gates/example-deployment-gate.json",
        "--compact",
      ]),
    ).toEqual({
      gatePath: "docs/release-execution-gates/example-deployment-gate.json",
      pretty: false,
    });
  });

  it("requires a gate path", () => {
    expect(() => parseDeploymentGateCheckArgs([])).toThrow(
      "--gate <path> is required",
    );
  });

  it("builds a green gate result from a valid gate file", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildDeploymentGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildArtifactUploadGateResult: okArtifactUploadGateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:deployment:gate:check",
      deploymentGateClaim: "deployment_execution_gate_defined",
      readyForDeploymentOperatorReview: true,
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
    });
  });

  it("fails when the reused artifact upload gate report is not green", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildDeploymentGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildArtifactUploadGateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForArtifactUploadOperatorReview: false,
          gateOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "artifact_upload_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("reports invalid JSON without running deployment commands", () => {
    const { cwd, gatePath } = writeGateFile("{not json");

    expect(() =>
      buildDeploymentGateCheckCliResult({
        cwd,
        gatePath,
        pretty: false,
        buildArtifactUploadGateResult: okArtifactUploadGateResult,
      }),
    ).toThrow("deployment gate file is not valid JSON");
  });
});
