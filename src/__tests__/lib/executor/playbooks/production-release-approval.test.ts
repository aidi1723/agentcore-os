import { describe, expect, it } from "vitest";

import {
  PRODUCTION_RELEASE_APPROVAL_CHECK_COMMAND,
  validateProductionReleaseApprovalPacket,
} from "@/lib/executor/playbooks/production-release-approval";

const productionPolicyPath =
  "docs/release-policies/example-production-release-policy.json";

function productionPolicyReport(overrides = {}) {
  return {
    ok: true,
    readyForProductionReleasePolicyReview: true,
    policyClaim: "production_release_policy_defined",
    policyOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run release:production-policy:check -- --policy ${productionPolicyPath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T12:00:01Z",
      gate: "production_release_policy_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T12:00:02Z",
      testFiles: 101,
      tests: 523,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T12:00:03Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T12:00:04Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T12:00:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T12:00:06Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function actionDecision(overrides = {}) {
  return {
    decision: "blocked_until_execution_gate",
    approvalRequired: true,
    executionGateRequired: true,
    executed: false,
    owner: "agentcore-release-maintainers",
    notes: ["Approval packet records intent only; execution remains blocked."],
    ...overrides,
  };
}

function approvalPacket(overrides = {}) {
  return {
    approvalId: "production-release-approval-2026-07-07",
    productionPolicyPath,
    reviewer: {
      id: "maintainer-aidi",
      name: "AgentCore Maintainer",
      role: "release_reviewer",
    },
    recordedAt: "2026-07-07T12:00:00Z",
    expiresAt: "2026-07-14T12:00:00Z",
    approvalScope: "production_release_approval_packet",
    productionReleasePolicyResult: {
      ok: true,
      policyOnly: true,
      policyClaim: "production_release_policy_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    commandEvidence: commandEvidence(),
    releaseActionDecisions: {
      packaging: actionDecision(),
      tagCreation: actionDecision(),
      artifactUpload: actionDecision(),
      deployment: actionDecision(),
      externalWrites: actionDecision(),
    },
    rollbackOwner: {
      owner: "agentcore-release-maintainers",
      contact: "release-maintainers",
      rollbackPlanDocumented: true,
    },
    monitoringOwner: {
      owner: "agentcore-runtime-maintainers",
      contact: "runtime-maintainers",
      monitoringPlanDocumented: true,
    },
    riskAcceptance: {
      acceptedForExecutionPlanning: true,
      productionReady: false,
      publishingApproved: false,
      tagApproved: false,
      packageApproved: false,
      uploadApproved: false,
      deploymentApproved: false,
      externalWritesApproved: false,
      credentialUseApproved: false,
      deferredExecutionGates: [
        "package_build_execution_gate",
        "tag_creation_execution_gate",
        "artifact_upload_execution_gate",
        "deployment_execution_gate",
      ],
    },
    approvalBoundary: {
      approvalPacketOnly: true,
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
    approvalStatus: "approved_for_release_execution_planning",
    notes: ["Approval packet only; release execution remains blocked."],
    ...overrides,
  };
}

describe("validateProductionReleaseApprovalPacket", () => {
  it("marks approval packet ready while keeping execution actions blocked", () => {
    const report = validateProductionReleaseApprovalPacket(approvalPacket(), {
      approvalPath:
        "docs/release-approvals/example-production-release-approval.json",
      productionPolicyReport: productionPolicyReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PRODUCTION_RELEASE_APPROVAL_CHECK_COMMAND,
      status: "production_release_approval_packet_ready",
      readyForReleaseExecutionPlanning: true,
      approvalClaim: "production_release_approval_packet_defined",
      productionReady: false,
      publishingPerformed: false,
      approvalPacketOnly: true,
      checks: {
        productionPolicyOk: true,
        identityOk: true,
        expiryOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        releaseActionDecisionsOk: true,
        releaseActionsBlocked: true,
        ownersOk: true,
        riskAcceptanceOk: true,
        policyBoundaryOk: true,
        approvalBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start release execution planning gates",
    });
  });

  it("fails closed when the referenced production policy is not green", () => {
    const report = validateProductionReleaseApprovalPacket(approvalPacket(), {
      productionPolicyReport: productionPolicyReport({
        ok: false,
        readyForProductionReleasePolicyReview: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "production_release_policy_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_production_policy",
        }),
      ],
    });
    expect(report).not.toHaveProperty("approvalClaim");
  });

  it("rejects missing reviewer identity and expired approvals", () => {
    const report = validateProductionReleaseApprovalPacket(
      approvalPacket({
        reviewer: { id: "", name: "", role: "" },
        expiresAt: "2026-07-01T12:00:00Z",
      }),
      {
        productionPolicyReport: productionPolicyReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_reviewer_identity" }),
        expect.objectContaining({ code: "invalid_approval_expiry" }),
      ]),
    );
  });

  it("rejects executed or over-authorized release action decisions", () => {
    const report = validateProductionReleaseApprovalPacket(
      approvalPacket({
        releaseActionDecisions: {
          packaging: actionDecision({
            decision: "approved_for_immediate_execution",
            executed: true,
          }),
          tagCreation: actionDecision(),
          artifactUpload: actionDecision(),
          deployment: actionDecision(),
          externalWrites: actionDecision(),
        },
      }),
      {
        productionPolicyReport: productionPolicyReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "release_action_decision_executed_or_over_authorized",
        }),
      ]),
    );
  });

  it("rejects approval boundary breaches", () => {
    const report = validateProductionReleaseApprovalPacket(
      approvalPacket({
        approvalBoundary: {
          approvalPacketOnly: true,
          commandsExecutedByChecker: false,
          publishingPerformed: true,
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
      }),
      {
        productionPolicyReport: productionPolicyReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "approval_boundary_breached" }),
      ]),
    );
  });
});
