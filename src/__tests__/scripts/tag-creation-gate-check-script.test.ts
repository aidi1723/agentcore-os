import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildTagCreationGateCheckCliResult,
  parseTagCreationGateCheckArgs,
} from "../../../scripts/release-execution/check-tag-creation-gate.mjs";

const packageBuildGatePath =
  "docs/release-execution-gates/example-package-build-gate.json";

function writeGateFile(gate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-tag-creation-gate-"));
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
    commandEvidence: [
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
    ],
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
  };
}

function okPackageBuildGateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForPackageBuildOperatorReview: true,
      packageBuildGateClaim: "package_build_execution_gate_defined",
      gateOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("tag creation gate check script", () => {
  it("parses gate and compact flags", () => {
    expect(
      parseTagCreationGateCheckArgs([
        "--gate",
        "docs/release-execution-gates/example-tag-creation-gate.json",
        "--compact",
      ]),
    ).toEqual({
      gatePath: "docs/release-execution-gates/example-tag-creation-gate.json",
      pretty: false,
    });
  });

  it("requires a gate path", () => {
    expect(() => parseTagCreationGateCheckArgs([])).toThrow(
      "--gate <path> is required",
    );
  });

  it("builds a green gate result from a valid gate file", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildTagCreationGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildPackageBuildGateResult: okPackageBuildGateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:tag-creation:gate:check",
      tagCreationGateClaim: "tag_creation_execution_gate_defined",
      readyForTagCreationOperatorReview: true,
      productionReady: false,
      publishingPerformed: false,
      gateOnly: true,
    });
  });

  it("fails when the reused package build gate report is not green", () => {
    const { cwd, gatePath } = writeGateFile(validGate());
    const result = buildTagCreationGateCheckCliResult({
      cwd,
      gatePath,
      pretty: false,
      buildPackageBuildGateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForPackageBuildOperatorReview: false,
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
      status: "package_build_gate_not_green",
      productionReady: false,
      publishingPerformed: false,
    });
  });

  it("reports invalid JSON without running tag commands", () => {
    const { cwd, gatePath } = writeGateFile("{not json");

    expect(() =>
      buildTagCreationGateCheckCliResult({
        cwd,
        gatePath,
        pretty: false,
        buildPackageBuildGateResult: okPackageBuildGateResult,
      }),
    ).toThrow("tag creation gate file is not valid JSON");
  });
});
