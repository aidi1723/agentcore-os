export const EXTERNAL_WRITE_GATE_CHECK_COMMAND =
  "release:external-write:gate:check";

export type ExternalWriteGateCommandEvidence = {
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

export type ExternalWriteGateFinding = {
  code:
    | "invalid_gate_shape"
    | "invalid_deployment_gate"
    | "invalid_owner_identity"
    | "invalid_release_action"
    | "external_write_request_missing"
    | "external_system_review_missing"
    | "idempotency_policy_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "rollback_plan_missing"
    | "monitoring_plan_missing"
    | "credential_boundary_breached"
    | "external_write_decision_over_authorized"
    | "external_write_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateExternalWriteExecutionGateOptions = {
  gatePath?: string;
  deploymentGateReport: GateReport;
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

function asCommandEvidence(value: unknown): ExternalWriteGateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ExternalWriteGateCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(deploymentGatePath: string) {
  return [
    `npm run release:deployment:gate:check -- --gate ${deploymentGatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ExternalWriteGateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ExternalWriteGateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  gateId: string,
  field: string,
): ExternalWriteGateFinding {
  return {
    code: "invalid_gate_shape",
    severity: "error",
    field,
    message: `External-write gate ${gateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ExternalWriteGateFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_deployment_gate")) {
    return "deployment_gate_not_green";
  }
  if (findings.length > 0) {
    return "external_write_gate_not_ready";
  }
  return "external_write_gate_ready";
}

export function validateExternalWriteExecutionGate(
  gate: unknown,
  options: ValidateExternalWriteExecutionGateOptions,
) {
  const record = isRecord(gate) ? gate : {};
  const gateId = asString(record.gateId) || "unknown";
  const deploymentGatePath = asString(record.deploymentGatePath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(deploymentGatePath);
  const findings: ExternalWriteGateFinding[] = [];

  for (const field of [
    "gateId",
    "deploymentGatePath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(gateId, field));
    }
  }

  const deploymentGateOk =
    options.deploymentGateReport.ok === true &&
    options.deploymentGateReport.readyForDeploymentOperatorReview === true &&
    options.deploymentGateReport.deploymentGateClaim ===
      "deployment_execution_gate_defined" &&
    options.deploymentGateReport.gateOnly === true &&
    options.deploymentGateReport.productionReady === false &&
    options.deploymentGateReport.publishingPerformed === false;
  if (!deploymentGateOk) {
    findings.push({
      code: "invalid_deployment_gate",
      severity: "error",
      path: deploymentGatePath,
      message: `External-write gate ${gateId} requires green deployment gate evidence.`,
    });
  }

  const recordedDeploymentGate = isRecord(record.deploymentGateResult)
    ? record.deploymentGateResult
    : {};
  const recordedDeploymentGateOk =
    recordedDeploymentGate.ok === true &&
    recordedDeploymentGate.gateOnly === true &&
    recordedDeploymentGate.deploymentGateClaim ===
      "deployment_execution_gate_defined" &&
    recordedDeploymentGate.productionReady === false &&
    recordedDeploymentGate.publishingPerformed === false;
  if (!recordedDeploymentGateOk) {
    findings.push({
      code: "invalid_deployment_gate",
      severity: "error",
      field: "deploymentGateResult",
      message: `External-write gate ${gateId} must record the deployment gate as green, gate-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "external_write_gate_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `External-write gate ${gateId} must include owner id, name, and external_write_gate_reviewer role.`,
    });
  }

  const releaseActionOk = record.releaseAction === "external_write";
  if (!releaseActionOk) {
    findings.push({
      code: "invalid_release_action",
      severity: "error",
      field: "releaseAction",
      message: `External-write gate ${gateId} releaseAction must be external_write.`,
    });
  }

  const externalWriteRequest = isRecord(record.externalWriteRequest)
    ? record.externalWriteRequest
    : {};
  const targetVersion = asString(record.targetVersion);
  const expectedVersionMarker = `v${targetVersion}`;
  const externalWriteRequestOk =
    hasNonEmptyString(externalWriteRequest.targetSystem) &&
    hasNonEmptyString(externalWriteRequest.writeIntent) &&
    asString(externalWriteRequest.writeCommand).includes(
      expectedVersionMarker,
    ) &&
    hasNonEmptyString(externalWriteRequest.writePayload) &&
    externalWriteRequest.writePathPolicy ===
      "blocked_until_operator_execution_approval";
  if (!externalWriteRequestOk) {
    findings.push({
      code: "external_write_request_missing",
      severity: "error",
      field: "externalWriteRequest",
      message: `External-write gate ${gateId} must document target system, write intent, versioned command, payload, and blocked write path policy.`,
    });
  }

  const externalSystemReview = isRecord(record.externalSystemReview)
    ? record.externalSystemReview
    : {};
  const externalSystemReviewOk =
    externalSystemReview.targetSystemReviewed === true &&
    externalSystemReview.writeScopeReviewed === true &&
    externalSystemReview.payloadReviewed === true &&
    externalSystemReview.idempotencyReviewed === true &&
    externalSystemReview.rollbackTargetReviewed === true;
  if (!externalSystemReviewOk) {
    findings.push({
      code: "external_system_review_missing",
      severity: "error",
      field: "externalSystemReview",
      message: `External-write gate ${gateId} must record target system, write scope, payload, idempotency, and rollback target review.`,
    });
  }

  const idempotencyPolicy = isRecord(record.idempotencyPolicy)
    ? record.idempotencyPolicy
    : {};
  const idempotencyPolicyOk =
    idempotencyPolicy.idempotencyRequired === true &&
    idempotencyPolicy.idempotencyKeyDeclared === true &&
    idempotencyPolicy.duplicateWriteHandlingDeclared === true &&
    idempotencyPolicy.retryPolicyDocumented === true &&
    idempotencyPolicy.checksExecutedByGate === false;
  if (!idempotencyPolicyOk) {
    findings.push({
      code: "idempotency_policy_missing",
      severity: "error",
      field: "idempotencyPolicy",
      message: `External-write gate ${gateId} must document idempotency requirements without executing idempotency checks in this gate.`,
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
      message: `External-write gate ${gateId} commandEvidence must match the required commands in order.`,
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
      message: `External-write gate ${gateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const deploymentEntry = commandByName(commandEvidence, requiredCommands[0]);
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
    deploymentEntry?.gate === "deployment_gate_green" &&
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
      message: `External-write gate ${gateId} commandEvidence must include deployment, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const rollbackPlan = isRecord(record.rollbackPlan) ? record.rollbackPlan : {};
  const rollbackPlanOk =
    hasNonEmptyString(rollbackPlan.owner) &&
    rollbackPlan.documented === true &&
    rollbackPlan.rollbackTargetDeclared === true &&
    rollbackPlan.rollbackCommandDeclared === true &&
    rollbackPlan.executed === false;
  if (!rollbackPlanOk) {
    findings.push({
      code: "rollback_plan_missing",
      severity: "error",
      field: "rollbackPlan",
      message: `External-write gate ${gateId} must document rollback ownership, rollback target, and rollback command without executing rollback.`,
    });
  }

  const monitoringPlan = isRecord(record.monitoringPlan)
    ? record.monitoringPlan
    : {};
  const monitoringPlanOk =
    hasNonEmptyString(monitoringPlan.owner) &&
    monitoringPlan.documented === true &&
    monitoringPlan.postWriteVerificationDeclared === true &&
    monitoringPlan.alertReviewDeclared === true &&
    monitoringPlan.executed === false;
  if (!monitoringPlanOk) {
    findings.push({
      code: "monitoring_plan_missing",
      severity: "error",
      field: "monitoringPlan",
      message: `External-write gate ${gateId} must document post-write monitoring without executing it.`,
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
      message: `External-write gate ${gateId} must not require, use, approve, or record credentials.`,
    });
  }

  const decision = isRecord(record.externalWriteDecision)
    ? record.externalWriteDecision
    : {};
  const externalWriteDecisionOk =
    decision.decision === "blocked_until_operator_execution_approval" &&
    decision.externalWriteApproved === false &&
    decision.externalWritePerformed === false &&
    decision.connectorCallsApproved === false &&
    decision.connectorCallsPerformed === false &&
    decision.storeWritesApproved === false &&
    decision.storeWritesPerformed === false &&
    decision.executionGateRequired === true &&
    decision.credentialUseAllowed === false &&
    decision.productionReadinessClaimed === false;
  if (!externalWriteDecisionOk) {
    findings.push({
      code: "external_write_decision_over_authorized",
      severity: "error",
      field: "externalWriteDecision",
      message: `External-write gate ${gateId} must keep connector calls, external writes, store writes, and credentials blocked until future operator approval.`,
    });
  }

  const boundary = isRecord(record.externalWriteBoundary)
    ? record.externalWriteBoundary
    : {};
  const externalWriteBoundaryOk =
    boundary.gateOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.connectorCallsPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!externalWriteBoundaryOk) {
    findings.push({
      code: "external_write_boundary_breached",
      severity: "error",
      field: "externalWriteBoundary",
      message: `External-write gate ${gateId} must remain gate-only with no connector calls, external writes, store writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "external_write_execution_gate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `External-write gate ${gateId} approvalStatus must be external_write_execution_gate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: EXTERNAL_WRITE_GATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    gateOnly: true as const,
    readyForExternalWriteOperatorReview: ok,
    ...(ok
      ? {
          externalWriteGateClaim:
            "external_write_execution_gate_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    gatePath: options.gatePath,
    deploymentGatePath,
    gate: {
      gateId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      releaseAction: asString(record.releaseAction),
      targetVersion,
      targetSystem: asString(externalWriteRequest.targetSystem),
      writeIntent: asString(externalWriteRequest.writeIntent),
      nextBoundary: "production_verification_gate_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
    },
    checks: {
      deploymentGateOk,
      recordedDeploymentGateOk,
      identityOk,
      releaseActionOk,
      externalWriteRequestOk,
      externalSystemReviewOk,
      idempotencyPolicyOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      rollbackPlanOk,
      monitoringPlanOk,
      credentialBoundaryOk,
      externalWriteDecisionOk,
      externalWriteBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start production verification gate design"
      : "npm run release:external-write:gate:check -- --gate <path>",
    nextAction: ok
      ? "External-write gate is defined for operator review; connector calls, external writes, store writes, credentials, deployment verification, and production readiness claims remain blocked."
      : "Fix external-write gate findings before designing production verification gates.",
  };
}
