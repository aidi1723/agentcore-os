export const PRODUCTION_RELEASE_APPROVAL_CHECK_COMMAND =
  "release:production-approval:check";

export type ProductionReleaseApprovalCommandEvidence = {
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

export type ProductionReleaseApprovalFinding = {
  code:
    | "invalid_approval_shape"
    | "invalid_production_policy"
    | "invalid_reviewer_identity"
    | "invalid_approval_scope"
    | "invalid_approval_expiry"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "release_action_decisions_missing"
    | "release_action_decision_executed_or_over_authorized"
    | "approval_owners_missing"
    | "risk_acceptance_missing"
    | "invalid_policy_boundary"
    | "approval_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateProductionReleaseApprovalOptions = {
  approvalPath?: string;
  productionPolicyReport: GateReport;
};

const RELEASE_ACTIONS = [
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

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asCommandEvidence(
  value: unknown,
): ProductionReleaseApprovalCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProductionReleaseApprovalCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(productionPolicyPath: string) {
  return [
    `npm run release:production-policy:check -- --policy ${productionPolicyPath}`,
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ProductionReleaseApprovalCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ProductionReleaseApprovalCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  approvalId: string,
  field: string,
): ProductionReleaseApprovalFinding {
  return {
    code: "invalid_approval_shape",
    severity: "error",
    field,
    message: `Production release approval ${approvalId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ProductionReleaseApprovalFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_production_policy")) {
    return "production_release_policy_not_green";
  }
  if (findings.length > 0) {
    return "production_release_approval_packet_not_ready";
  }
  return "production_release_approval_packet_ready";
}

function validDate(value: unknown) {
  if (!hasNonEmptyString(value)) return Number.NaN;
  return Date.parse(value);
}

function releaseActionDecisionsOk(decisions: Record<string, unknown>) {
  return RELEASE_ACTIONS.every((name) => {
    const decision = decisions[name];
    if (!isRecord(decision)) return false;
    return (
      decision.decision === "blocked_until_execution_gate" &&
      decision.approvalRequired === true &&
      decision.executionGateRequired === true &&
      decision.executed === false &&
      hasNonEmptyString(decision.owner) &&
      asStringArray(decision.notes).length > 0
    );
  });
}

function releaseActionExecutedOrOverAuthorized(
  decisions: Record<string, unknown>,
) {
  return RELEASE_ACTIONS.some((name) => {
    const decision = decisions[name];
    return (
      isRecord(decision) &&
      (decision.executed === true ||
        decision.decision !== "blocked_until_execution_gate" ||
        decision.executionGateRequired !== true)
    );
  });
}

export function validateProductionReleaseApprovalPacket(
  approval: unknown,
  options: ValidateProductionReleaseApprovalOptions,
) {
  const record = isRecord(approval) ? approval : {};
  const approvalId = asString(record.approvalId) || "unknown";
  const productionPolicyPath = asString(record.productionPolicyPath);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(productionPolicyPath);
  const findings: ProductionReleaseApprovalFinding[] = [];

  for (const field of [
    "approvalId",
    "productionPolicyPath",
    "recordedAt",
    "expiresAt",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(approvalId, field));
    }
  }

  const productionPolicyOk =
    options.productionPolicyReport.ok === true &&
    options.productionPolicyReport.readyForProductionReleasePolicyReview ===
      true &&
    options.productionPolicyReport.policyClaim ===
      "production_release_policy_defined" &&
    options.productionPolicyReport.policyOnly === true &&
    options.productionPolicyReport.productionReady === false &&
    options.productionPolicyReport.publishingPerformed === false;
  if (!productionPolicyOk) {
    findings.push({
      code: "invalid_production_policy",
      severity: "error",
      path: productionPolicyPath,
      message: `Production release approval ${approvalId} requires green production release policy evidence.`,
    });
  }

  const reviewer = isRecord(record.reviewer) ? record.reviewer : {};
  const identityOk =
    hasNonEmptyString(reviewer.id) &&
    hasNonEmptyString(reviewer.name) &&
    reviewer.role === "release_reviewer";
  if (!identityOk) {
    findings.push({
      code: "invalid_reviewer_identity",
      severity: "error",
      field: "reviewer",
      message: `Production release approval ${approvalId} must include reviewer id, name, and release_reviewer role.`,
    });
  }

  const approvalScopeOk =
    record.approvalScope === "production_release_approval_packet";
  if (!approvalScopeOk) {
    findings.push({
      code: "invalid_approval_scope",
      severity: "error",
      field: "approvalScope",
      message: `Production release approval ${approvalId} must use production_release_approval_packet scope.`,
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
      message: `Production release approval ${approvalId} must expire after recordedAt.`,
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
      message: `Production release approval ${approvalId} commandEvidence must match the required commands in order.`,
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
      message: `Production release approval ${approvalId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const policyEntry = commandByName(commandEvidence, requiredCommands[0]);
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
    policyEntry?.gate === "production_release_policy_green" &&
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
      message: `Production release approval ${approvalId} commandEvidence must include policy, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const releaseActionDecisions = isRecord(record.releaseActionDecisions)
    ? record.releaseActionDecisions
    : {};
  const decisionsOk = releaseActionDecisionsOk(releaseActionDecisions);
  if (!decisionsOk) {
    findings.push({
      code: "release_action_decisions_missing",
      severity: "error",
      field: "releaseActionDecisions",
      message: `Production release approval ${approvalId} must define blocked decisions for packaging, tag creation, upload, deployment, and external writes.`,
    });
  }

  const releaseActionsBlocked = !releaseActionExecutedOrOverAuthorized(
    releaseActionDecisions,
  );
  if (!releaseActionsBlocked) {
    findings.push({
      code: "release_action_decision_executed_or_over_authorized",
      severity: "error",
      field: "releaseActionDecisions",
      message: `Production release approval ${approvalId} must not execute or immediately authorize release actions.`,
    });
  }

  const rollbackOwner = isRecord(record.rollbackOwner)
    ? record.rollbackOwner
    : {};
  const monitoringOwner = isRecord(record.monitoringOwner)
    ? record.monitoringOwner
    : {};
  const ownersOk =
    hasNonEmptyString(rollbackOwner.owner) &&
    hasNonEmptyString(rollbackOwner.contact) &&
    rollbackOwner.rollbackPlanDocumented === true &&
    hasNonEmptyString(monitoringOwner.owner) &&
    hasNonEmptyString(monitoringOwner.contact) &&
    monitoringOwner.monitoringPlanDocumented === true;
  if (!ownersOk) {
    findings.push({
      code: "approval_owners_missing",
      severity: "error",
      field: "rollbackOwner",
      message: `Production release approval ${approvalId} must record rollback and monitoring owners with documented plans.`,
    });
  }

  const risk = isRecord(record.riskAcceptance) ? record.riskAcceptance : {};
  const riskAcceptanceOk =
    risk.acceptedForExecutionPlanning === true &&
    risk.productionReady === false &&
    risk.publishingApproved === false &&
    risk.tagApproved === false &&
    risk.packageApproved === false &&
    risk.uploadApproved === false &&
    risk.deploymentApproved === false &&
    risk.externalWritesApproved === false &&
    risk.credentialUseApproved === false &&
    asStringArray(risk.deferredExecutionGates).length > 0;
  if (!riskAcceptanceOk) {
    findings.push({
      code: "risk_acceptance_missing",
      severity: "error",
      field: "riskAcceptance",
      message: `Production release approval ${approvalId} must accept only execution planning risk and defer all release execution gates.`,
    });
  }

  const recordedPolicy = isRecord(record.productionReleasePolicyResult)
    ? record.productionReleasePolicyResult
    : {};
  const policyBoundaryOk =
    recordedPolicy.ok === true &&
    recordedPolicy.policyOnly === true &&
    recordedPolicy.policyClaim === "production_release_policy_defined" &&
    recordedPolicy.productionReady === false &&
    recordedPolicy.publishingPerformed === false;
  if (!policyBoundaryOk) {
    findings.push({
      code: "invalid_policy_boundary",
      severity: "error",
      field: "productionReleasePolicyResult",
      message: `Production release approval ${approvalId} must record the production policy as green, policy-only, non-publishing, and non-production.`,
    });
  }

  const boundary = isRecord(record.approvalBoundary)
    ? record.approvalBoundary
    : {};
  const approvalBoundaryOk =
    boundary.approvalPacketOnly === true &&
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
  if (!approvalBoundaryOk) {
    findings.push({
      code: "approval_boundary_breached",
      severity: "error",
      field: "approvalBoundary",
      message: `Production release approval ${approvalId} must remain approval-packet-only with no commands, publishing, tag, package, upload, deployment, writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "approved_for_release_execution_planning";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Production release approval ${approvalId} approvalStatus must be approved_for_release_execution_planning.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PRODUCTION_RELEASE_APPROVAL_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    approvalPacketOnly: true as const,
    readyForReleaseExecutionPlanning: ok,
    ...(ok
      ? { approvalClaim: "production_release_approval_packet_defined" as const }
      : {}),
    status: statusFromFindings(findings),
    approvalPath: options.approvalPath,
    productionPolicyPath,
    approval: {
      approvalId,
      reviewerId: asString(reviewer.id),
      reviewerRole: asString(reviewer.role),
      approvalScope: asString(record.approvalScope),
      expiresAt: asString(record.expiresAt),
      nextBoundary: "release_execution_planning_gates",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
      releaseActionDecisions: RELEASE_ACTIONS.length,
      deferredExecutionGates: asStringArray(risk.deferredExecutionGates).length,
    },
    checks: {
      productionPolicyOk,
      identityOk,
      approvalScopeOk,
      expiryOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      releaseActionDecisionsOk: decisionsOk,
      releaseActionsBlocked,
      ownersOk,
      riskAcceptanceOk,
      policyBoundaryOk,
      approvalBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start release execution planning gates"
      : "npm run release:production-approval:check -- --approval <path>",
    nextAction: ok
      ? "Production release approval packet is defined for execution planning; packaging, tags, uploads, deployment, external writes, credentials, and production readiness claims remain separate execution gates."
      : "Fix production release approval packet findings before preparing execution planning gates.",
  };
}
