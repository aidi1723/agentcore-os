import { describe, expect, it } from "vitest";

import {
  DELIVERY_CANDIDATE_CHECK_COMMAND,
  validateDeliveryCandidateReadiness,
} from "@/lib/executor/playbooks/delivery-candidate-readiness";

const handoffSummaryPath =
  "docs/playbook-lifecycle-mutation-handoff-summaries/example-version-update-handoff-summary.json";

function handoffSummaryReport(overrides = {}) {
  return {
    ok: true,
    readyForMaintainerHandoffSummary: true,
    summaryOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function deliveryReadyReport(overrides = {}) {
  return {
    ok: true,
    command: "delivery:ready:check",
    releaseClaim: "local_delivery_demo_ready",
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function commandEvidence(overrides: Record<string, unknown> = {}) {
  const commands = [
    {
      command: `npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary ${handoffSummaryPath}`,
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:01Z",
      gate: "handoff_summary_green",
    },
    {
      command: "npm run delivery:ready:check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:02Z",
      releaseClaim: "local_delivery_demo_ready",
    },
    {
      command: "npm run test:controlled-runtime",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:03Z",
      testFiles: 95,
      tests: 493,
    },
    {
      command: "npm run test:core-workflows",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:04Z",
      gate: "core_workflows_green",
    },
    {
      command: "npm run lint",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:05Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "npm run build",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:06Z",
      warningCount: 1,
      knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
    },
    {
      command: "git diff --check",
      ok: true,
      exitCode: 0,
      recordedAt: "2026-07-07T11:10:07Z",
      gate: "git_diff_check_green",
    },
  ];

  return commands.map((entry) =>
    entry.command === overrides.command ? { ...entry, ...overrides } : entry,
  );
}

function candidateReport(overrides = {}) {
  return {
    candidateId: "local-delivery-candidate-2026-07-07",
    handoffSummaryPath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T11:10:00Z",
    deliveryCandidate: {
      targetMilestone: "controlled-runtime-local-delivery-candidate",
      deliveryClaim: "local_delivery_candidate_ready",
      sourceHandoffClaim: "local_release_handoff_ready",
      nextBoundary: "production_release_policy_hardening",
    },
    commandEvidence: commandEvidence(),
    documentationSummary: {
      updatedFiles: [
        "README.md",
        "CHANGELOG.md",
        "docs/NEXT_STEPS.md",
        "docs/PROJECT_FRAMEWORK.zh-CN.md",
        "docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md",
        "docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md",
        "docs/DOCUMENTATION_INDEX.zh-CN.md",
      ],
      status: "delivery_candidate_docs_aligned",
    },
    riskSummary: {
      productionReady: false,
      publishingApproved: false,
      externalWritesApproved: false,
      tagApproved: false,
      packageApproved: false,
      uploadApproved: false,
      deferredItems: [
        "production release policy",
        "deployment environment validation",
      ],
    },
    rollbackSummary: {
      rollbackAvailable: true,
      rollbackNotes: [
        "Revert the delivery candidate gate commit and rerun local checks.",
      ],
    },
    handoffSummaryResult: {
      ok: true,
      summaryOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    deliveryReadyResult: {
      ok: true,
      releaseClaim: "local_delivery_demo_ready",
      productionReady: false,
    },
    deliveryCandidateBoundary: {
      candidateOnly: true,
      commandsExecutedByChecker: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      tagCreated: false,
      packageBuilt: false,
      uploadPerformed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "delivery_candidate_review",
    notes: ["Local delivery candidate only; production release remains separate."],
    ...overrides,
  };
}

describe("validateDeliveryCandidateReadiness", () => {
  it("marks a local delivery candidate ready while preserving non-production boundaries", () => {
    const report = validateDeliveryCandidateReadiness(candidateReport(), {
      candidatePath: "docs/delivery-candidates/example-local-delivery-candidate.json",
      handoffSummaryReport: handoffSummaryReport(),
      deliveryReadyReport: deliveryReadyReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: DELIVERY_CANDIDATE_CHECK_COMMAND,
      status: "local_delivery_candidate_ready",
      readyForLocalDeliveryCandidate: true,
      deliveryClaim: "local_delivery_candidate_ready",
      productionReady: false,
      publishingPerformed: false,
      candidateOnly: true,
      checks: {
        handoffSummaryOk: true,
        deliveryReadyOk: true,
        commandEvidenceOrdered: true,
        commandEvidenceGreen: true,
        commandMetadataOk: true,
        documentationSummaryOk: true,
        riskSummaryOk: true,
        rollbackSummaryOk: true,
        deliveryCandidateBoundaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "start production release policy hardening",
    });
  });

  it("fails closed when the referenced handoff summary is not green", () => {
    const report = validateDeliveryCandidateReadiness(candidateReport(), {
      handoffSummaryReport: handoffSummaryReport({
        ok: false,
        readyForMaintainerHandoffSummary: false,
      }),
      deliveryReadyReport: deliveryReadyReport(),
    });

    expect(report).toMatchObject({
      ok: false,
      status: "handoff_summary_not_green",
      productionReady: false,
      publishingPerformed: false,
      findings: [
        expect.objectContaining({
          code: "invalid_handoff_summary",
        }),
      ],
    });
    expect(report).not.toHaveProperty("deliveryClaim");
  });

  it("fails closed when delivery readiness claims production readiness", () => {
    const report = validateDeliveryCandidateReadiness(candidateReport(), {
      handoffSummaryReport: handoffSummaryReport(),
      deliveryReadyReport: deliveryReadyReport({
        productionReady: true,
      }),
    });

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_delivery_ready",
        }),
      ]),
    );
    expect(report.readyForLocalDeliveryCandidate).toBe(false);
    expect(report.productionReady).toBe(false);
  });

  it("rejects missing command metadata and out-of-order evidence", () => {
    const invalidEvidence = commandEvidence();
    delete (invalidEvidence[2] as { tests?: number }).tests;
    invalidEvidence.reverse();

    const report = validateDeliveryCandidateReadiness(
      candidateReport({ commandEvidence: invalidEvidence }),
      {
        handoffSummaryReport: handoffSummaryReport(),
        deliveryReadyReport: deliveryReadyReport(),
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

  it("rejects candidate reports that allow package builds or production claims", () => {
    const report = validateDeliveryCandidateReadiness(
      candidateReport({
        deliveryCandidateBoundary: {
          candidateOnly: true,
          commandsExecutedByChecker: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          tagCreated: false,
          packageBuilt: true,
          uploadPerformed: false,
          productionReady: false,
          productionReadinessClaimed: true,
        },
      }),
      {
        handoffSummaryReport: handoffSummaryReport(),
        deliveryReadyReport: deliveryReadyReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      productionReady: false,
      findings: [
        expect.objectContaining({
          code: "delivery_candidate_boundary_breached",
        }),
      ],
    });
  });
});
