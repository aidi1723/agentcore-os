import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildProductionReleaseCompletionEvidenceCheckCliResult,
  parseProductionReleaseCompletionEvidenceCheckArgs,
} from "../../../scripts/release-execution/check-production-release-completion-evidence.mjs";

const releaseExecutionApprovalPath =
  "docs/release-execution-approvals/example-release-execution-approval-boundary.json";

function writeEvidenceFile(evidence: Record<string, unknown> | string) {
  const cwd = mkdtempSync(
    join(tmpdir(), "agentcore-production-release-completion-evidence-"),
  );
  const evidencePath = "evidence.json";
  writeFileSync(
    join(cwd, evidencePath),
    typeof evidence === "string" ? evidence : JSON.stringify(evidence),
    "utf8",
  );
  return { cwd, evidencePath };
}

function actionEvidence(action: string) {
  return {
    action,
    performed: false,
    ok: false,
    executedBy: "example-only",
    executedAt: "2026-07-08T10:00:00Z",
    commandOrProcedure: `example ${action} procedure`,
    evidenceRef: "example-only",
    rollbackAvailable: true,
    monitoringLinked: true,
  };
}

function validExampleEvidence() {
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
    evidenceMode: "example_schema_only",
    releaseExecutionApprovalResult: {
      ok: true,
      approvalBoundaryOnly: true,
      releaseExecutionApprovalClaim:
        "release_execution_approval_boundary_defined",
      productionReady: false,
      publishingPerformed: false,
    },
    operatorExecutionSummary: {
      executedBy: "example-only",
      executionWindow: "example-only",
      changeTicket: "example-only",
      allActionsCompleted: false,
      noUnauthorizedActions: true,
    },
    releaseActionEvidence: {
      packageBuild: actionEvidence("packageBuild"),
      tagCreation: actionEvidence("tagCreation"),
      artifactUpload: actionEvidence("artifactUpload"),
      deployment: actionEvidence("deployment"),
      externalWrites: actionEvidence("externalWrites"),
      productionVerification: actionEvidence("productionVerification"),
    },
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
    auditTrail: {
      immutableEvidenceRefs: ["example-only"],
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
    completionStatus: "example_schema_only",
  };
}

function okReleaseExecutionApprovalResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForManualReleaseExecutionDecisionReview: true,
      releaseExecutionApprovalClaim:
        "release_execution_approval_boundary_defined",
      approvalBoundaryOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("production release completion evidence check script", () => {
  it("parses evidence and compact flags", () => {
    expect(
      parseProductionReleaseCompletionEvidenceCheckArgs([
        "--evidence",
        "docs/release-completion-evidence/example-production-release-completion-evidence.json",
        "--compact",
      ]),
    ).toEqual({
      evidencePath:
        "docs/release-completion-evidence/example-production-release-completion-evidence.json",
      pretty: false,
    });
  });

  it("requires an evidence path", () => {
    expect(() =>
      parseProductionReleaseCompletionEvidenceCheckArgs([]),
    ).toThrow("--evidence <path> is required");
  });

  it("builds a green schema-only evidence result from a valid file", () => {
    const { cwd, evidencePath } = writeEvidenceFile(validExampleEvidence());
    const result = buildProductionReleaseCompletionEvidenceCheckCliResult({
      cwd,
      evidencePath,
      pretty: false,
      buildReleaseExecutionApprovalResult: okReleaseExecutionApprovalResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:completion:evidence:check",
      schemaExampleOnly: true,
      productionReleaseCompleted: false,
      productionReady: false,
      publishingPerformed: false,
      completionEvidenceOnly: true,
    });
  });

  it("fails when the reused release execution approval boundary is not green", () => {
    const { cwd, evidencePath } = writeEvidenceFile(validExampleEvidence());
    const result = buildProductionReleaseCompletionEvidenceCheckCliResult({
      cwd,
      evidencePath,
      pretty: false,
      buildReleaseExecutionApprovalResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          approvalBoundaryOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_release_execution_approval" }),
    );
  });

  it("reports invalid JSON clearly", () => {
    const { cwd, evidencePath } = writeEvidenceFile("{nope");

    expect(() =>
      buildProductionReleaseCompletionEvidenceCheckCliResult({
        cwd,
        evidencePath,
        buildReleaseExecutionApprovalResult: okReleaseExecutionApprovalResult,
      }),
    ).toThrow("production release completion evidence file is not valid JSON");
  });
});
