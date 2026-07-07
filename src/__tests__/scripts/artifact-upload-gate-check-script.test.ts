import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildArtifactUploadGateCheckCliResult,
  parseArtifactUploadGateCheckArgs,
} from "../../../scripts/release-execution/check-artifact-upload-gate.mjs";

const tagCreationGatePath =
  "docs/release-execution-gates/example-tag-creation-gate.json";

function writeGateFile(gate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-artifact-upload-gate-"));
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
    gateId: "artifact-upload-gate-2026-07-07",
    tagCreationGatePath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "artifact_upload_gate_reviewer",
    },
    recordedAt: "2026-07-07T16:00:00Z",
    targetVersion: "1.3.0",
    releaseAction: "artifact_upload",
    tagCreationGateResult: {
      ok: true,
      gateOnly: true,
      tagCreationGateClaim: "tag_creation_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    artifactUploadRequest: {
      artifactName: "agentcore-os-v1.3.0-desktop-installer.zip",
      artifactType: "desktop_installer",
      sourceArtifactPath:
        "output/desktop/agentcore-os-v1.3.0-desktop-installer.zip",
      uploadDestination: "github_release_v1.3.0",
      uploadCommand:
        "gh release upload v1.3.0 output/desktop/agentcore-os-v1.3.0-desktop-installer.zip",
      uploadPathPolicy: "blocked_until_operator_execution_approval",
    },
    artifactIdentityReview: {
      artifactNameMatchesVersion: true,
      artifactTypeReviewed: true,
      sourcePathScopedToReleaseOutput: true,
      uploadDestinationReviewed: true,
      releaseTagLinkageReviewed: true,
    },
    checksumProvenancePolicy: {
      checksumRequired: true,
      checksumAlgorithm: "sha256",
      checksumCreatedByGate: false,
      provenanceRequired: true,
      provenanceCreatedByGate: false,
    },
    commandEvidence: [
      {
        command: `npm run release:tag-creation:gate:check -- --gate ${tagCreationGatePath}`,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:01Z",
        gate: "tag_creation_gate_green",
      },
      {
        command: "npm run release:hygiene:check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:02Z",
        gate: "release_hygiene_green",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:03Z",
        testFiles: 109,
        tests: 563,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:04Z",
        gate: "core_workflows_green",
      },
      {
        command: "npm run lint",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:05Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "npm run build",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:06Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T16:00:07Z",
        gate: "git_diff_check_green",
      },
    ],
    rollbackPlan: {
      owner: "agentcore-release-maintainers",
      documented: true,
      removeUploadedArtifactCommandDeclared: true,
      releaseRollbackDocumented: true,
      executed: false,
    },
    monitoringPlan: {
      owner: "agentcore-runtime-maintainers",
      documented: true,
      artifactAvailabilityCheckDeclared: true,
      executed: false,
    },
    credentialBoundary: {
      credentialsRequiredForGate: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    artifactUploadDecision: {
      decision: "blocked_until_operator_execution_approval",
      uploadApproved: false,
      uploadPerformed: false,
      releaseCreationApproved: false,
      releaseCreated: false,
      executionGateRequired: true,
      credentialUseAllowed: false,
      productionReadinessClaimed: false,
    },
    artifactUploadBoundary: {
      gateOnly: true,
      commandsExecutedByChecker: false,
      artifactsCreated: false,
      checksumsCreated: false,
      artifactsUploaded: false,
      releaseCreated: false,
      deploymentPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "artifact_upload_execution_gate_review",
    notes: ["Artifact upload gate only; upload remains blocked."],
  };
}

function okTagCreationGateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForTagCreationOperatorReview: true,
      tagCreationGateClaim: "tag_creation_execution_gate_defined",
      gateOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("artifact upload gate check script", () => {
  it("parses gate and compact flags", () => {
    expect(
      parseArtifactUploadGateCheckArgs([
        "--gate",
        "docs/release-execution-gates/example-artifact-upload-gate.json",
        "--compact",
      ]),
    ).toEqual({
      gatePath: "docs/release-execution-gates/example-artifact-upload-gate.json",
      pretty: false,
    });
  });

  it("requires a gate path", () => {
    expect(() => parseArtifactUploadGateCheckArgs([])).toThrow(
      "--gate <path> is required",
    );
  });

  it("builds a green gate result from a valid gate file", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildArtifactUploadGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildTagCreationGateResult: okTagCreationGateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:artifact-upload:gate:check",
      artifactUploadGateClaim: "artifact_upload_execution_gate_defined",
      readyForArtifactUploadOperatorReview: true,
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
    });
  });

  it("fails when the reused tag creation gate report is not green", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildArtifactUploadGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildTagCreationGateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForTagCreationOperatorReview: false,
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
      status: "tag_creation_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("reports invalid JSON without running upload commands", () => {
    const { cwd, gatePath } = writeGateFile("{not json");

    expect(() =>
      buildArtifactUploadGateCheckCliResult({
        cwd,
        gatePath,
        pretty: false,
        buildTagCreationGateResult: okTagCreationGateResult,
      }),
    ).toThrow("artifact upload gate file is not valid JSON");
  });
});
