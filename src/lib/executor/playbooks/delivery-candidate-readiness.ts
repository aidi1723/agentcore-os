export const DELIVERY_CANDIDATE_CHECK_COMMAND = "delivery:candidate:check";

export type DeliveryCandidateCommandEvidence = {
  command: string;
  ok: boolean;
  exitCode: number;
  recordedAt: string;
  gate?: string;
  releaseClaim?: string;
  testFiles?: number;
  tests?: number;
  warningCount?: number;
  knownWarnings?: string[];
};

export type DeliveryCandidateReadinessFinding = {
  code:
    | "invalid_candidate_shape"
    | "invalid_handoff_summary"
    | "invalid_delivery_ready"
    | "delivery_candidate_missing"
    | "invalid_command_evidence_sequence"
    | "command_evidence_not_green"
    | "invalid_command_evidence_metadata"
    | "documentation_summary_missing"
    | "risk_summary_missing"
    | "rollback_summary_missing"
    | "invalid_recorded_gate_boundary"
    | "delivery_candidate_boundary_breached"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type DeliveryCandidateReadinessOptions = {
  candidatePath?: string;
  handoffSummaryReport: GateReport;
  deliveryReadyReport: GateReport;
};

const REQUIRED_DOC_FILES = [
  "README.md",
  "CHANGELOG.md",
  "docs/NEXT_STEPS.md",
  "docs/PROJECT_FRAMEWORK.zh-CN.md",
  "docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md",
  "docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md",
  "docs/DOCUMENTATION_INDEX.zh-CN.md",
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

function asCommandEvidence(value: unknown): DeliveryCandidateCommandEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DeliveryCandidateCommandEvidence => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function expectedCommands(handoffSummaryPath: string) {
  return [
    `npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary ${handoffSummaryPath}`,
    "npm run delivery:ready:check",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  evidence: DeliveryCandidateCommandEvidence[],
  expected: string[],
) {
  if (evidence.length !== expected.length) return false;
  return expected.every((command, index) => evidence[index]?.command === command);
}

function commandByName(
  commandEvidence: DeliveryCandidateCommandEvidence[],
  command: string,
) {
  return commandEvidence.find((entry) => entry.command === command);
}

function missingStringFinding(
  candidateId: string,
  field: string,
): DeliveryCandidateReadinessFinding {
  return {
    code: "invalid_candidate_shape",
    severity: "error",
    field,
    message: `Delivery candidate ${candidateId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(findings: DeliveryCandidateReadinessFinding[]) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_handoff_summary")) return "handoff_summary_not_green";
  if (codes.has("invalid_delivery_ready")) return "delivery_ready_not_green";
  if (findings.length > 0) return "delivery_candidate_not_ready";
  return "local_delivery_candidate_ready";
}

export function validateDeliveryCandidateReadiness(
  candidate: unknown,
  options: DeliveryCandidateReadinessOptions,
) {
  const record = isRecord(candidate) ? candidate : {};
  const candidateId = asString(record.candidateId) || "unknown";
  const handoffSummaryPath = asString(record.handoffSummaryPath);
  const owner = asString(record.owner);
  const commandEvidence = asCommandEvidence(record.commandEvidence);
  const requiredCommands = expectedCommands(handoffSummaryPath);
  const findings: DeliveryCandidateReadinessFinding[] = [];

  for (const field of [
    "candidateId",
    "handoffSummaryPath",
    "owner",
    "recordedAt",
  ]) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(candidateId, field));
    }
  }

  const handoffSummaryOk =
    options.handoffSummaryReport.ok === true &&
    options.handoffSummaryReport.readyForMaintainerHandoffSummary === true &&
    options.handoffSummaryReport.summaryOnly === true &&
    options.handoffSummaryReport.productionReady === false &&
    options.handoffSummaryReport.publishingPerformed === false;
  if (!handoffSummaryOk) {
    findings.push({
      code: "invalid_handoff_summary",
      severity: "error",
      path: handoffSummaryPath,
      message: `Delivery candidate ${candidateId} requires green handoff summary evidence.`,
    });
  }

  const deliveryReadyOk =
    options.deliveryReadyReport.ok === true &&
    options.deliveryReadyReport.releaseClaim === "local_delivery_demo_ready" &&
    options.deliveryReadyReport.productionReady === false &&
    options.deliveryReadyReport.publishingPerformed !== true;
  if (!deliveryReadyOk) {
    findings.push({
      code: "invalid_delivery_ready",
      severity: "error",
      command: "npm run delivery:ready:check",
      message: `Delivery candidate ${candidateId} requires green local delivery readiness without production or publishing claims.`,
    });
  }

  const deliveryCandidate = isRecord(record.deliveryCandidate)
    ? record.deliveryCandidate
    : {};
  const deliveryCandidateComplete =
    hasNonEmptyString(deliveryCandidate.targetMilestone) &&
    deliveryCandidate.deliveryClaim === "local_delivery_candidate_ready" &&
    deliveryCandidate.sourceHandoffClaim === "local_release_handoff_ready" &&
    hasNonEmptyString(deliveryCandidate.nextBoundary);
  if (!deliveryCandidateComplete) {
    findings.push({
      code: "delivery_candidate_missing",
      severity: "error",
      field: "deliveryCandidate",
      message: `Delivery candidate ${candidateId} must record milestone, local candidate claim, source handoff claim, and next boundary.`,
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
      message: `Delivery candidate ${candidateId} commandEvidence must match the required commands in order.`,
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
      message: `Delivery candidate ${candidateId} commandEvidence entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const handoffEntry = commandByName(commandEvidence, requiredCommands[0]);
  const deliveryReadyEntry = commandByName(
    commandEvidence,
    "npm run delivery:ready:check",
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
    handoffEntry?.gate === "handoff_summary_green" &&
    deliveryReadyEntry?.releaseClaim === "local_delivery_demo_ready" &&
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
      message: `Delivery candidate ${candidateId} commandEvidence must include handoff, delivery, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const documentationSummary = isRecord(record.documentationSummary)
    ? record.documentationSummary
    : {};
  const updatedFiles = asStringArray(documentationSummary.updatedFiles);
  const documentationSummaryOk =
    documentationSummary.status === "delivery_candidate_docs_aligned" &&
    REQUIRED_DOC_FILES.every((file) => updatedFiles.includes(file));
  if (!documentationSummaryOk) {
    findings.push({
      code: "documentation_summary_missing",
      severity: "error",
      field: "documentationSummary",
      message: `Delivery candidate ${candidateId} must list all required aligned documentation files.`,
    });
  }

  const risk = isRecord(record.riskSummary) ? record.riskSummary : {};
  const riskSummaryOk =
    risk.productionReady === false &&
    risk.publishingApproved === false &&
    risk.externalWritesApproved === false &&
    risk.tagApproved === false &&
    risk.packageApproved === false &&
    risk.uploadApproved === false &&
    asStringArray(risk.deferredItems).length > 0;
  if (!riskSummaryOk) {
    findings.push({
      code: "risk_summary_missing",
      severity: "error",
      field: "riskSummary",
      message: `Delivery candidate ${candidateId} must keep production, publishing, external write, tag, package, and upload approvals disabled with deferred items recorded.`,
    });
  }

  const rollback = isRecord(record.rollbackSummary)
    ? record.rollbackSummary
    : {};
  const rollbackSummaryOk =
    rollback.rollbackAvailable === true &&
    asStringArray(rollback.rollbackNotes).length > 0;
  if (!rollbackSummaryOk) {
    findings.push({
      code: "rollback_summary_missing",
      severity: "error",
      field: "rollbackSummary",
      message: `Delivery candidate ${candidateId} must record rollback availability and rollback notes.`,
    });
  }

  const recordedHandoff = isRecord(record.handoffSummaryResult)
    ? record.handoffSummaryResult
    : {};
  const recordedDelivery = isRecord(record.deliveryReadyResult)
    ? record.deliveryReadyResult
    : {};
  const recordedGateBoundaryOk =
    recordedHandoff.ok === true &&
    recordedHandoff.summaryOnly === true &&
    recordedHandoff.productionReady === false &&
    recordedHandoff.publishingPerformed === false &&
    recordedDelivery.ok === true &&
    recordedDelivery.releaseClaim === "local_delivery_demo_ready" &&
    recordedDelivery.productionReady === false;
  if (!recordedGateBoundaryOk) {
    findings.push({
      code: "invalid_recorded_gate_boundary",
      severity: "error",
      field: "handoffSummaryResult",
      message: `Delivery candidate ${candidateId} must record handoff summary and delivery readiness as green non-production gates.`,
    });
  }

  const boundary = isRecord(record.deliveryCandidateBoundary)
    ? record.deliveryCandidateBoundary
    : {};
  const deliveryCandidateBoundaryOk =
    boundary.candidateOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.tagCreated === false &&
    boundary.packageBuilt === false &&
    boundary.uploadPerformed === false &&
    boundary.productionReady === false &&
    boundary.productionReadinessClaimed === false;
  if (!deliveryCandidateBoundaryOk) {
    findings.push({
      code: "delivery_candidate_boundary_breached",
      severity: "error",
      field: "deliveryCandidateBoundary",
      message: `Delivery candidate ${candidateId} must remain candidate-only with no checker command execution, writes, publishing, tag, package, upload, production readiness, or production readiness claim.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "delivery_candidate_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Delivery candidate ${candidateId} approvalStatus must be delivery_candidate_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: DELIVERY_CANDIDATE_CHECK_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    candidateOnly: true as const,
    readyForLocalDeliveryCandidate: ok,
    ...(ok ? { deliveryClaim: "local_delivery_candidate_ready" as const } : {}),
    status: statusFromFindings(findings),
    candidatePath: options.candidatePath,
    handoffSummaryPath,
    candidate: {
      candidateId,
      owner,
      targetMilestone: asString(deliveryCandidate.targetMilestone),
      nextBoundary: asString(deliveryCandidate.nextBoundary),
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandEvidence: commandEvidence.length,
      documentationFiles: updatedFiles.length,
      deferredItems: asStringArray(risk.deferredItems).length,
    },
    checks: {
      handoffSummaryOk,
      deliveryReadyOk,
      deliveryCandidateComplete,
      commandEvidenceOrdered,
      commandEvidenceGreen,
      commandMetadataOk,
      documentationSummaryOk,
      riskSummaryOk,
      rollbackSummaryOk,
      recordedGateBoundaryOk,
      deliveryCandidateBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start production release policy hardening"
      : "npm run delivery:candidate:check -- --candidate <path>",
    nextAction: ok
      ? "Local delivery candidate evidence is green; production release, packaging, deployment, and publishing remain separate approval phases."
      : "Fix delivery candidate findings before using this report for handoff.",
  };
}
