import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildExternalWriteGateCheckCliResult,
  parseExternalWriteGateCheckArgs,
} from "../../../scripts/release-execution/check-external-write-gate.mjs";

const deploymentGatePath =
  "docs/release-execution-gates/example-deployment-gate.json";

function writeGateFile(gate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-external-write-gate-"));
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
    commandEvidence: [
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
    ],
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
  };
}

function okDeploymentGateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForDeploymentOperatorReview: true,
      deploymentGateClaim: "deployment_execution_gate_defined",
      gateOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("external-write gate check script", () => {
  it("parses gate and compact flags", () => {
    expect(
      parseExternalWriteGateCheckArgs([
        "--gate",
        "docs/release-execution-gates/example-external-write-gate.json",
        "--compact",
      ]),
    ).toEqual({
      gatePath: "docs/release-execution-gates/example-external-write-gate.json",
      pretty: false,
    });
  });

  it("requires a gate path", () => {
    expect(() => parseExternalWriteGateCheckArgs([])).toThrow(
      "--gate <path> is required",
    );
  });

  it("builds a green gate result from a valid gate file", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildExternalWriteGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildDeploymentGateResult: okDeploymentGateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:external-write:gate:check",
      externalWriteGateClaim: "external_write_execution_gate_defined",
      readyForExternalWriteOperatorReview: true,
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
    });
  });

  it("fails when the reused deployment gate report is not green", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildExternalWriteGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildDeploymentGateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForDeploymentOperatorReview: false,
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
      status: "deployment_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("reports invalid JSON without running external write commands", () => {
    const { cwd, gatePath } = writeGateFile("{not json");

    expect(() =>
      buildExternalWriteGateCheckCliResult({
        cwd,
        gatePath,
        pretty: false,
        buildDeploymentGateResult: okDeploymentGateResult,
      }),
    ).toThrow("external-write gate file is not valid JSON");
  });
});
