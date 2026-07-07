export const ARTIFACT_UPLOAD_GATE_CHECK_COMMAND =
  "release:artifact-upload:gate:check";

export type ArtifactUploadGateCommandEvidence = {
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

export type ArtifactUploadGateFinding = {
  code:
    | "invalid_gate_shape"
    | "invalid_tag_creation_gate"
    | "invalid_owner_identity"
    | "invalid_release_action"
    | "artifact_upload_request_missing"
    | "artifact_identity_review_missing"
    | "checksum_provenance_boundary_breached"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "rollback_plan_missing"
    | "monitoring_plan_missing"
    | "credential_boundary_breached"
    | "artifact_upload_decision_over_authorized"
    | "artifact_upload_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateArtifactUploadExecutionGateOptions = {
  gatePath?: string;
  tagCreationGateReport: GateReport;
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
): ArtifactUploadGateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ArtifactUploadGateCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(tagCreationGatePath: string) {
  return [
    `npm run release:tag-creation:gate:check -- --gate ${tagCreationGatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ArtifactUploadGateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ArtifactUploadGateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  gateId: string,
  field: string,
): ArtifactUploadGateFinding {
  return {
    code: "invalid_gate_shape",
    severity: "error",
    field,
    message: `Artifact upload gate ${gateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ArtifactUploadGateFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_tag_creation_gate")) {
    return "tag_creation_gate_not_green";
  }
  if (findings.length > 0) {
    return "artifact_upload_gate_not_ready";
  }
  return "artifact_upload_gate_ready";
}

export function validateArtifactUploadExecutionGate(
  gate: unknown,
  options: ValidateArtifactUploadExecutionGateOptions,
) {
  const record = isRecord(gate) ? gate : {};
  const gateId = asString(record.gateId) || "unknown";
  const tagCreationGatePath = asString(record.tagCreationGatePath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(tagCreationGatePath);
  const findings: ArtifactUploadGateFinding[] = [];

  for (const field of [
    "gateId",
    "tagCreationGatePath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(gateId, field));
    }
  }

  const tagCreationGateOk =
    options.tagCreationGateReport.ok === true &&
    options.tagCreationGateReport.readyForTagCreationOperatorReview === true &&
    options.tagCreationGateReport.tagCreationGateClaim ===
      "tag_creation_execution_gate_defined" &&
    options.tagCreationGateReport.gateOnly === true &&
    options.tagCreationGateReport.productionReady === false &&
    options.tagCreationGateReport.publishingPerformed === false;
  if (!tagCreationGateOk) {
    findings.push({
      code: "invalid_tag_creation_gate",
      severity: "error",
      path: tagCreationGatePath,
      message: `Artifact upload gate ${gateId} requires green tag creation gate evidence.`,
    });
  }

  const recordedTagCreationGate = isRecord(record.tagCreationGateResult)
    ? record.tagCreationGateResult
    : {};
  const recordedTagCreationGateOk =
    recordedTagCreationGate.ok === true &&
    recordedTagCreationGate.gateOnly === true &&
    recordedTagCreationGate.tagCreationGateClaim ===
      "tag_creation_execution_gate_defined" &&
    recordedTagCreationGate.productionReady === false &&
    recordedTagCreationGate.publishingPerformed === false;
  if (!recordedTagCreationGateOk) {
    findings.push({
      code: "invalid_tag_creation_gate",
      severity: "error",
      field: "tagCreationGateResult",
      message: `Artifact upload gate ${gateId} must record the tag creation gate as green, gate-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "artifact_upload_gate_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Artifact upload gate ${gateId} must include owner id, name, and artifact_upload_gate_reviewer role.`,
    });
  }

  const releaseActionOk = record.releaseAction === "artifact_upload";
  if (!releaseActionOk) {
    findings.push({
      code: "invalid_release_action",
      severity: "error",
      field: "releaseAction",
      message: `Artifact upload gate ${gateId} releaseAction must be artifact_upload.`,
    });
  }

  const artifactUploadRequest = isRecord(record.artifactUploadRequest)
    ? record.artifactUploadRequest
    : {};
  const targetVersion = asString(record.targetVersion);
  const expectedVersionMarker = `v${targetVersion}`;
  const artifactUploadRequestOk =
    hasNonEmptyString(artifactUploadRequest.artifactName) &&
    asString(artifactUploadRequest.artifactName).includes(
      expectedVersionMarker,
    ) &&
    hasNonEmptyString(artifactUploadRequest.artifactType) &&
    asString(artifactUploadRequest.sourceArtifactPath).startsWith("output/") &&
    asString(artifactUploadRequest.uploadDestination).includes(targetVersion) &&
    asString(artifactUploadRequest.uploadCommand).startsWith(
      `gh release upload ${expectedVersionMarker} `,
    ) &&
    artifactUploadRequest.uploadPathPolicy ===
      "blocked_until_operator_execution_approval";
  if (!artifactUploadRequestOk) {
    findings.push({
      code: "artifact_upload_request_missing",
      severity: "error",
      field: "artifactUploadRequest",
      message: `Artifact upload gate ${gateId} must document artifact name, type, source path, destination, upload command, and blocked upload policy.`,
    });
  }

  const artifactIdentityReview = isRecord(record.artifactIdentityReview)
    ? record.artifactIdentityReview
    : {};
  const artifactIdentityReviewOk =
    artifactIdentityReview.artifactNameMatchesVersion === true &&
    artifactIdentityReview.artifactTypeReviewed === true &&
    artifactIdentityReview.sourcePathScopedToReleaseOutput === true &&
    artifactIdentityReview.uploadDestinationReviewed === true &&
    artifactIdentityReview.releaseTagLinkageReviewed === true;
  if (!artifactIdentityReviewOk) {
    findings.push({
      code: "artifact_identity_review_missing",
      severity: "error",
      field: "artifactIdentityReview",
      message: `Artifact upload gate ${gateId} must record artifact identity, source path, destination, and release tag linkage review.`,
    });
  }

  const checksumProvenancePolicy = isRecord(record.checksumProvenancePolicy)
    ? record.checksumProvenancePolicy
    : {};
  const checksumProvenancePolicyOk =
    checksumProvenancePolicy.checksumRequired === true &&
    checksumProvenancePolicy.checksumAlgorithm === "sha256" &&
    checksumProvenancePolicy.checksumCreatedByGate === false &&
    checksumProvenancePolicy.provenanceRequired === true &&
    checksumProvenancePolicy.provenanceCreatedByGate === false;
  if (!checksumProvenancePolicyOk) {
    findings.push({
      code: "checksum_provenance_boundary_breached",
      severity: "error",
      field: "checksumProvenancePolicy",
      message: `Artifact upload gate ${gateId} must require checksum and provenance policy without generating checksum or provenance in this gate.`,
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
      message: `Artifact upload gate ${gateId} commandEvidence must match the required commands in order.`,
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
      message: `Artifact upload gate ${gateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const tagCreationEntry = commandByName(commandEvidence, requiredCommands[0]);
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
    tagCreationEntry?.gate === "tag_creation_gate_green" &&
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
      message: `Artifact upload gate ${gateId} commandEvidence must include tag creation, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const rollbackPlan = isRecord(record.rollbackPlan) ? record.rollbackPlan : {};
  const rollbackPlanOk =
    hasNonEmptyString(rollbackPlan.owner) &&
    rollbackPlan.documented === true &&
    rollbackPlan.removeUploadedArtifactCommandDeclared === true &&
    rollbackPlan.releaseRollbackDocumented === true &&
    rollbackPlan.executed === false;
  if (!rollbackPlanOk) {
    findings.push({
      code: "rollback_plan_missing",
      severity: "error",
      field: "rollbackPlan",
      message: `Artifact upload gate ${gateId} must document uploaded artifact and release rollback without executing it.`,
    });
  }

  const monitoringPlan = isRecord(record.monitoringPlan)
    ? record.monitoringPlan
    : {};
  const monitoringPlanOk =
    hasNonEmptyString(monitoringPlan.owner) &&
    monitoringPlan.documented === true &&
    monitoringPlan.artifactAvailabilityCheckDeclared === true &&
    monitoringPlan.executed === false;
  if (!monitoringPlanOk) {
    findings.push({
      code: "monitoring_plan_missing",
      severity: "error",
      field: "monitoringPlan",
      message: `Artifact upload gate ${gateId} must document monitoring ownership and artifact availability check without executing it.`,
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
      message: `Artifact upload gate ${gateId} must not require, use, approve, or record credentials.`,
    });
  }

  const decision = isRecord(record.artifactUploadDecision)
    ? record.artifactUploadDecision
    : {};
  const artifactUploadDecisionOk =
    decision.decision === "blocked_until_operator_execution_approval" &&
    decision.uploadApproved === false &&
    decision.uploadPerformed === false &&
    decision.releaseCreationApproved === false &&
    decision.releaseCreated === false &&
    decision.executionGateRequired === true &&
    decision.credentialUseAllowed === false &&
    decision.productionReadinessClaimed === false;
  if (!artifactUploadDecisionOk) {
    findings.push({
      code: "artifact_upload_decision_over_authorized",
      severity: "error",
      field: "artifactUploadDecision",
      message: `Artifact upload gate ${gateId} must keep artifact upload and release creation blocked until future operator approval.`,
    });
  }

  const boundary = isRecord(record.artifactUploadBoundary)
    ? record.artifactUploadBoundary
    : {};
  const artifactUploadBoundaryOk =
    boundary.gateOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.artifactsCreated === false &&
    boundary.checksumsCreated === false &&
    boundary.artifactsUploaded === false &&
    boundary.releaseCreated === false &&
    boundary.deploymentPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!artifactUploadBoundaryOk) {
    findings.push({
      code: "artifact_upload_boundary_breached",
      severity: "error",
      field: "artifactUploadBoundary",
      message: `Artifact upload gate ${gateId} must remain gate-only with no artifact creation, checksum creation, upload, release, deployment, writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "artifact_upload_execution_gate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Artifact upload gate ${gateId} approvalStatus must be artifact_upload_execution_gate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: ARTIFACT_UPLOAD_GATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    gateOnly: true as const,
    readyForArtifactUploadOperatorReview: ok,
    ...(ok
      ? {
          artifactUploadGateClaim:
            "artifact_upload_execution_gate_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    gatePath: options.gatePath,
    tagCreationGatePath,
    gate: {
      gateId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      releaseAction: asString(record.releaseAction),
      targetVersion,
      artifactName: asString(artifactUploadRequest.artifactName),
      uploadDestination: asString(artifactUploadRequest.uploadDestination),
      nextBoundary: "deployment_execution_gate_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
    },
    checks: {
      tagCreationGateOk,
      recordedTagCreationGateOk,
      identityOk,
      releaseActionOk,
      artifactUploadRequestOk,
      artifactIdentityReviewOk,
      checksumProvenancePolicyOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      rollbackPlanOk,
      monitoringPlanOk,
      credentialBoundaryOk,
      artifactUploadDecisionOk,
      artifactUploadBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start deployment execution gate design"
      : "npm run release:artifact-upload:gate:check -- --gate <path>",
    nextAction: ok
      ? "Artifact upload gate is defined for operator review; artifact creation, checksum creation, upload, release creation, deployment, credentials, and production readiness claims remain blocked."
      : "Fix artifact upload gate findings before designing deployment execution gates.",
  };
}
