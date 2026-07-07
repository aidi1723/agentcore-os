import { describe, expect, it } from "vitest";

import {
  PRODUCTION_RELEASE_POLICY_CHECK_COMMAND,
  validateProductionReleasePolicy,
} from "@/lib/executor/playbooks/production-release-policy";

const deliveryCandidatePath =
  "docs/delivery-candidates/example-local-delivery-candidate.json";

function deliveryCandidateReport(overrides = {}) {
  return {
    ok: true,
    readyForLocalDeliveryCandidate: true,
    deliveryClaim: "local_delivery_candidate_ready",
    candidateOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run delivery:candidate:check -- --candidate ${deliveryCandidatePath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:01Z",
      gate: "delivery_candidate_green",
    },
    {
      command: "npm run release:hygiene:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:02Z",
      gate: "release_hygiene_green",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:03Z",
      testFiles: 101,
      tests: 523,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:30:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function releasePolicySection(overrides = {}) {
  return {
    owner: "agentcore-release-maintainers",
    approvalRequired: true,
    approved: false,
    executed: false,
    policyDocumented: true,
    ...overrides,
  };
}

function policyPacket(overrides = {}) {
  return {
    policyId: "production-release-policy-2026-07-07",
    deliveryCandidatePath,
    owner: "agentcore-release-maintainers",
    recordedAt: "2026-07-07T11:30:00Z",
    productionReleasePolicy: {
      targetVersion: "v1.3.0-local-candidate",
      targetEnvironment: "production",
      releaseType: "source_distribution",
      sourceDeliveryCandidateClaim: "local_delivery_candidate_ready",
      releaseDecision: "blocked_until_explicit_production_approval",
      nextBoundary: "production_release_approval_packet",
    },
    commandEvidence: commandEvidence(),
    policySections: {
      packaging: releasePolicySection(),
      tagCreation: releasePolicySection(),
      artifactUpload: releasePolicySection(),
      deployment: releasePolicySection(),
      externalWrites: releasePolicySection(),
      monitoring: releasePolicySection({
        approvalRequired: false,
        readinessDocumented: true,
      }),
      rollback: releasePolicySection({
        approvalRequired: false,
        rollbackDocumented: true,
        rollbackNotes: ["Restore previous release candidate and rerun local gates."],
      }),
    },
    riskSummary: {
      productionReady: false,
      publishingApproved: false,
      tagApproved: false,
      packageApproved: false,
      uploadApproved: false,
      deploymentApproved: false,
      externalWritesApproved: false,
      credentialUseApproved: false,
      deferredItems: [
        "explicit production release approval packet",
        "package/signing command approval",
        "deployment environment approval",
      ],
    },
    rollbackSummary: {
      rollbackAvailable: true,
      rollbackNotes: [
        "No production action has been executed by this policy gate.",
      ],
    },
    deliveryCandidateResult: {
      ok: true,
      candidateOnly: true,
      deliveryClaim: "local_delivery_candidate_ready",
      productionReady: false,
      publishingPerformed: false,
    },
    releaseBoundary: {
      policyOnly: true,
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
    approvalStatus: "production_release_policy_review",
    notes: ["Policy definition only; release execution remains blocked."],
    ...overrides,
  };
}

describe("validateProductionReleasePolicy", () => {
  it("marks production release policy ready while keeping release actions blocked", () => {
    const report = validateProductionReleasePolicy(policyPacket(), {
      policyPath: "docs/release-policies/example-production-release-policy.json",
      deliveryCandidateReport: deliveryCandidateReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PRODUCTION_RELEASE_POLICY_CHECK_COMMAND,
      status: "production_release_policy_ready",
      readyForProductionReleasePolicyReview: true,
      policyClaim: "production_release_policy_defined",
      productionReady: false,
      publishingPerformed: false,
      policyOnly: true,
      checks: {
        deliveryCandidateOk: true,
        releasePolicyComplete: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        policySectionsOk: true,
        riskSummaryOk: true,
        rollbackSummaryOk: true,
        deliveryCandidateBoundaryOk: true,
        releaseBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start production release approval packet",
    });
  });

  it("fails closed when the referenced delivery candidate is not green", () => {
    const report = validateProductionReleasePolicy(policyPacket(), {
      deliveryCandidateReport: deliveryCandidateReport({
        ok: false,
        readyForLocalDeliveryCandidate: false,
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "delivery_candidate_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_delivery_candidate",
        }),
      ],
    });
    expect(report).not.toHaveProperty("policyClaim");
  });

  it("rejects command evidence that is out of order or missing metadata", () => {
    const invalidEvidence = commandEvidence();
    delete (invalidEvidence[2] as { tests?: number }).tests;
    invalidEvidence.reverse();

    const report = validateProductionReleasePolicy(
      policyPacket({ commandEvidence: invalidEvidence }),
      {
        deliveryCandidateReport: deliveryCandidateReport(),
      },
    );

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_command_evidence_sequence",
        }),
        expect.objectContaining({
          code: "invalid_command_evidence_metadata",
        }),
      ]),
    );
  });

  it("rejects approved or executed packaging/tag/upload/deployment policy sections", () => {
    const report = validateProductionReleasePolicy(
      policyPacket({
        policySections: {
          packaging: releasePolicySection({ approved: true }),
          tagCreation: releasePolicySection({ executed: true }),
          artifactUpload: releasePolicySection(),
          deployment: releasePolicySection(),
          externalWrites: releasePolicySection(),
          monitoring: releasePolicySection({
            approvalRequired: false,
            readinessDocumented: true,
          }),
          rollback: releasePolicySection({
            approvalRequired: false,
            rollbackDocumented: true,
            rollbackNotes: ["Restore previous release candidate."],
          }),
        },
      }),
      {
        deliveryCandidateReport: deliveryCandidateReport(),
      },
    );

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "release_policy_action_approved_or_executed",
        }),
      ]),
    );
    expect(report.readyForProductionReleasePolicyReview).toBe(false);
  });

  it("rejects a release boundary that records tag creation or credential use", () => {
    const report = validateProductionReleasePolicy(
      policyPacket({
        releaseBoundary: {
          policyOnly: true,
          commandsExecutedByChecker: false,
          publishingPerformed: false,
          tagCreated: true,
          packageBuilt: false,
          uploadPerformed: false,
          deploymentPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          credentialsUsed: true,
          productionReady: false,
          productionReadinessClaimed: false,
        },
      }),
      {
        deliveryCandidateReport: deliveryCandidateReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      findings: [
        expect.objectContaining({
          code: "release_boundary_breached",
        }),
      ],
    });
  });
});
