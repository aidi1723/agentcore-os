export const DEPLOYMENT_GATE_CHECK_COMMAND =
  "release:deployment:gate:check";

export type DeploymentGateCommandEvidence = {
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

export type DeploymentGateFinding = {
  code:
    | "invalid_gate_shape"
    | "invalid_artifact_upload_gate"
    | "invalid_owner_identity"
    | "invalid_release_action"
    | "deployment_request_missing"
    | "deployment_environment_review_missing"
    | "pre_deployment_checks_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "rollback_plan_missing"
    | "monitoring_plan_missing"
    | "credential_boundary_breached"
    | "deployment_decision_over_authorized"
    | "deployment_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateDeploymentExecutionGateOptions = {
  gatePath?: string;
  artifactUploadGateReport: GateReport;
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

function asCommandEvidence(value: unknown): DeploymentGateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DeploymentGateCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(artifactUploadGatePath: string) {
  return [
    `npm run release:artifact-upload:gate:check -- --gate ${artifactUploadGatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: DeploymentGateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: DeploymentGateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  gateId: string,
  field: string,
): DeploymentGateFinding {
  return {
    code: "invalid_gate_shape",
    severity: "error",
    field,
    message: `Deployment gate ${gateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: DeploymentGateFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_artifact_upload_gate")) {
    return "artifact_upload_gate_not_green";
  }
  if (findings.length > 0) {
    return "deployment_gate_not_ready";
  }
  return "deployment_gate_ready";
}

export function validateDeploymentExecutionGate(
  gate: unknown,
  options: ValidateDeploymentExecutionGateOptions,
) {
  const record = isRecord(gate) ? gate : {};
  const gateId = asString(record.gateId) || "unknown";
  const artifactUploadGatePath = asString(record.artifactUploadGatePath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(artifactUploadGatePath);
  const findings: DeploymentGateFinding[] = [];

  for (const field of [
    "gateId",
    "artifactUploadGatePath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(gateId, field));
    }
  }

  const artifactUploadGateOk =
    options.artifactUploadGateReport.ok === true &&
    options.artifactUploadGateReport
      .readyForArtifactUploadOperatorReview === true &&
    options.artifactUploadGateReport.artifactUploadGateClaim ===
      "artifact_upload_execution_gate_defined" &&
    options.artifactUploadGateReport.gateOnly === true &&
    options.artifactUploadGateReport.productionReady === false &&
    options.artifactUploadGateReport.publishingPerformed === false;
  if (!artifactUploadGateOk) {
    findings.push({
      code: "invalid_artifact_upload_gate",
      severity: "error",
      path: artifactUploadGatePath,
      message: `Deployment gate ${gateId} requires green artifact upload gate evidence.`,
    });
  }

  const recordedArtifactUploadGate = isRecord(record.artifactUploadGateResult)
    ? record.artifactUploadGateResult
    : {};
  const recordedArtifactUploadGateOk =
    recordedArtifactUploadGate.ok === true &&
    recordedArtifactUploadGate.gateOnly === true &&
    recordedArtifactUploadGate.artifactUploadGateClaim ===
      "artifact_upload_execution_gate_defined" &&
    recordedArtifactUploadGate.productionReady === false &&
    recordedArtifactUploadGate.publishingPerformed === false;
  if (!recordedArtifactUploadGateOk) {
    findings.push({
      code: "invalid_artifact_upload_gate",
      severity: "error",
      field: "artifactUploadGateResult",
      message: `Deployment gate ${gateId} must record the artifact upload gate as green, gate-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "deployment_gate_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Deployment gate ${gateId} must include owner id, name, and deployment_gate_reviewer role.`,
    });
  }

  const releaseActionOk = record.releaseAction === "deployment";
  if (!releaseActionOk) {
    findings.push({
      code: "invalid_release_action",
      severity: "error",
      field: "releaseAction",
      message: `Deployment gate ${gateId} releaseAction must be deployment.`,
    });
  }

  const deploymentRequest = isRecord(record.deploymentRequest)
    ? record.deploymentRequest
    : {};
  const targetVersion = asString(record.targetVersion);
  const expectedVersionMarker = `v${targetVersion}`;
  const deploymentRequestOk =
    hasNonEmptyString(deploymentRequest.environment) &&
    hasNonEmptyString(deploymentRequest.deploymentTarget) &&
    asString(deploymentRequest.deploymentCommand).includes(
      expectedVersionMarker,
    ) &&
    asString(deploymentRequest.deploymentArtifact).includes(
      expectedVersionMarker,
    ) &&
    deploymentRequest.deploymentStrategy === "manual_operator_triggered" &&
    deploymentRequest.deploymentPathPolicy ===
      "blocked_until_operator_execution_approval";
  if (!deploymentRequestOk) {
    findings.push({
      code: "deployment_request_missing",
      severity: "error",
      field: "deploymentRequest",
      message: `Deployment gate ${gateId} must document environment, target, command, artifact, manual strategy, and blocked deployment path policy.`,
    });
  }

  const environmentReview = isRecord(record.deploymentEnvironmentReview)
    ? record.deploymentEnvironmentReview
    : {};
  const deploymentEnvironmentReviewOk =
    environmentReview.environmentReviewed === true &&
    environmentReview.targetReviewed === true &&
    environmentReview.artifactReleaseLinkageReviewed === true &&
    environmentReview.rollbackWindowReviewed === true &&
    environmentReview.maintenanceWindowReviewed === true;
  if (!deploymentEnvironmentReviewOk) {
    findings.push({
      code: "deployment_environment_review_missing",
      severity: "error",
      field: "deploymentEnvironmentReview",
      message: `Deployment gate ${gateId} must record environment, target, artifact linkage, rollback window, and maintenance window review.`,
    });
  }

  const preDeploymentChecks = isRecord(record.preDeploymentChecks)
    ? record.preDeploymentChecks
    : {};
  const preDeploymentChecksOk =
    preDeploymentChecks.healthCheckDeclared === true &&
    preDeploymentChecks.configReviewDocumented === true &&
    preDeploymentChecks.migrationImpactReviewed === true &&
    preDeploymentChecks.smokePathDeclared === true &&
    preDeploymentChecks.checksExecutedByGate === false;
  if (!preDeploymentChecksOk) {
    findings.push({
      code: "pre_deployment_checks_missing",
      severity: "error",
      field: "preDeploymentChecks",
      message: `Deployment gate ${gateId} must document pre-deployment checks without executing them in this gate.`,
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
      message: `Deployment gate ${gateId} commandEvidence must match the required commands in order.`,
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
      message: `Deployment gate ${gateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const artifactUploadEntry = commandByName(
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
    artifactUploadEntry?.gate === "artifact_upload_gate_green" &&
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
      message: `Deployment gate ${gateId} commandEvidence must include artifact upload, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const rollbackPlan = isRecord(record.rollbackPlan) ? record.rollbackPlan : {};
  const rollbackPlanOk =
    hasNonEmptyString(rollbackPlan.owner) &&
    rollbackPlan.documented === true &&
    rollbackPlan.rollbackCommandDeclared === true &&
    rollbackPlan.previousVersionIdentified === true &&
    rollbackPlan.executed === false;
  if (!rollbackPlanOk) {
    findings.push({
      code: "rollback_plan_missing",
      severity: "error",
      field: "rollbackPlan",
      message: `Deployment gate ${gateId} must document rollback ownership, rollback command, and previous version without executing rollback.`,
    });
  }

  const monitoringPlan = isRecord(record.monitoringPlan)
    ? record.monitoringPlan
    : {};
  const monitoringPlanOk =
    hasNonEmptyString(monitoringPlan.owner) &&
    monitoringPlan.documented === true &&
    monitoringPlan.postDeployHealthCheckDeclared === true &&
    monitoringPlan.alertReviewDeclared === true &&
    monitoringPlan.executed === false;
  if (!monitoringPlanOk) {
    findings.push({
      code: "monitoring_plan_missing",
      severity: "error",
      field: "monitoringPlan",
      message: `Deployment gate ${gateId} must document post-deploy monitoring without executing it.`,
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
      message: `Deployment gate ${gateId} must not require, use, approve, or record credentials.`,
    });
  }

  const decision = isRecord(record.deploymentDecision)
    ? record.deploymentDecision
    : {};
  const deploymentDecisionOk =
    decision.decision === "blocked_until_operator_execution_approval" &&
    decision.deploymentApproved === false &&
    decision.deploymentPerformed === false &&
    decision.externalWritesApproved === false &&
    decision.externalWritesPerformed === false &&
    decision.executionGateRequired === true &&
    decision.credentialUseAllowed === false &&
    decision.productionReadinessClaimed === false;
  if (!deploymentDecisionOk) {
    findings.push({
      code: "deployment_decision_over_authorized",
      severity: "error",
      field: "deploymentDecision",
      message: `Deployment gate ${gateId} must keep deployment and external writes blocked until future operator approval.`,
    });
  }

  const boundary = isRecord(record.deploymentBoundary)
    ? record.deploymentBoundary
    : {};
  const deploymentBoundaryOk =
    boundary.gateOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.deploymentPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!deploymentBoundaryOk) {
    findings.push({
      code: "deployment_boundary_breached",
      severity: "error",
      field: "deploymentBoundary",
      message: `Deployment gate ${gateId} must remain gate-only with no deployment, external writes, store writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "deployment_execution_gate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Deployment gate ${gateId} approvalStatus must be deployment_execution_gate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: DEPLOYMENT_GATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    gateOnly: true as const,
    readyForDeploymentOperatorReview: ok,
    ...(ok
      ? {
          deploymentGateClaim: "deployment_execution_gate_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    gatePath: options.gatePath,
    artifactUploadGatePath,
    gate: {
      gateId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      releaseAction: asString(record.releaseAction),
      targetVersion,
      environment: asString(deploymentRequest.environment),
      deploymentTarget: asString(deploymentRequest.deploymentTarget),
      nextBoundary: "external_write_execution_gate_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
    },
    checks: {
      artifactUploadGateOk,
      recordedArtifactUploadGateOk,
      identityOk,
      releaseActionOk,
      deploymentRequestOk,
      deploymentEnvironmentReviewOk,
      preDeploymentChecksOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      rollbackPlanOk,
      monitoringPlanOk,
      credentialBoundaryOk,
      deploymentDecisionOk,
      deploymentBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start external write execution gate design"
      : "npm run release:deployment:gate:check -- --gate <path>",
    nextAction: ok
      ? "Deployment gate is defined for operator review; deployment, external writes, credentials, and production readiness claims remain blocked."
      : "Fix deployment gate findings before designing external write execution gates.",
  };
}
