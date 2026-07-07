export const RELEASE_EXECUTION_APPROVAL_CHECK_COMMAND =
  "release:execution-approval:check";

export type ReleaseExecutionApprovalCommandEvidence = {
  command: string;
  ok: boolean;
  exitCode: number;
  recordedAt: string;
  gate?: string;
  testFiles?: number;
  tests?: number;
  warningCount?: number;
  knownWarnings?: string[];
};

export type ReleaseExecutionApprovalFinding = {
  code:
    | "invalid_approval_shape"
    | "invalid_production_verification_gate"
    | "invalid_owner_identity"
    | "invalid_approval_scope"
    | "invalid_approval_expiry"
    | "execution_readiness_review_missing"
    | "operator_approval_requirements_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "release_action_authorization_missing"
    | "release_action_authorization_over_authorized"
    | "credential_boundary_breached"
    | "approval_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateReleaseExecutionApprovalBoundaryOptions = {
  approvalPath?: string;
  productionVerificationGateReport: GateReport;
};

const RELEASE_ACTIONS = [
  "packageBuild",
  "tagCreation",
  "artifactUpload",
  "deployment",
  "externalWrites",
  "productionVerification",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validDate(value: unknown) {
  if (!hasNonEmptyString(value)) return Number.NaN;
  return Date.parse(value);
}

function asCommandEvidence(
  value: unknown,
): ReleaseExecutionApprovalCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ReleaseExecutionApprovalCommandEvidence => {
      if (!isRecord(item)) return false;
      return (
        typeof item.command === "string" &&
        typeof item.ok === "boolean" &&
        typeof item.exitCode === "number" &&
        typeof item.recordedAt === "string"
      );
    },
  );
}

function expectedCommands(productionVerificationGatePath: string) {
  return [
    `npm run release:production-verification:gate:check -- --gate ${productionVerificationGatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ReleaseExecutionApprovalCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ReleaseExecutionApprovalCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  approvalId: string,
  field: string,
): ReleaseExecutionApprovalFinding {
  return {
    code: "invalid_approval_shape",
    severity: "error",
    field,
    message: `Release execution approval boundary ${approvalId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ReleaseExecutionApprovalFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_production_verification_gate")) {
    return "production_verification_gate_not_green";
  }
  if (findings.length > 0) {
    return "release_execution_approval_boundary_not_ready";
  }
  return "release_execution_approval_boundary_ready";
}

function hasValidReleaseActionAuthorization(
  authorizations: Record<string, unknown>,
) {
  return RELEASE_ACTIONS.every((name) => {
    const authorization = authorizations[name];
    if (!isRecord(authorization)) return false;
    return (
      authorization.decision === "blocked_until_manual_operator_execution" &&
      authorization.approvalCapturedByBoundary === false &&
      authorization.executionPerformed === false &&
      authorization.credentialUseAllowed === false &&
      hasNonEmptyString(authorization.owner) &&
      asStringArray(authorization.notes).length > 0
    );
  });
}

function releaseActionOverAuthorized(authorizations: Record<string, unknown>) {
  return RELEASE_ACTIONS.some((name) => {
    const authorization = authorizations[name];
    return (
      isRecord(authorization) &&
      (authorization.decision !== "blocked_until_manual_operator_execution" ||
        authorization.approvalCapturedByBoundary !== false ||
        authorization.executionPerformed !== false ||
        authorization.credentialUseAllowed !== false)
    );
  });
}

export function validateReleaseExecutionApprovalBoundary(
  approval: unknown,
  options: ValidateReleaseExecutionApprovalBoundaryOptions,
) {
  const record = isRecord(approval) ? approval : {};
  const approvalId = asString(record.approvalId) || "unknown";
  const productionVerificationGatePath = asString(
    record.productionVerificationGatePath,
  );
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(productionVerificationGatePath);
  const findings: ReleaseExecutionApprovalFinding[] = [];

  for (const field of [
    "approvalId",
    "productionVerificationGatePath",
    "recordedAt",
    "expiresAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(approvalId, field));
    }
  }

  const productionVerificationGateOk =
    options.productionVerificationGateReport.ok === true &&
    options.productionVerificationGateReport
      .readyForReleaseExecutionApprovalReview === true &&
    options.productionVerificationGateReport.productionVerificationClaim ===
      "production_verification_requirements_defined" &&
    options.productionVerificationGateReport.verificationOnly === true &&
    options.productionVerificationGateReport.productionReady === false &&
    options.productionVerificationGateReport.publishingPerformed === false;
  if (!productionVerificationGateOk) {
    findings.push({
      code: "invalid_production_verification_gate",
      severity: "error",
      path: productionVerificationGatePath,
      message: `Release execution approval boundary ${approvalId} requires green production verification gate evidence.`,
    });
  }

  const recordedProductionVerificationGate = isRecord(
    record.productionVerificationGateResult,
  )
    ? record.productionVerificationGateResult
    : {};
  const recordedProductionVerificationGateOk =
    recordedProductionVerificationGate.ok === true &&
    recordedProductionVerificationGate.verificationOnly === true &&
    recordedProductionVerificationGate.productionVerificationClaim ===
      "production_verification_requirements_defined" &&
    recordedProductionVerificationGate.productionReady === false &&
    recordedProductionVerificationGate.publishingPerformed === false;
  if (!recordedProductionVerificationGateOk) {
    findings.push({
      code: "invalid_production_verification_gate",
      severity: "error",
      field: "productionVerificationGateResult",
      message: `Release execution approval boundary ${approvalId} must record the production verification gate as green, verification-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "release_execution_approval_boundary_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Release execution approval boundary ${approvalId} must include owner id, name, and release_execution_approval_boundary_reviewer role.`,
    });
  }

  const approvalScopeOk =
    record.approvalScope === "release_execution_approval_boundary";
  if (!approvalScopeOk) {
    findings.push({
      code: "invalid_approval_scope",
      severity: "error",
      field: "approvalScope",
      message: `Release execution approval boundary ${approvalId} must use release_execution_approval_boundary scope.`,
    });
  }

  const recordedAtMs = validDate(record.recordedAt);
  const expiresAtMs = validDate(record.expiresAt);
  const expiryOk =
    Number.isFinite(recordedAtMs) &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs > recordedAtMs;
  if (!expiryOk) {
    findings.push({
      code: "invalid_approval_expiry",
      severity: "error",
      field: "expiresAt",
      message: `Release execution approval boundary ${approvalId} must expire after recordedAt.`,
    });
  }

  const executionReadinessReview = isRecord(record.executionReadinessReview)
    ? record.executionReadinessReview
    : {};
  const executionReadinessReviewOk =
    executionReadinessReview.packageBuildGateReviewed === true &&
    executionReadinessReview.tagCreationGateReviewed === true &&
    executionReadinessReview.artifactUploadGateReviewed === true &&
    executionReadinessReview.deploymentGateReviewed === true &&
    executionReadinessReview.externalWriteGateReviewed === true &&
    executionReadinessReview.productionVerificationGateReviewed === true &&
    executionReadinessReview.allExecutionStillBlocked === true;
  if (!executionReadinessReviewOk) {
    findings.push({
      code: "execution_readiness_review_missing",
      severity: "error",
      field: "executionReadinessReview",
      message: `Release execution approval boundary ${approvalId} must review every prior execution gate and keep execution blocked.`,
    });
  }

  const operatorApprovalRequirements = isRecord(
    record.operatorApprovalRequirements,
  )
    ? record.operatorApprovalRequirements
    : {};
  const operatorApprovalRequirementsOk =
    operatorApprovalRequirements.approverRole ===
      "release_execution_operator" &&
    operatorApprovalRequirements.twoPersonReviewRequired === true &&
    operatorApprovalRequirements.changeWindowDeclared === true &&
    operatorApprovalRequirements.rollbackOwnerDeclared === true &&
    operatorApprovalRequirements.monitoringOwnerDeclared === true &&
    operatorApprovalRequirements.credentialUseRequiresSeparateApproval ===
      true;
  if (!operatorApprovalRequirementsOk) {
    findings.push({
      code: "operator_approval_requirements_missing",
      severity: "error",
      field: "operatorApprovalRequirements",
      message: `Release execution approval boundary ${approvalId} must document final operator approval requirements.`,
    });
  }

  const commandEvidenceOrdered = orderedCommandsMatch(
    commandEvidence,
    requiredCommands,
  );
  if (!commandEvidenceOrdered) {
    findings.push({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandEvidence",
      command: requiredCommands[0],
      message: `Release execution approval boundary ${approvalId} commandEvidence must match the required commands in order.`,
    });
  }

  const commandEvidenceGreen =
    commandEvidence.length > 0 &&
    commandEvidence.every(
      (entry) =>
        entry.ok === true &&
        entry.exitCode === 0 &&
        hasNonEmptyString(entry.recordedAt),
    );
  if (!commandEvidenceGreen) {
    findings.push({
      code: "command_evidence_not_green",
      severity: "error",
      field: "commandEvidence",
      message: `Release execution approval boundary ${approvalId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const productionVerificationEntry = commandByName(
    commandEvidence,
    requiredCommands[0],
  );
  const hygieneEntry = commandByName(
    commandEvidence,
    "npm run release:hygiene:check",
  );
  const controlledRuntimeEntry = commandByName(
    commandEvidence,
    "npm run test:controlled-runtime",
  );
  const coreWorkflowEntry = commandByName(
    commandEvidence,
    "npm run test:core-workflows",
  );
  const lintEntry = commandByName(commandEvidence, "npm run lint");
  const buildEntry = commandByName(commandEvidence, "npm run build");
  const diffEntry = commandByName(commandEvidence, "git diff --check");
  const commandMetadataOk =
    productionVerificationEntry?.gate ===
      "production_verification_gate_green" &&
    hygieneEntry?.gate === "release_hygiene_green" &&
    isPositiveNumber(controlledRuntimeEntry?.testFiles) &&
    isPositiveNumber(controlledRuntimeEntry?.tests) &&
    coreWorkflowEntry?.gate === "core_workflows_green" &&
    typeof lintEntry?.warningCount === "number" &&
    Array.isArray(lintEntry?.knownWarnings) &&
    typeof buildEntry?.warningCount === "number" &&
    Array.isArray(buildEntry?.knownWarnings) &&
    diffEntry?.gate === "git_diff_check_green";
  if (!commandMetadataOk) {
    findings.push({
      code: "invalid_command_evidence_metadata",
      severity: "error",
      field: "commandEvidence",
      message: `Release execution approval boundary ${approvalId} commandEvidence must include production verification, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const actionAuthorization = isRecord(record.releaseActionAuthorization)
    ? record.releaseActionAuthorization
    : {};
  const releaseActionAuthorizationOk =
    hasValidReleaseActionAuthorization(actionAuthorization);
  if (!releaseActionAuthorizationOk) {
    findings.push({
      code: "release_action_authorization_missing",
      severity: "error",
      field: "releaseActionAuthorization",
      message: `Release execution approval boundary ${approvalId} must document blocked authorization for every release action.`,
    });
  }

  const releaseActionsBlocked =
    !releaseActionOverAuthorized(actionAuthorization);
  if (!releaseActionsBlocked) {
    findings.push({
      code: "release_action_authorization_over_authorized",
      severity: "error",
      field: "releaseActionAuthorization",
      message: `Release execution approval boundary ${approvalId} must not approve or record execution for any release action.`,
    });
  }

  const credentialBoundary = isRecord(record.credentialBoundary)
    ? record.credentialBoundary
    : {};
  const credentialBoundaryOk =
    credentialBoundary.credentialsRequiredForBoundary === false &&
    credentialBoundary.credentialsUsed === false &&
    credentialBoundary.credentialUseApproved === false &&
    credentialBoundary.secretMaterialRecorded === false;
  if (!credentialBoundaryOk) {
    findings.push({
      code: "credential_boundary_breached",
      severity: "error",
      field: "credentialBoundary",
      message: `Release execution approval boundary ${approvalId} must not require, use, approve, or record credentials.`,
    });
  }

  const boundary = isRecord(record.approvalBoundary)
    ? record.approvalBoundary
    : {};
  const approvalBoundaryOk =
    boundary.approvalBoundaryOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.releaseExecutionApproved === false &&
    boundary.releaseExecutionPerformed === false &&
    boundary.productionVerificationApproved === false &&
    boundary.productionVerificationExecuted === false &&
    boundary.publishingPerformed === false &&
    boundary.tagCreated === false &&
    boundary.packageBuilt === false &&
    boundary.uploadPerformed === false &&
    boundary.deploymentPerformed === false &&
    boundary.connectorCallsPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!approvalBoundaryOk) {
    findings.push({
      code: "approval_boundary_breached",
      severity: "error",
      field: "approvalBoundary",
      message: `Release execution approval boundary ${approvalId} must remain boundary-only with no release execution approval, release execution, production verification execution, connector calls, external writes, store writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "release_execution_approval_boundary_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Release execution approval boundary ${approvalId} approvalStatus must be release_execution_approval_boundary_review.`,
    });
  }

  const ok = findings.length === 0;
  const targetVersion = asString(record.targetVersion);

  return {
    ok,
    command: RELEASE_EXECUTION_APPROVAL_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    approvalBoundaryOnly: true as const,
    readyForManualReleaseExecutionDecisionReview: ok,
    ...(ok
      ? {
          releaseExecutionApprovalClaim:
            "release_execution_approval_boundary_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    approvalPath: options.approvalPath,
    productionVerificationGatePath,
    approval: {
      approvalId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      approvalScope: asString(record.approvalScope),
      targetVersion,
      expiresAt: asString(record.expiresAt),
      nextBoundary: "manual_release_execution_decision_outside_checker",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
      releaseActions: RELEASE_ACTIONS.length,
    },
    checks: {
      productionVerificationGateOk,
      recordedProductionVerificationGateOk,
      identityOk,
      approvalScopeOk,
      expiryOk,
      executionReadinessReviewOk,
      operatorApprovalRequirementsOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      releaseActionAuthorizationOk,
      releaseActionsBlocked,
      credentialBoundaryOk,
      approvalBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "manual release execution decision remains outside this checker"
      : "npm run release:execution-approval:check -- --approval <path>",
    nextAction: ok
      ? "Release execution approval requirements are defined; actual release execution, production verification execution, connector calls, external writes, store writes, credentials, and production readiness claims remain blocked until explicit human/operator action and separate post-execution evidence."
      : "Fix release execution approval boundary findings before any manual release execution decision.",
  };
}
