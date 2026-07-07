export const PRODUCTION_VERIFICATION_GATE_CHECK_COMMAND =
  "release:production-verification:gate:check";

export type ProductionVerificationGateCommandEvidence = {
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

export type ProductionVerificationGateFinding = {
  code:
    | "invalid_gate_shape"
    | "invalid_external_write_gate"
    | "invalid_owner_identity"
    | "invalid_release_action"
    | "verification_plan_missing"
    | "post_action_checks_missing"
    | "monitoring_readiness_missing"
    | "incident_rollback_readiness_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "credential_boundary_breached"
    | "verification_decision_over_authorized"
    | "verification_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateProductionVerificationGateOptions = {
  gatePath?: string;
  externalWriteGateReport: GateReport;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asCommandEvidence(
  value: unknown,
): ProductionVerificationGateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ProductionVerificationGateCommandEvidence => {
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

function expectedCommands(externalWriteGatePath: string) {
  return [
    `npm run release:external-write:gate:check -- --gate ${externalWriteGatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ProductionVerificationGateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ProductionVerificationGateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  gateId: string,
  field: string,
): ProductionVerificationGateFinding {
  return {
    code: "invalid_gate_shape",
    severity: "error",
    field,
    message: `Production verification gate ${gateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ProductionVerificationGateFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_external_write_gate")) {
    return "external_write_gate_not_green";
  }
  if (findings.length > 0) {
    return "production_verification_gate_not_ready";
  }
  return "production_verification_gate_ready";
}

export function validateProductionVerificationGate(
  gate: unknown,
  options: ValidateProductionVerificationGateOptions,
) {
  const record = isRecord(gate) ? gate : {};
  const gateId = asString(record.gateId) || "unknown";
  const externalWriteGatePath = asString(record.externalWriteGatePath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(externalWriteGatePath);
  const findings: ProductionVerificationGateFinding[] = [];

  for (const field of [
    "gateId",
    "externalWriteGatePath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(gateId, field));
    }
  }

  const externalWriteGateOk =
    options.externalWriteGateReport.ok === true &&
    options.externalWriteGateReport.readyForExternalWriteOperatorReview ===
      true &&
    options.externalWriteGateReport.externalWriteGateClaim ===
      "external_write_execution_gate_defined" &&
    options.externalWriteGateReport.gateOnly === true &&
    options.externalWriteGateReport.productionReady === false &&
    options.externalWriteGateReport.publishingPerformed === false;
  if (!externalWriteGateOk) {
    findings.push({
      code: "invalid_external_write_gate",
      severity: "error",
      path: externalWriteGatePath,
      message: `Production verification gate ${gateId} requires green external-write gate evidence.`,
    });
  }

  const recordedExternalWriteGate = isRecord(record.externalWriteGateResult)
    ? record.externalWriteGateResult
    : {};
  const recordedExternalWriteGateOk =
    recordedExternalWriteGate.ok === true &&
    recordedExternalWriteGate.gateOnly === true &&
    recordedExternalWriteGate.externalWriteGateClaim ===
      "external_write_execution_gate_defined" &&
    recordedExternalWriteGate.productionReady === false &&
    recordedExternalWriteGate.publishingPerformed === false;
  if (!recordedExternalWriteGateOk) {
    findings.push({
      code: "invalid_external_write_gate",
      severity: "error",
      field: "externalWriteGateResult",
      message: `Production verification gate ${gateId} must record the external-write gate as green, gate-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "production_verification_gate_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Production verification gate ${gateId} must include owner id, name, and production_verification_gate_reviewer role.`,
    });
  }

  const releaseActionOk = record.releaseAction === "production_verification";
  if (!releaseActionOk) {
    findings.push({
      code: "invalid_release_action",
      severity: "error",
      field: "releaseAction",
      message: `Production verification gate ${gateId} releaseAction must be production_verification.`,
    });
  }

  const verificationPlan = isRecord(record.verificationPlan)
    ? record.verificationPlan
    : {};
  const targetVersion = asString(record.targetVersion);
  const expectedVersionMarker = `v${targetVersion}`;
  const verificationPlanOk =
    hasNonEmptyString(verificationPlan.verificationEnvironment) &&
    hasNonEmptyString(verificationPlan.verificationWindow) &&
    asString(verificationPlan.verificationCommandIntent).includes(
      expectedVersionMarker,
    ) &&
    hasNonEmptyString(verificationPlan.acceptanceCriteria) &&
    verificationPlan.verificationPathPolicy ===
      "blocked_until_operator_execution_approval";
  if (!verificationPlanOk) {
    findings.push({
      code: "verification_plan_missing",
      severity: "error",
      field: "verificationPlan",
      message: `Production verification gate ${gateId} must document environment, window, versioned verification intent, acceptance criteria, and blocked verification path policy.`,
    });
  }

  const postActionChecks = isRecord(record.postActionChecks)
    ? record.postActionChecks
    : {};
  const postActionChecksOk =
    postActionChecks.deploymentHealthCheckDeclared === true &&
    postActionChecks.externalWriteVerificationDeclared === true &&
    postActionChecks.artifactAvailabilityVerificationDeclared === true &&
    postActionChecks.rollbackVerificationDeclared === true &&
    postActionChecks.checksExecutedByGate === false;
  if (!postActionChecksOk) {
    findings.push({
      code: "post_action_checks_missing",
      severity: "error",
      field: "postActionChecks",
      message: `Production verification gate ${gateId} must document post-action checks without executing them in this gate.`,
    });
  }

  const monitoringReadiness = isRecord(record.monitoringReadiness)
    ? record.monitoringReadiness
    : {};
  const monitoringReadinessOk =
    hasNonEmptyString(monitoringReadiness.owner) &&
    monitoringReadiness.alertChannelDeclared === true &&
    monitoringReadiness.healthDashboardDeclared === true &&
    monitoringReadiness.incidentHandoffDeclared === true &&
    monitoringReadiness.executedByGate === false;
  if (!monitoringReadinessOk) {
    findings.push({
      code: "monitoring_readiness_missing",
      severity: "error",
      field: "monitoringReadiness",
      message: `Production verification gate ${gateId} must document monitoring owner, alert channel, dashboard, and incident handoff without executing monitoring.`,
    });
  }

  const incidentRollbackReadiness = isRecord(record.incidentRollbackReadiness)
    ? record.incidentRollbackReadiness
    : {};
  const incidentRollbackReadinessOk =
    hasNonEmptyString(incidentRollbackReadiness.incidentOwner) &&
    hasNonEmptyString(incidentRollbackReadiness.rollbackOwner) &&
    incidentRollbackReadiness.rollbackTriggerDeclared === true &&
    incidentRollbackReadiness.escalationPathDeclared === true &&
    incidentRollbackReadiness.rollbackExecutedByGate === false;
  if (!incidentRollbackReadinessOk) {
    findings.push({
      code: "incident_rollback_readiness_missing",
      severity: "error",
      field: "incidentRollbackReadiness",
      message: `Production verification gate ${gateId} must document incident owner, rollback owner, rollback trigger, and escalation path without executing rollback.`,
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
      message: `Production verification gate ${gateId} commandEvidence must match the required commands in order.`,
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
      message: `Production verification gate ${gateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const externalWriteEntry = commandByName(
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
    externalWriteEntry?.gate === "external_write_gate_green" &&
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
      message: `Production verification gate ${gateId} commandEvidence must include external-write, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const credentialBoundary = isRecord(record.credentialBoundary)
    ? record.credentialBoundary
    : {};
  const credentialBoundaryOk =
    credentialBoundary.credentialsRequiredForGate === false &&
    credentialBoundary.credentialsUsed === false &&
    credentialBoundary.credentialUseApproved === false &&
    credentialBoundary.secretMaterialRecorded === false;
  if (!credentialBoundaryOk) {
    findings.push({
      code: "credential_boundary_breached",
      severity: "error",
      field: "credentialBoundary",
      message: `Production verification gate ${gateId} must not require, use, approve, or record credentials.`,
    });
  }

  const decision = isRecord(record.verificationDecision)
    ? record.verificationDecision
    : {};
  const verificationDecisionOk =
    decision.decision === "blocked_until_operator_execution_approval" &&
    decision.verificationApproved === false &&
    decision.verificationExecuted === false &&
    decision.releaseExecutionApproved === false &&
    decision.releaseExecutionPerformed === false &&
    decision.externalWritesApproved === false &&
    decision.externalWritesPerformed === false &&
    decision.storeWritesApproved === false &&
    decision.storeWritesPerformed === false &&
    decision.executionApprovalGateRequired === true &&
    decision.credentialUseAllowed === false &&
    decision.productionReadinessClaimed === false;
  if (!verificationDecisionOk) {
    findings.push({
      code: "verification_decision_over_authorized",
      severity: "error",
      field: "verificationDecision",
      message: `Production verification gate ${gateId} must keep verification, release execution, external writes, store writes, and credentials blocked until future operator approval.`,
    });
  }

  const boundary = isRecord(record.verificationBoundary)
    ? record.verificationBoundary
    : {};
  const verificationBoundaryOk =
    boundary.verificationOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.productionVerificationExecuted === false &&
    boundary.releaseExecutionPerformed === false &&
    boundary.connectorCallsPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!verificationBoundaryOk) {
    findings.push({
      code: "verification_boundary_breached",
      severity: "error",
      field: "verificationBoundary",
      message: `Production verification gate ${gateId} must remain verification-only with no command execution, production verification, release execution, connector calls, external writes, store writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "production_verification_gate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Production verification gate ${gateId} approvalStatus must be production_verification_gate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PRODUCTION_VERIFICATION_GATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    verificationOnly: true as const,
    readyForReleaseExecutionApprovalReview: ok,
    ...(ok
      ? {
          productionVerificationClaim:
            "production_verification_requirements_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    gatePath: options.gatePath,
    externalWriteGatePath,
    gate: {
      gateId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      releaseAction: asString(record.releaseAction),
      targetVersion,
      verificationEnvironment: asString(
        verificationPlan.verificationEnvironment,
      ),
      nextBoundary: "release_execution_approval_boundary_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
    },
    checks: {
      externalWriteGateOk,
      recordedExternalWriteGateOk,
      identityOk,
      releaseActionOk,
      verificationPlanOk,
      postActionChecksOk,
      monitoringReadinessOk,
      incidentRollbackReadinessOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      credentialBoundaryOk,
      verificationDecisionOk,
      verificationBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start release execution approval boundary design"
      : "npm run release:production-verification:gate:check -- --gate <path>",
    nextAction: ok
      ? "Production verification requirements are defined for operator review; release execution, production verification execution, connector calls, external writes, store writes, credentials, and production readiness claims remain blocked."
      : "Fix production verification gate findings before designing release execution approval boundaries.",
  };
}
