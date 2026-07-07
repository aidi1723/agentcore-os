export const TAG_CREATION_GATE_CHECK_COMMAND =
  "release:tag-creation:gate:check";

export type TagCreationGateCommandEvidence = {
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

export type TagCreationGateFinding = {
  code:
    | "invalid_gate_shape"
    | "invalid_package_build_gate"
    | "invalid_owner_identity"
    | "invalid_release_action"
    | "tag_request_missing"
    | "tag_policy_review_missing"
    | "source_commit_evidence_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "release_notes_linkage_missing"
    | "rollback_plan_missing"
    | "monitoring_plan_missing"
    | "credential_boundary_breached"
    | "tag_creation_decision_over_authorized"
    | "tag_creation_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateTagCreationExecutionGateOptions = {
  gatePath?: string;
  packageBuildGateReport: GateReport;
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
): TagCreationGateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TagCreationGateCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(packageBuildGatePath: string) {
  return [
    `npm run release:package-build:gate:check -- --gate ${packageBuildGatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: TagCreationGateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: TagCreationGateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  gateId: string,
  field: string,
): TagCreationGateFinding {
  return {
    code: "invalid_gate_shape",
    severity: "error",
    field,
    message: `Tag creation gate ${gateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: TagCreationGateFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_package_build_gate")) {
    return "package_build_gate_not_green";
  }
  if (findings.length > 0) {
    return "tag_creation_gate_not_ready";
  }
  return "tag_creation_gate_ready";
}

export function validateTagCreationExecutionGate(
  gate: unknown,
  options: ValidateTagCreationExecutionGateOptions,
) {
  const record = isRecord(gate) ? gate : {};
  const gateId = asString(record.gateId) || "unknown";
  const packageBuildGatePath = asString(record.packageBuildGatePath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(packageBuildGatePath);
  const findings: TagCreationGateFinding[] = [];

  for (const field of [
    "gateId",
    "packageBuildGatePath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(gateId, field));
    }
  }

  const packageBuildGateOk =
    options.packageBuildGateReport.ok === true &&
    options.packageBuildGateReport.readyForPackageBuildOperatorReview === true &&
    options.packageBuildGateReport.packageBuildGateClaim ===
      "package_build_execution_gate_defined" &&
    options.packageBuildGateReport.gateOnly === true &&
    options.packageBuildGateReport.productionReady === false &&
    options.packageBuildGateReport.publishingPerformed === false;
  if (!packageBuildGateOk) {
    findings.push({
      code: "invalid_package_build_gate",
      severity: "error",
      path: packageBuildGatePath,
      message: `Tag creation gate ${gateId} requires green package build gate evidence.`,
    });
  }

  const recordedPackageBuildGate = isRecord(record.packageBuildGateResult)
    ? record.packageBuildGateResult
    : {};
  const recordedPackageBuildGateOk =
    recordedPackageBuildGate.ok === true &&
    recordedPackageBuildGate.gateOnly === true &&
    recordedPackageBuildGate.packageBuildGateClaim ===
      "package_build_execution_gate_defined" &&
    recordedPackageBuildGate.productionReady === false &&
    recordedPackageBuildGate.publishingPerformed === false;
  if (!recordedPackageBuildGateOk) {
    findings.push({
      code: "invalid_package_build_gate",
      severity: "error",
      field: "packageBuildGateResult",
      message: `Tag creation gate ${gateId} must record the package build gate as green, gate-only, non-publishing, and non-production.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "tag_creation_gate_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Tag creation gate ${gateId} must include owner id, name, and tag_creation_gate_reviewer role.`,
    });
  }

  const releaseActionOk = record.releaseAction === "tag_creation";
  if (!releaseActionOk) {
    findings.push({
      code: "invalid_release_action",
      severity: "error",
      field: "releaseAction",
      message: `Tag creation gate ${gateId} releaseAction must be tag_creation.`,
    });
  }

  const tagRequest = isRecord(record.tagRequest) ? record.tagRequest : {};
  const expectedTagName = `v${asString(record.targetVersion)}`;
  const tagRequestOk =
    tagRequest.tagName === expectedTagName &&
    hasNonEmptyString(tagRequest.targetCommit) &&
    hasNonEmptyString(tagRequest.sourceBranch) &&
    tagRequest.tagType === "annotated" &&
    tagRequest.tagMessagePolicy === "version_and_release_summary_required";
  if (!tagRequestOk) {
    findings.push({
      code: "tag_request_missing",
      severity: "error",
      field: "tagRequest",
      message: `Tag creation gate ${gateId} must document an annotated tag request that matches the target version and target commit.`,
    });
  }

  const tagPolicyReview = isRecord(record.tagPolicyReview)
    ? record.tagPolicyReview
    : {};
  const tagPolicyReviewOk =
    tagPolicyReview.tagNameMatchesVersion === true &&
    tagPolicyReview.annotatedTagRequired === true &&
    tagPolicyReview.changelogLinkageReviewed === true &&
    tagPolicyReview.releaseNotesLinkageReviewed === true &&
    tagPolicyReview.existingTagChecked === true &&
    tagPolicyReview.tagCollisionFound === false;
  if (!tagPolicyReviewOk) {
    findings.push({
      code: "tag_policy_review_missing",
      severity: "error",
      field: "tagPolicyReview",
      message: `Tag creation gate ${gateId} must record tag naming, annotation, changelog, release notes, and collision review.`,
    });
  }

  const sourceCommitEvidence = isRecord(record.sourceCommitEvidence)
    ? record.sourceCommitEvidence
    : {};
  const sourceCommitEvidenceOk =
    sourceCommitEvidence.targetCommitRecorded === true &&
    sourceCommitEvidence.sourceBranchRecorded === true &&
    sourceCommitEvidence.workingTreeDiffGateRecorded === true &&
    hasNonEmptyString(sourceCommitEvidence.currentBranchPolicy);
  if (!sourceCommitEvidenceOk) {
    findings.push({
      code: "source_commit_evidence_missing",
      severity: "error",
      field: "sourceCommitEvidence",
      message: `Tag creation gate ${gateId} must record target commit, source branch, working tree diff gate, and branch policy evidence.`,
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
      message: `Tag creation gate ${gateId} commandEvidence must match the required commands in order.`,
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
      message: `Tag creation gate ${gateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const packageBuildEntry = commandByName(commandEvidence, requiredCommands[0]);
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
    packageBuildEntry?.gate === "package_build_gate_green" &&
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
      message: `Tag creation gate ${gateId} commandEvidence must include package build, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const releaseNotesLinkage = isRecord(record.releaseNotesLinkage)
    ? record.releaseNotesLinkage
    : {};
  const releaseNotesLinkageOk =
    releaseNotesLinkage.changelogUpdated === true &&
    releaseNotesLinkage.releaseNotesDrafted === true &&
    hasNonEmptyString(releaseNotesLinkage.releaseNotesPath) &&
    releaseNotesLinkage.targetVersionMentioned === true;
  if (!releaseNotesLinkageOk) {
    findings.push({
      code: "release_notes_linkage_missing",
      severity: "error",
      field: "releaseNotesLinkage",
      message: `Tag creation gate ${gateId} must document changelog and release note linkage for the target version.`,
    });
  }

  const rollbackPlan = isRecord(record.rollbackPlan) ? record.rollbackPlan : {};
  const rollbackPlanOk =
    hasNonEmptyString(rollbackPlan.owner) &&
    rollbackPlan.documented === true &&
    rollbackPlan.deleteLocalTagCommandDeclared === true &&
    rollbackPlan.deleteRemoteTagCommandDeclared === true &&
    rollbackPlan.executed === false;
  if (!rollbackPlanOk) {
    findings.push({
      code: "rollback_plan_missing",
      severity: "error",
      field: "rollbackPlan",
      message: `Tag creation gate ${gateId} must document local and remote tag rollback without executing it.`,
    });
  }

  const monitoringPlan = isRecord(record.monitoringPlan)
    ? record.monitoringPlan
    : {};
  const monitoringPlanOk =
    hasNonEmptyString(monitoringPlan.owner) &&
    monitoringPlan.documented === true &&
    monitoringPlan.tagVerificationDeclared === true &&
    monitoringPlan.executed === false;
  if (!monitoringPlanOk) {
    findings.push({
      code: "monitoring_plan_missing",
      severity: "error",
      field: "monitoringPlan",
      message: `Tag creation gate ${gateId} must document monitoring ownership and tag verification without executing it.`,
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
      message: `Tag creation gate ${gateId} must not require, use, approve, or record credentials.`,
    });
  }

  const decision = isRecord(record.tagCreationDecision)
    ? record.tagCreationDecision
    : {};
  const tagCreationDecisionOk =
    decision.decision === "blocked_until_operator_execution_approval" &&
    decision.tagCreationApproved === false &&
    decision.tagCreated === false &&
    decision.tagPushApproved === false &&
    decision.tagPushPerformed === false &&
    decision.executionGateRequired === true &&
    decision.credentialUseAllowed === false &&
    decision.productionReadinessClaimed === false;
  if (!tagCreationDecisionOk) {
    findings.push({
      code: "tag_creation_decision_over_authorized",
      severity: "error",
      field: "tagCreationDecision",
      message: `Tag creation gate ${gateId} must keep tag creation and tag push blocked until future operator approval.`,
    });
  }

  const boundary = isRecord(record.tagCreationBoundary)
    ? record.tagCreationBoundary
    : {};
  const tagCreationBoundaryOk =
    boundary.gateOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.tagCreated === false &&
    boundary.tagPushed === false &&
    boundary.releaseCreated === false &&
    boundary.artifactsUploaded === false &&
    boundary.deploymentPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!tagCreationBoundaryOk) {
    findings.push({
      code: "tag_creation_boundary_breached",
      severity: "error",
      field: "tagCreationBoundary",
      message: `Tag creation gate ${gateId} must remain gate-only with no tag, push, release, upload, deployment, writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "tag_creation_execution_gate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Tag creation gate ${gateId} approvalStatus must be tag_creation_execution_gate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: TAG_CREATION_GATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    gateOnly: true as const,
    readyForTagCreationOperatorReview: ok,
    ...(ok
      ? {
          tagCreationGateClaim:
            "tag_creation_execution_gate_defined" as const,
        }
      : {}),
    status: statusFromFindings(findings),
    gatePath: options.gatePath,
    packageBuildGatePath,
    gate: {
      gateId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      releaseAction: asString(record.releaseAction),
      targetVersion: asString(record.targetVersion),
      tagName: asString(tagRequest.tagName),
      targetCommit: asString(tagRequest.targetCommit),
      nextBoundary: "artifact_upload_execution_gate_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
    },
    checks: {
      packageBuildGateOk,
      recordedPackageBuildGateOk,
      identityOk,
      releaseActionOk,
      tagRequestOk,
      tagPolicyReviewOk,
      sourceCommitEvidenceOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      releaseNotesLinkageOk,
      rollbackPlanOk,
      monitoringPlanOk,
      credentialBoundaryOk,
      tagCreationDecisionOk,
      tagCreationBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start artifact upload execution gate design"
      : "npm run release:tag-creation:gate:check -- --gate <path>",
    nextAction: ok
      ? "Tag creation gate is defined for operator review; tag creation, tag push, release creation, uploads, deployment, credentials, and production readiness claims remain blocked."
      : "Fix tag creation gate findings before designing artifact upload execution gates.",
  };
}
