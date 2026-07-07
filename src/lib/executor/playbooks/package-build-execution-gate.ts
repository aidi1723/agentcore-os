export const PACKAGE_BUILD_GATE_CHECK_COMMAND =
  "release:package-build:gate:check";

export type PackageBuildGateCommandEvidence = {
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

export type PackageBuildGateFinding = {
  code:
    | "invalid_gate_shape"
    | "invalid_release_execution_plan"
    | "invalid_owner_identity"
    | "invalid_release_action"
    | "package_build_request_missing"
    | "source_review_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "rollback_plan_missing"
    | "monitoring_plan_missing"
    | "artifact_handling_boundary_breached"
    | "credential_boundary_breached"
    | "package_build_decision_over_authorized"
    | "package_build_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidatePackageBuildExecutionGateOptions = {
  gatePath?: string;
  executionPlanReport: GateReport;
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
): PackageBuildGateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PackageBuildGateCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(executionPlanPath: string) {
  return [
    `npm run release:execution-plan:check -- --plan ${executionPlanPath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: PackageBuildGateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: PackageBuildGateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  gateId: string,
  field: string,
): PackageBuildGateFinding {
  return {
    code: "invalid_gate_shape",
    severity: "error",
    field,
    message: `Package build gate ${gateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: PackageBuildGateFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_release_execution_plan")) {
    return "release_execution_plan_not_green";
  }
  if (findings.length > 0) {
    return "package_build_gate_not_ready";
  }
  return "package_build_gate_ready";
}

export function validatePackageBuildExecutionGate(
  gate: unknown,
  options: ValidatePackageBuildExecutionGateOptions,
) {
  const record = isRecord(gate) ? gate : {};
  const gateId = asString(record.gateId) || "unknown";
  const executionPlanPath = asString(record.executionPlanPath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(executionPlanPath);
  const findings: PackageBuildGateFinding[] = [];

  for (const field of [
    "gateId",
    "executionPlanPath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(gateId, field));
    }
  }

  const releaseExecutionPlanOk =
    options.executionPlanReport.ok === true &&
    options.executionPlanReport.readyForReleaseExecutionGateDesign === true &&
    options.executionPlanReport.executionPlanClaim ===
      "release_execution_plan_defined" &&
    options.executionPlanReport.planningOnly === true &&
    options.executionPlanReport.productionReady === false &&
    options.executionPlanReport.publishingPerformed === false;
  if (!releaseExecutionPlanOk) {
    findings.push({
      code: "invalid_release_execution_plan",
      severity: "error",
      path: executionPlanPath,
      message: `Package build gate ${gateId} requires green release execution plan evidence.`,
    });
  }

  const recordedPlan = isRecord(record.releaseExecutionPlanResult)
    ? record.releaseExecutionPlanResult
    : {};
  const recordedPlanOk =
    recordedPlan.ok === true &&
    recordedPlan.planningOnly === true &&
    recordedPlan.executionPlanClaim === "release_execution_plan_defined" &&
    recordedPlan.productionReady === false &&
    recordedPlan.publishingPerformed === false;
  if (!recordedPlanOk) {
    findings.push({
      code: "invalid_release_execution_plan",
      severity: "error",
      field: "releaseExecutionPlanResult",
      message: `Package build gate ${gateId} must record the release execution plan as green, planning-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "package_build_gate_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Package build gate ${gateId} must include owner id, name, and package_build_gate_reviewer role.`,
    });
  }

  const releaseActionOk = record.releaseAction === "packaging";
  if (!releaseActionOk) {
    findings.push({
      code: "invalid_release_action",
      severity: "error",
      field: "releaseAction",
      message: `Package build gate ${gateId} releaseAction must be packaging.`,
    });
  }

  const packageBuildRequest = isRecord(record.packageBuildRequest)
    ? record.packageBuildRequest
    : {};
  const packageBuildRequestOk =
    packageBuildRequest.packageCommand === "npm run desktop:package" &&
    hasNonEmptyString(packageBuildRequest.packageTarget) &&
    hasNonEmptyString(packageBuildRequest.artifactType) &&
    packageBuildRequest.outputPathPolicy ===
      "blocked_until_operator_execution_approval" &&
    hasNonEmptyString(packageBuildRequest.buildEnvironment);
  if (!packageBuildRequestOk) {
    findings.push({
      code: "package_build_request_missing",
      severity: "error",
      field: "packageBuildRequest",
      message: `Package build gate ${gateId} must document package command, target, artifact type, output path policy, and build environment.`,
    });
  }

  const sourceReview = isRecord(record.sourceReview) ? record.sourceReview : {};
  const sourceReviewOk =
    sourceReview.licenseReviewed === true &&
    sourceReview.packageScriptsReviewed === true &&
    sourceReview.lockfileReviewed === true &&
    sourceReview.dependencyProvenanceReviewed === true &&
    sourceReview.trackedArtifactBoundaryReviewed === true;
  if (!sourceReviewOk) {
    findings.push({
      code: "source_review_missing",
      severity: "error",
      field: "sourceReview",
      message: `Package build gate ${gateId} must record license, package script, lockfile, dependency provenance, and tracked artifact reviews.`,
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
      message: `Package build gate ${gateId} commandEvidence must match the required commands in order.`,
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
      message: `Package build gate ${gateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const executionPlanEntry = commandByName(commandEvidence, requiredCommands[0]);
  const hygieneEntry = commandByName(commandEvidence, "npm run release:hygiene:check");
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
    executionPlanEntry?.gate === "release_execution_plan_green" &&
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
      message: `Package build gate ${gateId} commandEvidence must include execution plan, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const rollbackPlan = isRecord(record.rollbackPlan) ? record.rollbackPlan : {};
  const rollbackPlanOk =
    hasNonEmptyString(rollbackPlan.owner) &&
    rollbackPlan.documented === true &&
    rollbackPlan.rollbackCommandDeclared === true &&
    rollbackPlan.executed === false;
  if (!rollbackPlanOk) {
    findings.push({
      code: "rollback_plan_missing",
      severity: "error",
      field: "rollbackPlan",
      message: `Package build gate ${gateId} must document rollback ownership and command without executing it.`,
    });
  }

  const monitoringPlan = isRecord(record.monitoringPlan)
    ? record.monitoringPlan
    : {};
  const monitoringPlanOk =
    hasNonEmptyString(monitoringPlan.owner) &&
    monitoringPlan.documented === true &&
    monitoringPlan.smokeTestDeclared === true &&
    monitoringPlan.executed === false;
  if (!monitoringPlanOk) {
    findings.push({
      code: "monitoring_plan_missing",
      severity: "error",
      field: "monitoringPlan",
      message: `Package build gate ${gateId} must document monitoring ownership and smoke test without executing it.`,
    });
  }

  const artifactHandling = isRecord(record.artifactHandling)
    ? record.artifactHandling
    : {};
  const artifactHandlingOk =
    artifactHandling.artifactPathDeclared === true &&
    artifactHandling.artifactCreated === false &&
    artifactHandling.artifactUploaded === false &&
    artifactHandling.checksumCreated === false &&
    artifactHandling.retentionPolicyDocumented === true;
  if (!artifactHandlingOk) {
    findings.push({
      code: "artifact_handling_boundary_breached",
      severity: "error",
      field: "artifactHandling",
      message: `Package build gate ${gateId} must document artifact handling without creating, checksumming, or uploading artifacts.`,
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
      message: `Package build gate ${gateId} must not require, use, approve, or record credentials.`,
    });
  }

  const decision = isRecord(record.packageBuildDecision)
    ? record.packageBuildDecision
    : {};
  const packageBuildDecisionOk =
    decision.decision === "blocked_until_operator_execution_approval" &&
    decision.executionApproved === false &&
    decision.executionPerformed === false &&
    decision.executionGateRequired === true &&
    decision.credentialUseAllowed === false &&
    decision.productionReadinessClaimed === false;
  if (!packageBuildDecisionOk) {
    findings.push({
      code: "package_build_decision_over_authorized",
      severity: "error",
      field: "packageBuildDecision",
      message: `Package build gate ${gateId} must keep package build execution blocked until future operator approval.`,
    });
  }

  const boundary = isRecord(record.packageBuildBoundary)
    ? record.packageBuildBoundary
    : {};
  const packageBuildBoundaryOk =
    boundary.gateOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.packageBuilt === false &&
    boundary.artifactsCreated === false &&
    boundary.publishingPerformed === false &&
    boundary.tagCreated === false &&
    boundary.uploadPerformed === false &&
    boundary.deploymentPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!packageBuildBoundaryOk) {
    findings.push({
      code: "package_build_boundary_breached",
      severity: "error",
      field: "packageBuildBoundary",
      message: `Package build gate ${gateId} must remain gate-only with no commands, package build, artifacts, publishing, tag, upload, deployment, writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "package_build_execution_gate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Package build gate ${gateId} approvalStatus must be package_build_execution_gate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PACKAGE_BUILD_GATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    gateOnly: true as const,
    readyForPackageBuildOperatorReview: ok,
    ...(ok
      ? {
          packageBuildGateClaim:
            "package_build_execution_gate_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    gatePath: options.gatePath,
    executionPlanPath,
    gate: {
      gateId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      releaseAction: asString(record.releaseAction),
      targetVersion: asString(record.targetVersion),
      packageCommand: asString(packageBuildRequest.packageCommand),
      nextBoundary: "tag_creation_execution_gate_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
    },
    checks: {
      releaseExecutionPlanOk,
      recordedPlanOk,
      identityOk,
      releaseActionOk,
      packageBuildRequestOk,
      sourceReviewOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      rollbackPlanOk,
      monitoringPlanOk,
      artifactHandlingOk,
      credentialBoundaryOk,
      packageBuildDecisionOk,
      packageBuildBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start tag creation execution gate design"
      : "npm run release:package-build:gate:check -- --gate <path>",
    nextAction: ok
      ? "Package build gate is defined for operator review; package build, artifact creation, uploads, tags, deployment, credentials, and production readiness claims remain blocked."
      : "Fix package build gate findings before designing tag creation execution gates.",
  };
}
