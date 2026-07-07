export const PRODUCTION_RELEASE_POLICY_CHECK_COMMAND =
  "release:production-policy:check";

export type ProductionReleasePolicyCommandEvidence = {
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

export type ProductionReleasePolicyFinding = {
  code:
    | "invalid_policy_shape"
    | "invalid_delivery_candidate"
    | "release_policy_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "policy_sections_missing"
    | "release_policy_action_approved_or_executed"
    | "monitoring_or_rollback_policy_missing"
    | "risk_summary_missing"
    | "rollback_summary_missing"
    | "invalid_delivery_candidate_boundary"
    | "release_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateProductionReleasePolicyOptions = {
  policyPath?: string;
  deliveryCandidateReport: GateReport;
};

const RELEASE_ACTION_SECTIONS = [
  "packaging",
  "tagCreation",
  "artifactUpload",
  "deployment",
  "externalWrites",
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

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asCommandEvidence(
  value: unknown,
): ProductionReleasePolicyCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProductionReleasePolicyCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(deliveryCandidatePath: string) {
  return [
    `npm run delivery:candidate:check -- --candidate ${deliveryCandidatePath}`,
    "npm run release:hygiene:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ProductionReleasePolicyCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ProductionReleasePolicyCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  policyId: string,
  field: string,
): ProductionReleasePolicyFinding {
  return {
    code: "invalid_policy_shape",
    severity: "error",
    field,
    message: `Production release policy ${policyId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ProductionReleasePolicyFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_delivery_candidate")) {
    return "delivery_candidate_not_green";
  }
  if (findings.length > 0) return "production_release_policy_not_ready";
  return "production_release_policy_ready";
}

function releaseActionSectionsOk(policySections: Record<string, unknown>) {
  return RELEASE_ACTION_SECTIONS.every((name) => {
    const section = policySections[name];
    if (!isRecord(section)) return false;
    return (
      hasNonEmptyString(section.owner) &&
      section.approvalRequired === true &&
      section.approved === false &&
      section.executed === false &&
      section.policyDocumented === true
    );
  });
}

function releaseActionApprovedOrExecuted(policySections: Record<string, unknown>) {
  return RELEASE_ACTION_SECTIONS.some((name) => {
    const section = policySections[name];
    return (
      isRecord(section) &&
      (section.approved === true || section.executed === true)
    );
  });
}

export function validateProductionReleasePolicy(
  policy: unknown,
  options: ValidateProductionReleasePolicyOptions,
) {
  const record = isRecord(policy) ? policy : {};
  const policyId = asString(record.policyId) || "unknown";
  const deliveryCandidatePath = asString(record.deliveryCandidatePath);
  const owner = asString(record.owner);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(deliveryCandidatePath);
  const findings: ProductionReleasePolicyFinding[] = [];

  for (const field of [
    "policyId",
    "deliveryCandidatePath",
    "owner",
    "recordedAt",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(policyId, field));
    }
  }

  const deliveryCandidateOk =
    options.deliveryCandidateReport.ok === true &&
    options.deliveryCandidateReport.readyForLocalDeliveryCandidate === true &&
    options.deliveryCandidateReport.deliveryClaim ===
      "local_delivery_candidate_ready" &&
    options.deliveryCandidateReport.candidateOnly === true &&
    options.deliveryCandidateReport.productionReady === false &&
    options.deliveryCandidateReport.publishingPerformed === false;
  if (!deliveryCandidateOk) {
    findings.push({
      code: "invalid_delivery_candidate",
      severity: "error",
      path: deliveryCandidatePath,
      message: `Production release policy ${policyId} requires green local delivery candidate evidence.`,
    });
  }

  const releasePolicy = isRecord(record.productionReleasePolicy)
    ? record.productionReleasePolicy
    : {};
  const releasePolicyComplete =
    hasNonEmptyString(releasePolicy.targetVersion) &&
    releasePolicy.targetEnvironment === "production" &&
    hasNonEmptyString(releasePolicy.releaseType) &&
    releasePolicy.sourceDeliveryCandidateClaim ===
      "local_delivery_candidate_ready" &&
    releasePolicy.releaseDecision ===
      "blocked_until_explicit_production_approval" &&
    hasNonEmptyString(releasePolicy.nextBoundary);
  if (!releasePolicyComplete) {
    findings.push({
      code: "release_policy_missing",
      severity: "error",
      field: "productionReleasePolicy",
      message: `Production release policy ${policyId} must record target version, production environment, release type, source candidate claim, blocked decision, and next boundary.`,
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
      message: `Production release policy ${policyId} commandEvidence must match the required commands in order.`,
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
      message: `Production release policy ${policyId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const candidateEntry = commandByName(commandEvidence, requiredCommands[0]);
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
    candidateEntry?.gate === "delivery_candidate_green" &&
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
      message: `Production release policy ${policyId} commandEvidence must include candidate, hygiene, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const policySections = isRecord(record.policySections)
    ? record.policySections
    : {};
  const policySectionsOk = releaseActionSectionsOk(policySections);
  if (!policySectionsOk) {
    findings.push({
      code: "policy_sections_missing",
      severity: "error",
      field: "policySections",
      message: `Production release policy ${policyId} must define gated packaging, tag, artifact upload, deployment, and external write sections.`,
    });
  }

  const releaseActionBlocked = !releaseActionApprovedOrExecuted(policySections);
  if (!releaseActionBlocked) {
    findings.push({
      code: "release_policy_action_approved_or_executed",
      severity: "error",
      field: "policySections",
      message: `Production release policy ${policyId} must not approve or execute packaging, tag, upload, deployment, or external write actions.`,
    });
  }

  const monitoring = isRecord(policySections.monitoring)
    ? policySections.monitoring
    : {};
  const rollback = isRecord(policySections.rollback)
    ? policySections.rollback
    : {};
  const monitoringAndRollbackOk =
    hasNonEmptyString(monitoring.owner) &&
    monitoring.readinessDocumented === true &&
    monitoring.executed === false &&
    hasNonEmptyString(rollback.owner) &&
    rollback.rollbackDocumented === true &&
    rollback.executed === false &&
    asStringArray(rollback.rollbackNotes).length > 0;
  if (!monitoringAndRollbackOk) {
    findings.push({
      code: "monitoring_or_rollback_policy_missing",
      severity: "error",
      field: "policySections",
      message: `Production release policy ${policyId} must document monitoring and rollback policy sections without executing them.`,
    });
  }

  const risk = isRecord(record.riskSummary) ? record.riskSummary : {};
  const riskSummaryOk =
    risk.productionReady === false &&
    risk.publishingApproved === false &&
    risk.tagApproved === false &&
    risk.packageApproved === false &&
    risk.uploadApproved === false &&
    risk.deploymentApproved === false &&
    risk.externalWritesApproved === false &&
    risk.credentialUseApproved === false &&
    asStringArray(risk.deferredItems).length > 0;
  if (!riskSummaryOk) {
    findings.push({
      code: "risk_summary_missing",
      severity: "error",
      field: "riskSummary",
      message: `Production release policy ${policyId} must keep release actions, credentials, external writes, and production readiness disabled with deferred approvals recorded.`,
    });
  }

  const rollbackSummary = isRecord(record.rollbackSummary)
    ? record.rollbackSummary
    : {};
  const rollbackSummaryOk =
    rollbackSummary.rollbackAvailable === true &&
    asStringArray(rollbackSummary.rollbackNotes).length > 0;
  if (!rollbackSummaryOk) {
    findings.push({
      code: "rollback_summary_missing",
      severity: "error",
      field: "rollbackSummary",
      message: `Production release policy ${policyId} must record rollback availability and rollback notes.`,
    });
  }

  const recordedCandidate = isRecord(record.deliveryCandidateResult)
    ? record.deliveryCandidateResult
    : {};
  const deliveryCandidateBoundaryOk =
    recordedCandidate.ok === true &&
    recordedCandidate.candidateOnly === true &&
    recordedCandidate.deliveryClaim === "local_delivery_candidate_ready" &&
    recordedCandidate.productionReady === false &&
    recordedCandidate.publishingPerformed === false;
  if (!deliveryCandidateBoundaryOk) {
    findings.push({
      code: "invalid_delivery_candidate_boundary",
      severity: "error",
      field: "deliveryCandidateResult",
      message: `Production release policy ${policyId} must record the delivery candidate as green, candidate-only, non-publishing, and non-production.`,
    });
  }

  const boundary = isRecord(record.releaseBoundary)
    ? record.releaseBoundary
    : {};
  const releaseBoundaryOk =
    boundary.policyOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.publishingPerformed === false &&
    boundary.tagCreated === false &&
    boundary.packageBuilt === false &&
    boundary.uploadPerformed === false &&
    boundary.deploymentPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.credentialsUsed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!releaseBoundaryOk) {
    findings.push({
      code: "release_boundary_breached",
      severity: "error",
      field: "releaseBoundary",
      message: `Production release policy ${policyId} must remain policy-only with no commands, publishing, tag, package, upload, deployment, writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "production_release_policy_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Production release policy ${policyId} approvalStatus must be production_release_policy_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PRODUCTION_RELEASE_POLICY_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    policyOnly: true as const,
    readyForProductionReleasePolicyReview: ok,
    ...(ok ? { policyClaim: "production_release_policy_defined" as const } : {}),
    status: statusFromFindings(findings),
    policyPath: options.policyPath,
    deliveryCandidatePath,
    policy: {
      policyId,
      owner,
      targetVersion: asString(releasePolicy.targetVersion),
      targetEnvironment: asString(releasePolicy.targetEnvironment),
      nextBoundary: asString(releasePolicy.nextBoundary),
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
      releaseActionSections: RELEASE_ACTION_SECTIONS.length,
      deferredItems: asStringArray(risk.deferredItems).length,
    },
    checks: {
      deliveryCandidateOk,
      releasePolicyComplete,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      policySectionsOk,
      releaseActionBlocked,
      monitoringAndRollbackOk,
      riskSummaryOk,
      rollbackSummaryOk,
      deliveryCandidateBoundaryOk,
      releaseBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start production release approval packet"
      : "npm run release:production-policy:check -- --policy <path>",
    nextAction: ok
      ? "Production release policy is defined for review; release execution, packaging, tags, uploads, deployment, external writes, credentials, and production readiness claims remain separate approval phases."
      : "Fix production release policy findings before preparing an approval packet.",
  };
}
