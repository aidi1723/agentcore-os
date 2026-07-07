import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildProductionVerificationGateCheckCliResult,
  parseProductionVerificationGateCheckArgs,
} from "../../../scripts/release-execution/check-production-verification-gate.mjs";

const externalWriteGatePath =
  "docs/release-execution-gates/example-external-write-gate.json";

function writeGateFile(gate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(
    join(tmpdir(), "agentcore-production-verification-gate-"),
  );
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
    commandEvidence: [
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
    ],
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
  };
}

function okExternalWriteGateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForExternalWriteOperatorReview: true,
      externalWriteGateClaim: "external_write_execution_gate_defined",
      gateOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("production verification gate check script", () => {
  it("parses gate and compact flags", () => {
    expect(
      parseProductionVerificationGateCheckArgs([
        "--gate",
        "docs/release-execution-gates/example-production-verification-gate.json",
        "--compact",
      ]),
    ).toEqual({
      gatePath:
        "docs/release-execution-gates/example-production-verification-gate.json",
      pretty: false,
    });
  });

  it("requires a gate path", () => {
    expect(() => parseProductionVerificationGateCheckArgs([])).toThrow(
      "--gate <path> is required",
    );
  });

  it("builds a green gate result from a valid gate file", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildProductionVerificationGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildExternalWriteGateResult: okExternalWriteGateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:production-verification:gate:check",
      productionVerificationClaim:
        "production_verification_requirements_defined",
      readyForReleaseExecutionApprovalReview: true,
      productionReady: false,
      publishingPerformed: false,
      verificationOnly: true,
    });
  });

  it("fails when the reused external-write gate report is not green", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildProductionVerificationGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildExternalWriteGateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForExternalWriteOperatorReview: false,
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
      status: "external_write_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("reports invalid JSON without running production verification commands", () => {
    const { cwd, gatePath } = writeGateFile("{not json");

    expect(() =>
      buildProductionVerificationGateCheckCliResult({
        cwd,
        gatePath,
        pretty: false,
        buildExternalWriteGateResult: okExternalWriteGateResult,
      }),
    ).toThrow("production verification gate file is not valid JSON");
  });
});
