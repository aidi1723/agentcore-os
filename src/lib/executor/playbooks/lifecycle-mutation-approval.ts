export const PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND =
  "playbook:lifecycle:mutation:approval:check";

export type PlaybookLifecycleMutationApprovalReceipt = {
  approvalId: string;
  evidencePath: string;
  approver: string;
  approvedAt: string;
  decision: "approved";
  approvalScope: "playbook_lifecycle_mutation";
  readiness: {
    command: string;
    status: "ready_for_lifecycle_maintenance";
    readyForLifecycleMaintenance: boolean;
    productionReady: boolean;
    publishingPerformed: boolean;
    readinessOnly: boolean;
  };
  mutationBoundary: {
    mutationApproved: boolean;
    executionPerformed: boolean;
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    allowedTargets: string[];
  };
};

type CurrentReadinessReport = {
  ok?: boolean;
  evidencePath?: string;
  readyForLifecycleMaintenance?: boolean;
  productionReady?: boolean;
  publishingPerformed?: boolean;
  readinessOnly?: boolean;
  status?: string;
  nextCommand?: string;
};

export type PlaybookLifecycleMutationApprovalFinding = {
  code:
    | "invalid_approval_shape"
    | "invalid_approval_decision"
    | "invalid_approval_scope"
    | "current_readiness_not_green"
    | "evidence_path_mismatch"
    | "invalid_readiness_boundary"
    | "invalid_mutation_boundary"
    | "mutation_boundary_breached";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

export type PlaybookLifecycleMutationApprovalReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  approvalOnly: true;
  approvedForLifecycleMutation: boolean;
  status:
    | "approved_for_lifecycle_mutation"
    | "approval_not_valid"
    | "readiness_not_green"
    | "mutation_boundary_breached";
  approvalPath?: string;
  evidencePath: string;
  approval: {
    approvalId: string;
    approver: string;
    approvedAt: string;
  };
  summary: {
    findings: number;
  };
  checks: {
    approvalShapeOk: boolean;
    decisionApproved: boolean;
    scopeOk: boolean;
    currentReadinessGreen: boolean;
    evidencePathMatches: boolean;
    embeddedReadinessBoundaryOk: boolean;
    mutationBoundaryOk: boolean;
  };
  findings: PlaybookLifecycleMutationApprovalFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleMutationApprovalOptions = {
  approvalPath?: string;
  currentReadinessReport: CurrentReadinessReport;
};

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

function missingStringFinding(
  approvalId: string,
  field: keyof PlaybookLifecycleMutationApprovalReceipt,
): PlaybookLifecycleMutationApprovalFinding {
  return {
    code: "invalid_approval_shape",
    severity: "error",
    field,
    message: `Lifecycle mutation approval ${approvalId} must include non-empty ${field}.`,
  };
}

function readinessCommand(evidencePath: string) {
  return `npm run playbook:lifecycle:maintenance:ready -- --evidence ${evidencePath}`;
}

function currentReadinessGreen(
  report: CurrentReadinessReport,
  evidencePath: string,
) {
  return (
    report.ok === true &&
    report.readyForLifecycleMaintenance === true &&
    report.status === "ready_for_lifecycle_maintenance" &&
    report.productionReady === false &&
    report.publishingPerformed === false &&
    report.readinessOnly === true &&
    report.evidencePath === evidencePath
  );
}

function embeddedReadinessBoundaryOk(
  readiness: Record<string, unknown>,
  evidencePath: string,
) {
  return (
    readiness.command === readinessCommand(evidencePath) &&
    readiness.status === "ready_for_lifecycle_maintenance" &&
    readiness.readyForLifecycleMaintenance === true &&
    readiness.productionReady === false &&
    readiness.publishingPerformed === false &&
    readiness.readinessOnly === true
  );
}

function mutationBoundaryChecks(boundary: Record<string, unknown>) {
  const allowedTargets = asStringArray(boundary.allowedTargets);
  const requiredFalseFields = [
    "executionPerformed",
    "fixtureRefreshPerformed",
    "storeWritesPerformed",
    "externalWritesPerformed",
    "publishingPerformed",
  ] as const;
  const breachedField = requiredFalseFields.find((field) => boundary[field] !== false);
  const valid =
    boundary.mutationApproved === true &&
    !breachedField &&
    allowedTargets.includes("registered_playbook_contract");

  return {
    valid,
    breachedField,
    allowedTargets,
  };
}

function statusFromFindings(findings: PlaybookLifecycleMutationApprovalFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("mutation_boundary_breached")) return "mutation_boundary_breached";
  if (
    codes.has("current_readiness_not_green") ||
    codes.has("evidence_path_mismatch")
  ) {
    return "readiness_not_green";
  }
  if (findings.length > 0) return "approval_not_valid";
  return "approved_for_lifecycle_mutation";
}

function actionForStatus(status: PlaybookLifecycleMutationApprovalReport["status"]) {
  if (status === "approved_for_lifecycle_mutation") {
    return "Approval receipt and current readiness are green for the next local lifecycle mutation review.";
  }
  if (status === "readiness_not_green") {
    return "Refresh lifecycle maintenance readiness before accepting this approval receipt.";
  }
  if (status === "mutation_boundary_breached") {
    return "Stop and review mutation boundary evidence before proceeding with lifecycle changes.";
  }
  return "Fix the lifecycle mutation approval receipt before proceeding.";
}

export function validatePlaybookLifecycleMutationApproval(
  approval: unknown,
  options: ValidatePlaybookLifecycleMutationApprovalOptions,
): PlaybookLifecycleMutationApprovalReport {
  const record = isRecord(approval) ? approval : {};
  const approvalId = asString(record.approvalId) || "unknown";
  const evidencePath = asString(record.evidencePath);
  const approver = asString(record.approver);
  const approvedAt = asString(record.approvedAt);
  const readiness = isRecord(record.readiness) ? record.readiness : {};
  const mutationBoundary = isRecord(record.mutationBoundary)
    ? record.mutationBoundary
    : {};
  const findings: PlaybookLifecycleMutationApprovalFinding[] = [];

  for (const field of [
    "approvalId",
    "evidencePath",
    "approver",
    "approvedAt",
    "decision",
    "approvalScope",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(approvalId, field));
    }
  }

  const decisionApproved = record.decision === "approved";
  if (!decisionApproved) {
    findings.push({
      code: "invalid_approval_decision",
      severity: "error",
      field: "decision",
      message: `Lifecycle mutation approval ${approvalId} decision must be approved.`,
    });
  }

  const scopeOk = record.approvalScope === "playbook_lifecycle_mutation";
  if (!scopeOk) {
    findings.push({
      code: "invalid_approval_scope",
      severity: "error",
      field: "approvalScope",
      message: `Lifecycle mutation approval ${approvalId} approvalScope must be playbook_lifecycle_mutation.`,
    });
  }

  const readinessGreen = currentReadinessGreen(
    options.currentReadinessReport,
    evidencePath,
  );
  if (!readinessGreen) {
    findings.push({
      code: "current_readiness_not_green",
      severity: "error",
      field: "currentReadinessReport",
      message: `Lifecycle mutation approval ${approvalId} requires current maintenance readiness to be green.`,
    });
  }

  const evidencePathMatches =
    options.currentReadinessReport.evidencePath === evidencePath;
  if (hasNonEmptyString(evidencePath) && !evidencePathMatches) {
    findings.push({
      code: "evidence_path_mismatch",
      severity: "error",
      field: "evidencePath",
      path: evidencePath,
      message: `Lifecycle mutation approval ${approvalId} evidencePath must match current readiness evidencePath.`,
    });
  }

  const embeddedBoundaryOk = embeddedReadinessBoundaryOk(readiness, evidencePath);
  if (!embeddedBoundaryOk) {
    findings.push({
      code: "invalid_readiness_boundary",
      severity: "error",
      field: "readiness",
      message: `Lifecycle mutation approval ${approvalId} must embed a green non-production readiness summary.`,
    });
  }

  const mutationChecks = mutationBoundaryChecks(mutationBoundary);
  if (mutationChecks.breachedField) {
    findings.push({
      code: "mutation_boundary_breached",
      severity: "error",
      field: `mutationBoundary.${mutationChecks.breachedField}`,
      message: `Lifecycle mutation approval ${approvalId} must not record ${mutationChecks.breachedField} before the approval gate.`,
    });
  } else if (!mutationChecks.valid) {
    findings.push({
      code: "invalid_mutation_boundary",
      severity: "error",
      field: "mutationBoundary",
      message: `Lifecycle mutation approval ${approvalId} must preserve the local mutation boundary.`,
    });
  }

  const approvalShapeOk = [
    "approvalId",
    "evidencePath",
    "approver",
    "approvedAt",
    "decision",
    "approvalScope",
  ].every((field) => hasNonEmptyString(record[field]));
  const status = statusFromFindings(findings);
  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_APPROVAL_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    approvalOnly: true,
    approvedForLifecycleMutation: ok,
    status,
    approvalPath: options.approvalPath,
    evidencePath,
    approval: {
      approvalId,
      approver,
      approvedAt,
    },
    summary: {
      findings: findings.length,
    },
    checks: {
      approvalShapeOk,
      decisionApproved,
      scopeOk,
      currentReadinessGreen: readinessGreen,
      evidencePathMatches,
      embeddedReadinessBoundaryOk: embeddedBoundaryOk,
      mutationBoundaryOk: mutationChecks.valid,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:handoff"
      : options.currentReadinessReport.nextCommand ?? readinessCommand(evidencePath),
    nextAction: actionForStatus(status),
  };
}
