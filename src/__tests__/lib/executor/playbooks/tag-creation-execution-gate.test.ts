import { describe, expect, it } from "vitest";

import {
  TAG_CREATION_GATE_CHECK_COMMAND,
  validateTagCreationExecutionGate,
} from "@/lib/executor/playbooks/tag-creation-execution-gate";

const packageBuildGatePath =
  "docs/release-execution-gates/example-package-build-gate.json";

function packageBuildGateReport(overrides = {}) {
  return {
    ok: true,
    readyForPackageBuildOperatorReview: true,
    packageBuildGateClaim: "package_build_execution_gate_defined",
    gateOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:package-build:gate:check -- --gate ${packageBuildGatePath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:01Z",
      gate: "package_build_gate_green",
    },
    {
      command: "npm run release:hygiene:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:02Z",
      gate: "release_hygiene_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:03Z",
      testFiles: 107,
      tests: 553,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T15:00:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function tagCreationGate(overrides = {}) {
  return {
    gateId: "tag-creation-gate-2026-07-07",
    packageBuildGatePath,
    owner: {
      id: "agentcore-release-maintainers",
      name: "AgentCore Release Maintainers",
      role: "tag_creation_gate_reviewer",
    },
    recordedAt: "2026-07-07T15:00:00Z",
    targetVersion: "1.3.0",
    releaseAction: "tag_creation",
    packageBuildGateResult: {
      ok: true,
      gateOnly: true,
      packageBuildGateClaim: "package_build_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    tagRequest: {
      tagName: "v1.3.0",
      targetCommit: "838f561",
      sourceBranch: "main",
      tagType: "annotated",
      tagMessagePolicy: "version_and_release_summary_required",
    },
    tagPolicyReview: {
      tagNameMatchesVersion: true,
      annotatedTagRequired: true,
      changelogLinkageReviewed: true,
      releaseNotesLinkageReviewed: true,
      existingTagChecked: true,
      tagCollisionFound: false,
    },
    sourceCommitEvidence: {
      targetCommitRecorded: true,
      sourceBranchRecorded: true,
      workingTreeDiffGateRecorded: true,
      currentBranchPolicy: "main_branch_head_at_gate_recording",
    },
    commandEvidence: commandEvidence(),
    releaseNotesLinkage: {
      changelogUpdated: true,
      releaseNotesDrafted: true,
      releaseNotesPath: "CHANGELOG.md",
      targetVersionMentioned: true,
    },
    rollbackPlan: {
      owner: "agentcore-release-maintainers",
      documented: true,
      deleteLocalTagCommandDeclared: true,
      deleteRemoteTagCommandDeclared: true,
      executed: false,
    },
    monitoringPlan: {
      owner: "agentcore-runtime-maintainers",
      documented: true,
      tagVerificationDeclared: true,
      executed: false,
    },
    credentialBoundary: {
      credentialsRequiredForGate: false,
      credentialsUsed: false,
      credentialUseApproved: false,
      secretMaterialRecorded: false,
    },
    tagCreationDecision: {
      decision: "blocked_until_operator_execution_approval",
      tagCreationApproved: false,
      tagCreated: false,
      tagPushApproved: false,
      tagPushPerformed: false,
      executionGateRequired: true,
      credentialUseAllowed: false,
      productionReadinessClaimed: false,
    },
    tagCreationBoundary: {
      gateOnly: true,
      commandsExecutedByChecker: false,
      tagCreated: false,
      tagPushed: false,
      releaseCreated: false,
      artifactsUploaded: false,
      deploymentPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "tag_creation_execution_gate_review",
    notes: ["Tag creation gate only; tag creation remains blocked."],
    ...overrides,
  };
}

describe("validateTagCreationExecutionGate", () => {
  it("marks tag creation gate ready while keeping tag creation blocked", () => {
    const report = validateTagCreationExecutionGate(tagCreationGate(), {
      gatePath: "docs/release-execution-gates/example-tag-creation-gate.json",
      packageBuildGateReport: packageBuildGateReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: TAG_CREATION_GATE_CHECK_COMMAND,
      status: "tag_creation_gate_ready",
      readyForTagCreationOperatorReview: true,
      tagCreationGateClaim: "tag_creation_execution_gate_defined",
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
      checks: {
        packageBuildGateOk: true,
        identityOk: true,
        tagRequestOk: true,
        tagPolicyReviewOk: true,
        sourceCommitEvidenceOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        releaseNotesLinkageOk: true,
        rollbackPlanOk: true,
        monitoringPlanOk: true,
        credentialBoundaryOk: true,
        tagCreationDecisionOk: true,
        tagCreationBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start artifact upload execution gate design",
    });
  });

  it("fails closed when the referenced package build gate is not green", () => {
    const report = validateTagCreationExecutionGate(tagCreationGate(), {
      packageBuildGateReport: packageBuildGateReport({
        ok: false,
        readyForPackageBuildOperatorReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "package_build_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_package_build_gate",
        }),
      ],
    });
    expect(report).not.toHaveProperty("tagCreationGateClaim");
  });

  it("rejects missing or mismatched tag request metadata", () => {
    const report = validateTagCreationExecutionGate(
      tagCreationGate({
        tagRequest: {
          tagName: "release-1.3.0",
          targetCommit: "",
          sourceBranch: "",
          tagType: "lightweight",
        },
      }),
      {
        packageBuildGateReport: packageBuildGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "tag_request_missing",
        }),
      ]),
    );
  });

  it("rejects over-authorized tag creation decisions", () => {
    const report = validateTagCreationExecutionGate(
      tagCreationGate({
        tagCreationDecision: {
          decision: "approved_for_execution",
          tagCreationApproved: true,
          tagCreated: true,
          tagPushApproved: true,
          tagPushPerformed: true,
          executionGateRequired: true,
          credentialUseAllowed: true,
          productionReadinessClaimed: true,
        },
      }),
      {
        packageBuildGateReport: packageBuildGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "tag_creation_decision_over_authorized",
        }),
      ]),
    );
  });

  it("rejects boundary records that created or pushed tags", () => {
    const report = validateTagCreationExecutionGate(
      tagCreationGate({
        tagCreationBoundary: {
          gateOnly: true,
          commandsExecutedByChecker: false,
          tagCreated: true,
          tagPushed: true,
          releaseCreated: true,
          artifactsUploaded: false,
          deploymentPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          credentialsUsed: false,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      {
        packageBuildGateReport: packageBuildGateReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "tag_creation_boundary_breached",
        }),
      ]),
    );
  });
});
