import { describe, expect, it } from "vitest";

import {
  ARTIFACT_UPLOAD_GATE_CHECK_COMMAND,
  validateArtifactUploadExecutionGate,
} from "@/lib/executor/playbooks/artifact-upload-execution-gate";

const tagCreationGatePath =
  "docs/release-execution-gates/example-tag-creation-gate.json";

function tagCreationGateReport(overrides = {}) {
  return {
    ok: true,
    readyForTagCreationOperatorReview: true,
    tagCreationGateClaim: "tag_creation_execution_gate_defined",
    gateOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
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
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function artifactUploadGate(overrides = {}) {
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
    commandEvidence: commandEvidence(),
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
    ...overrides,
  };
}

describe("validateArtifactUploadExecutionGate", () => {
  it("marks artifact upload gate ready while keeping upload blocked", () => {
    const report = validateArtifactUploadExecutionGate(artifactUploadGate(), {
      gatePath: "docs/release-execution-gates/example-artifact-upload-gate.json",
      tagCreationGateReport: tagCreationGateReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: ARTIFACT_UPLOAD_GATE_CHECK_COMMAND,
      status: "artifact_upload_gate_ready",
      readyForArtifactUploadOperatorReview: true,
      artifactUploadGateClaim: "artifact_upload_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
      checks: {
        tagCreationGateOk: true,
        identityOk: true,
        artifactUploadRequestOk: true,
        artifactIdentityReviewOk: true,
        checksumProvenancePolicyOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        rollbackPlanOk: true,
        monitoringPlanOk: true,
        credentialBoundaryOk: true,
        artifactUploadDecisionOk: true,
        artifactUploadBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start deployment execution gate design",
    });
  });

  it("fails closed when the referenced tag creation gate is not green", () => {
    const report = validateArtifactUploadExecutionGate(artifactUploadGate(), {
      tagCreationGateReport: tagCreationGateReport({
        ok: false,
        readyForTagCreationOperatorReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "tag_creation_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_tag_creation_gate",
        }),
      ],
    });
    expect(report).not.toHaveProperty("artifactUploadGateClaim");
  });

  it("rejects missing or mismatched artifact upload request metadata", () => {
    const report = validateArtifactUploadExecutionGate(
      artifactUploadGate({
        artifactUploadRequest: {
          artifactName: "agentcore-os-desktop.zip",
          artifactType: "",
          sourceArtifactPath: "",
          uploadDestination: "",
          uploadCommand: "",
        },
      }),
      {
        tagCreationGateReport: tagCreationGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact_upload_request_missing",
        }),
      ]),
    );
  });

  it("rejects checksum or provenance generated by the gate", () => {
    const report = validateArtifactUploadExecutionGate(
      artifactUploadGate({
        checksumProvenancePolicy: {
          checksumRequired: true,
          checksumAlgorithm: "sha256",
          checksumCreatedByGate: true,
          provenanceRequired: true,
          provenanceCreatedByGate: true,
        },
      }),
      {
        tagCreationGateReport: tagCreationGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "checksum_provenance_boundary_breached",
        }),
      ]),
    );
  });

  it("rejects boundary records that uploaded artifacts or created releases", () => {
    const report = validateArtifactUploadExecutionGate(
      artifactUploadGate({
        artifactUploadBoundary: {
          gateOnly: true,
          commandsExecutedByChecker: false,
          artifactsCreated: false,
          checksumsCreated: false,
          artifactsUploaded: true,
          releaseCreated: true,
          deploymentPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          credentialsUsed: false,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      {
        tagCreationGateReport: tagCreationGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact_upload_boundary_breached",
        }),
      ]),
    );
  });
});
