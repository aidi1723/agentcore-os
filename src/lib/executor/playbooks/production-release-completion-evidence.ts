export const PRODUCTION_RELEASE_COMPLETION_EVIDENCE_CHECK_COMMAND =
  "release:completion:evidence:check";

export type ProductionReleaseCompletionEvidenceFinding = {
  code:
    | "invalid_evidence_shape"
    | "invalid_release_execution_approval"
    | "invalid_owner_identity"
    | "invalid_evidence_scope"
    | "unsupported_evidence_mode"
    | "invalid_recorded_approval_result"
    | "operator_execution_summary_missing"
    | "example_evidence_over_claimed"
    | "release_action_evidence_missing"
    | "credential_use_evidence_missing"
    | "post_execution_verification_missing"
    | "monitoring_evidence_missing"
    | "rollback_evidence_missing"
    | "audit_trail_missing"
    | "completion_boundary_breached"
    | "invalid_completion_status";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateProductionReleaseCompletionEvidenceOptions = {
  evidencePath?: string;
  releaseExecutionApprovalReport: GateReport;
};

const RELEASE_ACTIONS = [
  "packageBuild",
  "tagCreation",
  "artifactUpload",
  "deployment",
  "externalWrites",
  "productionVerification",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function missingStringFinding(
  evidenceId: string,
  field: string,
): ProductionReleaseCompletionEvidenceFinding {
  return {
    code: "invalid_evidence_shape",
    severity: "error",
    field,
    message: `Production release completion evidence ${evidenceId} must include non-empty ${field}.`,
  };
}

function actionRecord(
  actions: Record<string, unknown>,
  name: (typeof RELEASE_ACTIONS)[number],
) {
  const action = actions[name];
  return isRecord(action) ? action : {};
}

function hasActionShape(action: Record<string, unknown>) {
  return (
    hasNonEmptyString(action.action) &&
    hasNonEmptyString(action.executedBy) &&
    hasNonEmptyString(action.executedAt) &&
    hasNonEmptyString(action.commandOrProcedure) &&
    hasNonEmptyString(action.evidenceRef) &&
    action.rollbackAvailable === true &&
    action.monitoringLinked === true
  );
}

function actualActionEvidenceOk(actions: Record<string, unknown>) {
  return RELEASE_ACTIONS.every((name) => {
    const action = actionRecord(actions, name);
    return action.performed === true && action.ok === true && hasActionShape(action);
  });
}

function exampleActionEvidenceOk(actions: Record<string, unknown>) {
  return RELEASE_ACTIONS.every((name) => {
    const action = actionRecord(actions, name);
    return (
      action.performed === false &&
      action.ok === false &&
      hasActionShape(action)
    );
  });
}

function exampleOverClaimed(actions: Record<string, unknown>) {
  return RELEASE_ACTIONS.some((name) => {
    const action = actionRecord(actions, name);
    return action.performed === true || action.ok === true;
  });
}

function statusFromFindings(
  findings: ProductionReleaseCompletionEvidenceFinding[],
  evidenceMode: string,
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_release_execution_approval")) {
    return "release_execution_approval_not_green";
  }
  if (findings.length > 0) {
    return "production_release_completion_evidence_not_ready";
  }
  if (evidenceMode === "operator_recorded_actual_execution") {
    return "production_release_completed_by_operator_evidence";
  }
  return "production_release_completion_evidence_schema_ready";
}

export function validateProductionReleaseCompletionEvidence(
  evidence: unknown,
  options: ValidateProductionReleaseCompletionEvidenceOptions,
) {
  const record = isRecord(evidence) ? evidence : {};
  const evidenceId = asString(record.evidenceId) || "unknown";
  const releaseExecutionApprovalPath = asString(
    record.releaseExecutionApprovalPath,
  );
  const evidenceMode = asString(record.evidenceMode);
  const releaseActionEvidence = isRecord(record.releaseActionEvidence)
    ? record.releaseActionEvidence
    : {};
  const findings: ProductionReleaseCompletionEvidenceFinding[] = [];

  for (const field of [
    "evidenceId",
    "releaseExecutionApprovalPath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(evidenceId, field));
    }
  }

  const releaseExecutionApprovalOk =
    options.releaseExecutionApprovalReport.ok === true &&
    options.releaseExecutionApprovalReport
      .readyForManualReleaseExecutionDecisionReview === true &&
    options.releaseExecutionApprovalReport.releaseExecutionApprovalClaim ===
      "release_execution_approval_boundary_defined" &&
    options.releaseExecutionApprovalReport.approvalBoundaryOnly === true &&
    options.releaseExecutionApprovalReport.productionReady === false &&
    options.releaseExecutionApprovalReport.publishingPerformed === false;
  if (!releaseExecutionApprovalOk) {
    findings.push({
      code: "invalid_release_execution_approval",
      severity: "error",
      path: releaseExecutionApprovalPath,
      message: `Production release completion evidence ${evidenceId} requires green release execution approval boundary evidence.`,
    });
  }

  const recordedApproval = isRecord(record.releaseExecutionApprovalResult)
    ? record.releaseExecutionApprovalResult
    : {};
  const recordedApprovalOk =
    recordedApproval.ok === true &&
    recordedApproval.approvalBoundaryOnly === true &&
    recordedApproval.releaseExecutionApprovalClaim ===
      "release_execution_approval_boundary_defined" &&
    recordedApproval.productionReady === false &&
    recordedApproval.publishingPerformed === false;
  if (!recordedApprovalOk) {
    findings.push({
      code: "invalid_recorded_approval_result",
      severity: "error",
      field: "releaseExecutionApprovalResult",
      message: `Production release completion evidence ${evidenceId} must record the release execution approval boundary as green and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "production_release_completion_evidence_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Production release completion evidence ${evidenceId} must include owner id, name, and production_release_completion_evidence_reviewer role.`,
    });
  }

  const evidenceScopeOk =
    record.evidenceScope === "production_release_completion_evidence";
  if (!evidenceScopeOk) {
    findings.push({
      code: "invalid_evidence_scope",
      severity: "error",
      field: "evidenceScope",
      message: `Production release completion evidence ${evidenceId} must use production_release_completion_evidence scope.`,
    });
  }

  const supportedEvidenceMode =
    evidenceMode === "example_schema_only" ||
    evidenceMode === "operator_recorded_actual_execution";
  if (!supportedEvidenceMode) {
    findings.push({
      code: "unsupported_evidence_mode",
      severity: "error",
      field: "evidenceMode",
      message: `Production release completion evidence ${evidenceId} must use example_schema_only or operator_recorded_actual_execution mode.`,
    });
  }

  const operatorExecutionSummary = isRecord(record.operatorExecutionSummary)
    ? record.operatorExecutionSummary
    : {};
  const operatorExecutionSummaryOk =
    hasNonEmptyString(operatorExecutionSummary.executedBy) &&
    hasNonEmptyString(operatorExecutionSummary.executionWindow) &&
    hasNonEmptyString(operatorExecutionSummary.changeTicket) &&
    operatorExecutionSummary.noUnauthorizedActions === true &&
    (evidenceMode === "example_schema_only"
      ? operatorExecutionSummary.allActionsCompleted === false
      : operatorExecutionSummary.allActionsCompleted === true);
  if (!operatorExecutionSummaryOk) {
    findings.push({
      code: "operator_execution_summary_missing",
      severity: "error",
      field: "operatorExecutionSummary",
      message: `Production release completion evidence ${evidenceId} must include an operator execution summary matching the evidence mode.`,
    });
  }

  const exampleActionsOk = exampleActionEvidenceOk(releaseActionEvidence);
  const actualActionsOk = actualActionEvidenceOk(releaseActionEvidence);
  if (evidenceMode === "example_schema_only" && exampleOverClaimed(releaseActionEvidence)) {
    findings.push({
      code: "example_evidence_over_claimed",
      severity: "error",
      field: "releaseActionEvidence",
      message: `Production release completion evidence ${evidenceId} is schema-only and must not claim performed production release actions.`,
    });
  }
  if (
    evidenceMode === "example_schema_only" &&
    !exampleOverClaimed(releaseActionEvidence) &&
    !exampleActionsOk
  ) {
    findings.push({
      code: "release_action_evidence_missing",
      severity: "error",
      field: "releaseActionEvidence",
      message: `Production release completion evidence ${evidenceId} schema example must describe every release action as unperformed.`,
    });
  }
  if (evidenceMode === "operator_recorded_actual_execution" && !actualActionsOk) {
    findings.push({
      code: "release_action_evidence_missing",
      severity: "error",
      field: "releaseActionEvidence",
      message: `Production release completion evidence ${evidenceId} actual mode must record every release action as performed and green.`,
    });
  }

  const credentialUseEvidence = isRecord(record.credentialUseEvidence)
    ? record.credentialUseEvidence
    : {};
  const credentialUseEvidenceOk =
    credentialUseEvidence.checkerUsedCredentials === false &&
    credentialUseEvidence.secretMaterialRecorded === false &&
    credentialUseEvidence.redactionPolicyApplied === true &&
    hasNonEmptyString(credentialUseEvidence.credentialApprovalRef) &&
    hasNonEmptyString(credentialUseEvidence.credentialScope) &&
    (evidenceMode === "example_schema_only"
      ? credentialUseEvidence.credentialsUsedByOperator === false
      : typeof credentialUseEvidence.credentialsUsedByOperator === "boolean");
  if (!credentialUseEvidenceOk) {
    findings.push({
      code: "credential_use_evidence_missing",
      severity: "error",
      field: "credentialUseEvidence",
      message: `Production release completion evidence ${evidenceId} must record credential use, redaction, and checker no-credential boundaries.`,
    });
  }

  const postExecutionVerification = isRecord(record.postExecutionVerification)
    ? record.postExecutionVerification
    : {};
  const postExecutionVerificationOk =
    hasNonEmptyString(postExecutionVerification.verifiedBy) &&
    hasNonEmptyString(postExecutionVerification.verifiedAt) &&
    hasNonEmptyString(postExecutionVerification.evidenceRef) &&
    (evidenceMode === "example_schema_only"
      ? postExecutionVerification.performed === false &&
        postExecutionVerification.ok === false &&
        postExecutionVerification.acceptanceCriteriaMet === false
      : postExecutionVerification.performed === true &&
        postExecutionVerification.ok === true &&
        postExecutionVerification.acceptanceCriteriaMet === true);
  if (!postExecutionVerificationOk) {
    findings.push({
      code: "post_execution_verification_missing",
      severity: "error",
      field: "postExecutionVerification",
      message: `Production release completion evidence ${evidenceId} must include post-execution verification evidence matching the evidence mode.`,
    });
  }

  const monitoringEvidence = isRecord(record.monitoringEvidence)
    ? record.monitoringEvidence
    : {};
  const monitoringEvidenceOk =
    hasNonEmptyString(monitoringEvidence.monitoringOwner) &&
    hasNonEmptyString(monitoringEvidence.observationWindow) &&
    (evidenceMode === "example_schema_only"
      ? monitoringEvidence.dashboardLinked === false &&
        monitoringEvidence.alertingConfirmed === false
      : monitoringEvidence.dashboardLinked === true &&
        monitoringEvidence.alertingConfirmed === true);
  if (!monitoringEvidenceOk) {
    findings.push({
      code: "monitoring_evidence_missing",
      severity: "error",
      field: "monitoringEvidence",
      message: `Production release completion evidence ${evidenceId} must include monitoring evidence matching the evidence mode.`,
    });
  }

  const rollbackEvidence = isRecord(record.rollbackEvidence)
    ? record.rollbackEvidence
    : {};
  const rollbackEvidenceOk =
    rollbackEvidence.rollbackPlanLinked === true &&
    rollbackEvidence.rollbackWindowDeclared === true &&
    hasNonEmptyString(rollbackEvidence.rollbackOwner) &&
    hasNonEmptyString(rollbackEvidence.rollbackNotRequiredReason);
  if (!rollbackEvidenceOk) {
    findings.push({
      code: "rollback_evidence_missing",
      severity: "error",
      field: "rollbackEvidence",
      message: `Production release completion evidence ${evidenceId} must include rollback plan, owner, window, and notes.`,
    });
  }

  const auditTrail = isRecord(record.auditTrail) ? record.auditTrail : {};
  const auditTrailOk =
    asStringArray(auditTrail.immutableEvidenceRefs).length > 0 &&
    auditTrail.operatorNotesRecorded === true &&
    auditTrail.reviewerNotesRecorded === true;
  if (!auditTrailOk) {
    findings.push({
      code: "audit_trail_missing",
      severity: "error",
      field: "auditTrail",
      message: `Production release completion evidence ${evidenceId} must include immutable evidence refs and operator/reviewer notes.`,
    });
  }

  const completionBoundary = isRecord(record.completionBoundary)
    ? record.completionBoundary
    : {};
  const completionBoundaryOk =
    completionBoundary.completionEvidenceOnly === true &&
    completionBoundary.checkerExecutedReleaseActions === false &&
    completionBoundary.checkerUsedCredentials === false &&
    completionBoundary.checkerPerformedExternalWrites === false &&
    completionBoundary.checkerDeployed === false &&
    completionBoundary.checkerCreatedTags === false &&
    completionBoundary.checkerUploadedArtifacts === false &&
    completionBoundary.checkerBuiltPackages === false &&
    completionBoundary.checkerRanProductionVerification === false;
  if (!completionBoundaryOk) {
    findings.push({
      code: "completion_boundary_breached",
      severity: "error",
      field: "completionBoundary",
      message: `Production release completion evidence ${evidenceId} must state that the checker did not execute release actions, use credentials, or perform production effects.`,
    });
  }

  const completionStatusOk =
    evidenceMode === "example_schema_only"
      ? record.completionStatus === "example_schema_only"
      : record.completionStatus ===
        "operator_recorded_actual_execution_complete";
  if (!completionStatusOk) {
    findings.push({
      code: "invalid_completion_status",
      severity: "error",
      field: "completionStatus",
      message: `Production release completion evidence ${evidenceId} completionStatus must match evidenceMode.`,
    });
  }

  const ok = findings.length === 0;
  const actualCompletion =
    ok && evidenceMode === "operator_recorded_actual_execution";
  const schemaExampleOnly = evidenceMode === "example_schema_only";

  return {
    ok,
    command: PRODUCTION_RELEASE_COMPLETION_EVIDENCE_CHECK_COMMAND,
    status: statusFromFindings(findings, evidenceMode),
    completionEvidenceOnly: true as const,
    schemaExampleOnly,
    productionReleaseCompleted: actualCompletion,
    productionReady: actualCompletion,
    publishingPerformed: actualCompletion,
    checkerExecutedReleaseActions: false as const,
    checkerUsedCredentials: false as const,
    ...(actualCompletion
      ? {
          releaseCompletionClaim:
            "production_release_completed_by_operator_evidence" as const,
        }
      : {}),
    evidencePath: options.evidencePath,
    releaseExecutionApprovalPath,
    evidence: {
      evidenceId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      evidenceScope: asString(record.evidenceScope),
      evidenceMode,
      targetVersion: asString(record.targetVersion),
      completionStatus: asString(record.completionStatus),
    },
    summary: {
      findings: findings.length,
      releaseActions: RELEASE_ACTIONS.length,
      completedReleaseActions:
        evidenceMode === "operator_recorded_actual_execution" && actualActionsOk
          ? RELEASE_ACTIONS.length
          : 0,
    },
    checks: {
      releaseExecutionApprovalOk,
      recordedApprovalOk,
      identityOk,
      evidenceScopeOk,
      supportedEvidenceMode,
      operatorExecutionSummaryOk,
      exampleActionEvidenceOk: exampleActionsOk,
      actualActionEvidenceOk: actualActionsOk,
      credentialUseEvidenceOk,
      postExecutionVerificationOk,
      monitoringEvidenceOk,
      rollbackEvidenceOk,
      auditTrailOk,
      completionBoundaryOk,
      completionStatusOk,
    },
    findings,
    nextCommand: actualCompletion
      ? "release closeout can proceed from operator-recorded production evidence"
      : "replace schema-only example with operator_recorded_actual_execution evidence after manual production release execution",
    nextAction: actualCompletion
      ? "Production release completion is supported by operator-recorded evidence; the checker did not perform release actions or use credentials."
      : "Schema-only completion evidence is valid for local contract review, but it does not prove that production release actions have occurred.",
  };
}
