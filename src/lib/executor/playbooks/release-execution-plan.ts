export const RELEASE_EXECUTION_PLAN_CHECK_COMMAND =
  "release:execution-plan:check";

export type ReleaseExecutionPlanCommandEvidence = {
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

export type ReleaseExecutionPlanFinding = {
  code:
    | "invalid_plan_shape"
    | "invalid_production_release_approval"
    | "invalid_owner_identity"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "release_action_planning_metadata_missing"
    | "release_action_planned_execution_breached"
    | "release_action_credential_or_readiness_breached"
    | "preconditions_missing"
    | "rollback_plan_missing"
    | "monitoring_plan_missing"
    | "credential_boundary_breached"
    | "execution_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type ValidateReleaseExecutionPlanOptions = {
  planPath?: string;
  approvalReport: GateReport;
};

const RELEASE_ACTIONS = [
  "packaging",
  "tagCreation",
  "artifactUpload",
  "deployment",
  "externalWrites",
];

const DEFAULT_PRODUCTION_POLICY_PATH =
  "docs/release-policies/example-production-release-policy.json";

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
): ReleaseExecutionPlanCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ReleaseExecutionPlanCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(approvalPath: string, productionPolicyPath: string) {
  return [
    `npm run release:production-approval:check -- --approval ${approvalPath}`,
    `npm run release:production-policy:check -- --policy ${productionPolicyPath}`,
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: ReleaseExecutionPlanCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: ReleaseExecutionPlanCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  planId: string,
  field: string,
): ReleaseExecutionPlanFinding {
  return {
    code: "invalid_plan_shape",
    severity: "error",
    field,
    message: `Release execution plan ${planId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: ReleaseExecutionPlanFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_production_release_approval")) {
    return "production_release_approval_not_green";
  }
  if (findings.length > 0) {
    return "release_execution_plan_not_ready";
  }
  return "release_execution_plan_ready";
}

function plannedActionMetadataOk(actions: Record<string, unknown>) {
  return RELEASE_ACTIONS.every((name) => {
    const action = actions[name];
    if (!isRecord(action)) return false;
    return (
      hasNonEmptyString(action.owner) &&
      hasNonEmptyString(action.executionGate) &&
      hasNonEmptyString(action.executionCommand) &&
      action.executionCommandDeclared === true &&
      action.executionGateRequired === true &&
      action.rollbackStepDocumented === true &&
      action.monitoringStepDocumented === true &&
      asStringArray(action.notes).length > 0
    );
  });
}

function releaseActionExecutionBreached(actions: Record<string, unknown>) {
  return RELEASE_ACTIONS.some((name) => {
    const action = actions[name];
    return (
      isRecord(action) &&
      (action.executed === true || action.approvedForExecution === true)
    );
  });
}

function releaseActionCredentialOrReadinessBreached(
  actions: Record<string, unknown>,
) {
  return RELEASE_ACTIONS.some((name) => {
    const action = actions[name];
    return (
      isRecord(action) &&
      (action.credentialUseAllowed === true ||
        action.productionReadinessClaimed === true)
    );
  });
}

export function validateReleaseExecutionPlan(
  plan: unknown,
  options: ValidateReleaseExecutionPlanOptions,
) {
  const record = isRecord(plan) ? plan : {};
  const planId = asString(record.planId) || "unknown";
  const approvalPath = asString(record.approvalPath);
  const productionPolicyPath =
    asString(record.productionPolicyPath) ||
    asString(options.approvalReport.productionPolicyPath) ||
    DEFAULT_PRODUCTION_POLICY_PATH;
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(approvalPath, productionPolicyPath);
  const findings: ReleaseExecutionPlanFinding[] = [];

  for (const field of [
    "planId",
    "approvalPath",
    "recordedAt",
    "targetVersion",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(planId, field));
    }
  }

  const productionApprovalOk =
    options.approvalReport.ok === true &&
    options.approvalReport.readyForReleaseExecutionPlanning === true &&
    options.approvalReport.approvalClaim ===
      "production_release_approval_packet_defined" &&
    options.approvalReport.approvalPacketOnly === true &&
    options.approvalReport.productionReady === false &&
    options.approvalReport.publishingPerformed === false;
  if (!productionApprovalOk) {
    findings.push({
      code: "invalid_production_release_approval",
      severity: "error",
      path: approvalPath,
      message: `Release execution plan ${planId} requires green production release approval packet evidence.`,
    });
  }

  const owner = isRecord(record.owner) ? record.owner : {};
  const identityOk =
    hasNonEmptyString(owner.id) &&
    hasNonEmptyString(owner.name) &&
    owner.role === "release_execution_planner";
  if (!identityOk) {
    findings.push({
      code: "invalid_owner_identity",
      severity: "error",
      field: "owner",
      message: `Release execution plan ${planId} must include owner id, name, and release_execution_planner role.`,
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
      message: `Release execution plan ${planId} commandEvidence must match the required commands in order.`,
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
      message: `Release execution plan ${planId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const approvalEntry = commandByName(commandEvidence, requiredCommands[0]);
  const policyEntry = commandByName(commandEvidence, requiredCommands[1]);
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
    approvalEntry?.gate === "production_release_approval_green" &&
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
      message: `Release execution plan ${planId} commandEvidence must include approval, policy, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const plannedActions = isRecord(record.plannedActions)
    ? record.plannedActions
    : {};
  const plannedActionsOk = plannedActionMetadataOk(plannedActions);
  if (!plannedActionsOk) {
    findings.push({
      code: "release_action_planning_metadata_missing",
      severity: "error",
      field: "plannedActions",
      message: `Release execution plan ${planId} must define planning metadata for packaging, tag creation, upload, deployment, and external writes.`,
    });
  }

  const releaseActionsBlocked = !releaseActionExecutionBreached(plannedActions);
  if (!releaseActionsBlocked) {
    findings.push({
      code: "release_action_planned_execution_breached",
      severity: "error",
      field: "plannedActions",
      message: `Release execution plan ${planId} must not execute or approve release actions.`,
    });
  }

  const credentialAndReadinessBlocked =
    !releaseActionCredentialOrReadinessBreached(plannedActions);
  if (!credentialAndReadinessBlocked) {
    findings.push({
      code: "release_action_credential_or_readiness_breached",
      severity: "error",
      field: "plannedActions",
      message: `Release execution plan ${planId} must not allow credential use or claim production readiness for any planned action.`,
    });
  }

  const preconditions = isRecord(record.preconditions)
    ? record.preconditions
    : {};
  const preconditionsOk =
    preconditions.approvalPacketGreen === true &&
    preconditions.productionPolicyGreen === true &&
    preconditions.controlledRuntimeGreen === true &&
    preconditions.coreWorkflowsGreen === true &&
    preconditions.localDiffClean === true;
  if (!preconditionsOk) {
    findings.push({
      code: "preconditions_missing",
      severity: "error",
      field: "preconditions",
      message: `Release execution plan ${planId} must record green approval, policy, runtime, workflow, and diff preconditions.`,
    });
  }

  const rollbackPlan = isRecord(record.rollbackPlan)
    ? record.rollbackPlan
    : {};
  const rollbackPlanOk =
    hasNonEmptyString(rollbackPlan.owner) &&
    rollbackPlan.documented === true &&
    rollbackPlan.rollbackCommandsDeclared === true &&
    rollbackPlan.executed === false;
  if (!rollbackPlanOk) {
    findings.push({
      code: "rollback_plan_missing",
      severity: "error",
      field: "rollbackPlan",
      message: `Release execution plan ${planId} must document rollback ownership and commands without executing them.`,
    });
  }

  const monitoringPlan = isRecord(record.monitoringPlan)
    ? record.monitoringPlan
    : {};
  const monitoringPlanOk =
    hasNonEmptyString(monitoringPlan.owner) &&
    monitoringPlan.documented === true &&
    monitoringPlan.monitoringCommandsDeclared === true &&
    monitoringPlan.executed === false;
  if (!monitoringPlanOk) {
    findings.push({
      code: "monitoring_plan_missing",
      severity: "error",
      field: "monitoringPlan",
      message: `Release execution plan ${planId} must document monitoring ownership and commands without executing them.`,
    });
  }

  const credentialBoundary = isRecord(record.credentialBoundary)
    ? record.credentialBoundary
    : {};
  const credentialBoundaryOk =
    credentialBoundary.credentialsRequiredForPlanning === false &&
    credentialBoundary.credentialsUsed === false &&
    credentialBoundary.credentialUseApproved === false &&
    credentialBoundary.secretMaterialRecorded === false;
  if (!credentialBoundaryOk) {
    findings.push({
      code: "credential_boundary_breached",
      severity: "error",
      field: "credentialBoundary",
      message: `Release execution plan ${planId} must not require, use, approve, or record credentials during planning.`,
    });
  }

  const boundary = isRecord(record.executionBoundary)
    ? record.executionBoundary
    : {};
  const executionBoundaryOk =
    boundary.planningOnly === true &&
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
  if (!executionBoundaryOk) {
    findings.push({
      code: "execution_boundary_breached",
      severity: "error",
      field: "executionBoundary",
      message: `Release execution plan ${planId} must remain planning-only with no commands, publishing, tag, package, upload, deployment, writes, credentials, production readiness, or readiness claim.`,
    });
  }

  const recordedApproval = isRecord(record.productionReleaseApprovalResult)
    ? record.productionReleaseApprovalResult
    : {};
  const recordedApprovalBoundaryOk =
    recordedApproval.ok === true &&
    recordedApproval.approvalPacketOnly === true &&
    recordedApproval.approvalClaim ===
      "production_release_approval_packet_defined" &&
    recordedApproval.productionReady === false &&
    recordedApproval.publishingPerformed === false;
  if (!recordedApprovalBoundaryOk) {
    findings.push({
      code: "invalid_production_release_approval",
      severity: "error",
      field: "productionReleaseApprovalResult",
      message: `Release execution plan ${planId} must record the production approval packet as green, approval-packet-only, non-publishing, and non-production.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "release_execution_planning";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Release execution plan ${planId} approvalStatus must be release_execution_planning.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: RELEASE_EXECUTION_PLAN_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    planningOnly: true as const,
    readyForReleaseExecutionGateDesign: ok,
    ...(ok ? { executionPlanClaim: "release_execution_plan_defined" as const } : {}),
    status: statusFromFindings(findings),
    planPath: options.planPath,
    approvalPath,
    productionPolicyPath,
    plan: {
      planId,
      ownerId: asString(owner.id),
      ownerRole: asString(owner.role),
      targetVersion: asString(record.targetVersion),
      nextBoundary: "individual_release_execution_gate_design",
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
      plannedActions: RELEASE_ACTIONS.length,
    },
    checks: {
      productionApprovalOk,
      identityOk,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      plannedActionsOk,
      releaseActionsBlocked,
      credentialAndReadinessBlocked,
      preconditionsOk,
      rollbackPlanOk,
      monitoringPlanOk,
      credentialBoundaryOk,
      executionBoundaryOk,
      recordedApprovalBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start individual release execution gate design"
      : "npm run release:execution-plan:check -- --plan <path>",
    nextAction: ok
      ? "Release execution planning is defined; package build, tag creation, artifact upload, deployment, external writes, credentials, and production readiness claims remain separate execution gates."
      : "Fix release execution plan findings before designing action-family execution gates.",
  };
}
