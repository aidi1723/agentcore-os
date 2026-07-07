import { describe, expect, it } from "vitest";

import {
  PRODUCTION_RELEASE_COMPLETION_EVIDENCE_CHECK_COMMAND,
  validateProductionReleaseCompletionEvidence,
} from "@/lib/executor/playbooks/production-release-completion-evidence";

const releaseExecutionApprovalPath =
  "docs/release-execution-approvals/example-release-execution-approval-boundary.json";

function releaseExecutionApprovalReport(overrides = {}) {
  return {
    ok: true,
    readyForManualReleaseExecutionDecisionReview: true,
    releaseExecutionApprovalClaim:
      "release_execution_approval_boundary_defined",
    approvalBoundaryOnly: true,
    productionReady: false,
    publishingPerformed: false,
    ...overrides,
  };
}

function actionEvidence(
  action: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    action,
    performed: true,
    ok: true,
    executedBy: "release-operator@example.com",
    executedAt: "2026-07-08T10:00:00Z",
    commandOrProcedure: `manual ${action} execution procedure`,
    evidenceRef: `release-evidence://${action}/2026-07-08`,
    rollbackAvailable: true,
    monitoringLinked: true,
    ...overrides,
  };
}

function releaseActionEvidence(overrides: Record<string, unknown> = {}) {
  return {
    packageBuild: actionEvidence("packageBuild"),
    tagCreation: actionEvidence("tagCreation"),
    artifactUpload: actionEvidence("artifactUpload"),
    deployment: actionEvidence("deployment"),
    externalWrites: actionEvidence("externalWrites"),
    productionVerification: actionEvidence("productionVerification"),
    ...overrides,
  };
}

function exampleActionEvidence() {
  return releaseActionEvidence({
    packageBuild: actionEvidence("packageBuild", { performed: false, ok: false }),
    tagCreation: actionEvidence("tagCreation", { performed: false, ok: false }),
    artifactUpload: actionEvidence("artifactUpload", {
      performed: false,
      ok: false,
    }),
    deployment: actionEvidence("deployment", { performed: false, ok: false }),
    externalWrites: actionEvidence("externalWrites", {
      performed: false,
      ok: false,
    }),
    productionVerification: actionEvidence("productionVerification", {
      performed: false,
      ok: false,
    }),
  });
}

function completionEvidence(overrides: Record<string, unknown> = {}) {
  return {
    evidenceId: "production-release-completion-evidence-2026-07-08",
    releaseExecutionApprovalPath,
    owner: {
      id: "agentcore-release-operators",
      name: "AgentCore Release Operators",
      role: "production_release_completion_evidence_reviewer",
    },
    recordedAt: "2026-07-08T11:00:00Z",
    targetVersion: "1.3.0",
    evidenceScope: "production_release_completion_evidence",
    evidenceMode: "operator_recorded_actual_execution",
    releaseExecutionApprovalResult: {
      ok: true,
      approvalBoundaryOnly: true,
      releaseExecutionApprovalClaim:
        "release_execution_approval_boundary_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    operatorExecutionSummary: {
      executedBy: "release-operator@example.com",
      executionWindow: "2026-07-08T10:00:00Z/2026-07-08T11:00:00Z",
      changeTicket: "REL-2026-07-08-001",
      allActionsCompleted: true,
      noUnauthorizedActions: true,
    },
    releaseActionEvidence: releaseActionEvidence(),
    credentialUseEvidence: {
      credentialsUsedByOperator: true,
      checkerUsedCredentials: false,
      credentialApprovalRef: "approval://release-credentials/2026-07-08",
      credentialScope: "release-actions-only",
      secretMaterialRecorded: false,
      redactionPolicyApplied: true,
    },
    postExecutionVerification: {
      performed: true,
      ok: true,
      verifiedBy: "release-verifier@example.com",
      verifiedAt: "2026-07-08T11:10:00Z",
      evidenceRef: "release-evidence://production-verification/2026-07-08",
      acceptanceCriteriaMet: true,
    },
    monitoringEvidence: {
      dashboardLinked: true,
      alertingConfirmed: true,
      monitoringOwner: "release-monitor@example.com",
      observationWindow: "2026-07-08T11:10:00Z/2026-07-08T12:10:00Z",
    },
    rollbackEvidence: {
      rollbackPlanLinked: true,
      rollbackOwner: "release-rollback@example.com",
      rollbackWindowDeclared: true,
      rollbackNotRequiredReason: "Production verification passed.",
    },
    auditTrail: {
      immutableEvidenceRefs: [
        "release-evidence://packageBuild/2026-07-08",
        "release-evidence://production-verification/2026-07-08",
      ],
      operatorNotesRecorded: true,
      reviewerNotesRecorded: true,
    },
    completionBoundary: {
      completionEvidenceOnly: true,
      checkerExecutedReleaseActions: false,
      checkerUsedCredentials: false,
      checkerPerformedExternalWrites: false,
      checkerDeployed: false,
      checkerCreatedTags: false,
      checkerUploadedArtifacts: false,
      checkerBuiltPackages: false,
      checkerRanProductionVerification: false,
    },
    completionStatus: "operator_recorded_actual_execution_complete",
    ...overrides,
  };
}

describe("validateProductionReleaseCompletionEvidence", () => {
  it("validates schema-only example evidence without claiming production completion", () => {
    const report = validateProductionReleaseCompletionEvidence(
      completionEvidence({
        evidenceMode: "example_schema_only",
        operatorExecutionSummary: {
          executedBy: "example-only",
          executionWindow: "example-only",
          changeTicket: "example-only",
          allActionsCompleted: false,
          noUnauthorizedActions: true,
        },
        releaseActionEvidence: exampleActionEvidence(),
        credentialUseEvidence: {
          credentialsUsedByOperator: false,
          checkerUsedCredentials: false,
          credentialApprovalRef: "example-only",
          credentialScope: "example-only",
          secretMaterialRecorded: false,
          redactionPolicyApplied: true,
        },
        postExecutionVerification: {
          performed: false,
          ok: false,
          verifiedBy: "example-only",
          verifiedAt: "2026-07-08T11:10:00Z",
          evidenceRef: "example-only",
          acceptanceCriteriaMet: false,
        },
        monitoringEvidence: {
          dashboardLinked: false,
          alertingConfirmed: false,
          monitoringOwner: "example-only",
          observationWindow: "example-only",
        },
        rollbackEvidence: {
          rollbackPlanLinked: true,
          rollbackOwner: "example-only",
          rollbackWindowDeclared: true,
          rollbackNotRequiredReason: "Example evidence only.",
        },
        completionStatus: "example_schema_only",
      }),
      {
        evidencePath:
          "docs/release-completion-evidence/example-production-release-completion-evidence.json",
        releaseExecutionApprovalReport: releaseExecutionApprovalReport(),
      },
    );

    expect(report).toMatchObject({
      ok: true,
      command: PRODUCTION_RELEASE_COMPLETION_EVIDENCE_CHECK_COMMAND,
      status: "production_release_completion_evidence_schema_ready",
      completionEvidenceOnly: true,
      schemaExampleOnly: true,
      productionReleaseCompleted: false,
      productionReady: false,
      publishingPerformed: false,
      checkerExecutedReleaseActions: false,
      checkerUsedCredentials: false,
      findings: [],
    });
  });

  it("validates actual operator evidence and reports production completion", () => {
    const report = validateProductionReleaseCompletionEvidence(
      completionEvidence(),
      {
        releaseExecutionApprovalReport: releaseExecutionApprovalReport(),
      },
    );

    expect(report).toMatchObject({
      ok: true,
      status: "production_release_completed_by_operator_evidence",
      releaseCompletionClaim:
        "production_release_completed_by_operator_evidence",
      completionEvidenceOnly: true,
      schemaExampleOnly: false,
      productionReleaseCompleted: true,
      productionReady: true,
      publishingPerformed: true,
      checkerExecutedReleaseActions: false,
      checkerUsedCredentials: false,
      checks: {
        releaseExecutionApprovalOk: true,
        actualActionEvidenceOk: true,
        credentialUseEvidenceOk: true,
        postExecutionVerificationOk: true,
        monitoringEvidenceOk: true,
        rollbackEvidenceOk: true,
        auditTrailOk: true,
        completionBoundaryOk: true,
      },
      findings: [],
    });
  });

  it("fails closed when release execution approval evidence is not green", () => {
    const report = validateProductionReleaseCompletionEvidence(
      completionEvidence(),
      {
        releaseExecutionApprovalReport: releaseExecutionApprovalReport({
          ok: false,
          readyForManualReleaseExecutionDecisionReview: false,
        }),
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "release_execution_approval_not_green",
      productionReleaseCompleted: false,
      productionReady: false,
      publishingPerformed: false,
    });
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_release_execution_approval" }),
    );
  });

  it("rejects example evidence that claims performed production actions", () => {
    const report = validateProductionReleaseCompletionEvidence(
      completionEvidence({
        evidenceMode: "example_schema_only",
        completionStatus: "example_schema_only",
      }),
      {
        releaseExecutionApprovalReport: releaseExecutionApprovalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "example_evidence_over_claimed" }),
    );
  });

  it("rejects actual evidence when any required release action is missing", () => {
    const report = validateProductionReleaseCompletionEvidence(
      completionEvidence({
        releaseActionEvidence: releaseActionEvidence({
          deployment: actionEvidence("deployment", {
            performed: false,
            ok: false,
          }),
        }),
      }),
      {
        releaseExecutionApprovalReport: releaseExecutionApprovalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "release_action_evidence_missing" }),
    );
  });
});
