import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND,
  validatePlaybookLifecycleMutationApproval,
} from "@/lib/executor/playbooks/lifecycle-mutation-approval";

const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";

function readinessReport(overrides = {}) {
  return {
    ok: true,
    command: "playbook:lifecycle:maintenance:ready",
    evidencePath,
    readyForLifecycleMaintenance: true,
    productionReady: false,
    publishingPerformed: false,
    readinessOnly: true,
    status: "ready_for_lifecycle_maintenance",
    nextCommand: "npm run trace:fixtures --silent",
    ...overrides,
  };
}

function approvalReceipt(overrides = {}) {
  return {
    approvalId: "approval-sales-pipeline-v1-review",
    evidencePath,
    approver: "agentcore-runtime-maintainers",
    approvedAt: "2026-07-07T03:10:00Z",
    decision: "approved",
    approvalScope: "playbook_lifecycle_mutation",
    readiness: {
      command:
        `npm run playbook:lifecycle:maintenance:ready -- --evidence ${evidencePath}`,
      status: "ready_for_lifecycle_maintenance",
      readyForLifecycleMaintenance: true,
      productionReady: false,
      publishingPerformed: false,
      readinessOnly: true,
    },
    mutationBoundary: {
      mutationApproved: true,
      executionPerformed: false,
      fixtureRefreshPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      allowedTargets: ["registered_playbook_contract"],
    },
    ...overrides,
  };
}

describe("validatePlaybookLifecycleMutationApproval", () => {
  it("accepts an approved receipt when current readiness is green", () => {
    const report = validatePlaybookLifecycleMutationApproval(approvalReceipt(), {
      approvalPath:
        "docs/playbook-lifecycle-mutation-approvals/example-version-update-approval.json",
      currentReadinessReport: readinessReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      approvalOnly: true,
      approvedForLifecycleMutation: true,
      status: "approved_for_lifecycle_mutation",
      approval: {
        approvalId: "approval-sales-pipeline-v1-review",
        approver: "agentcore-runtime-maintainers",
      },
      checks: {
        currentReadinessGreen: true,
        embeddedReadinessBoundaryOk: true,
        mutationBoundaryOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when the decision is not approved", () => {
    const report = validatePlaybookLifecycleMutationApproval(
      approvalReceipt({ decision: "pending" }),
      {
        currentReadinessReport: readinessReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      approvedForLifecycleMutation: false,
      status: "approval_not_valid",
      findings: [
        expect.objectContaining({
          code: "invalid_approval_decision",
          field: "decision",
        }),
      ],
    });
  });

  it("fails closed when current maintenance readiness is not green", () => {
    const report = validatePlaybookLifecycleMutationApproval(approvalReceipt(), {
      currentReadinessReport: readinessReport({
        ok: false,
        readyForLifecycleMaintenance: false,
        status: "evidence_not_ready",
      }),
    });

    expect(report).toMatchObject({
      ok: false,
      approvedForLifecycleMutation: false,
      status: "readiness_not_green",
      findings: [
        expect.objectContaining({
          code: "current_readiness_not_green",
        }),
      ],
    });
  });

  it("fails closed when mutation boundary says execution already happened", () => {
    const report = validatePlaybookLifecycleMutationApproval(
      approvalReceipt({
        mutationBoundary: {
          mutationApproved: true,
          executionPerformed: true,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          allowedTargets: ["registered_playbook_contract"],
        },
      }),
      {
        currentReadinessReport: readinessReport(),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      approvedForLifecycleMutation: false,
      status: "mutation_boundary_breached",
      findings: [
        expect.objectContaining({
          code: "mutation_boundary_breached",
          field: "mutationBoundary.executionPerformed",
        }),
      ],
    });
  });
});
