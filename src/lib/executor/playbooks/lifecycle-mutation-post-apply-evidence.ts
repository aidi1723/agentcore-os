import {
  validatePlaybookLifecycleMutationPostApplySequence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-sequence";

export const PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND =
  "playbook:lifecycle:mutation:post-apply:evidence:check";

export type PlaybookLifecycleMutationPostApplyEvidenceCommandResult = {
  command: string;
  ok: boolean;
  exitCode: number;
  recordedAt: string;
  controlAudit?: "playbook_control_audit_green";
  handoffOnly?: boolean;
  productionReady?: boolean;
  publishingPerformed?: boolean;
  fixtureGate?: "governed_fixtures_green";
  fixtureSummaryGate?: "governed_fixture_summary_green";
  testFiles?: number;
  tests?: number;
  coreWorkflowGate?: "core_workflows_green";
  diffCheck?: "git_diff_check_green";
};

export type PlaybookLifecycleMutationPostApplyEvidence = {
  evidenceId: string;
  sequencePath: string;
  owner: string;
  recordedAt: string;
  commandResults: PlaybookLifecycleMutationPostApplyEvidenceCommandResult[];
  sequenceResult: {
    ok: boolean;
    sequenceOnly: boolean;
    productionReady: boolean;
    publishingPerformed: boolean;
  };
  postApplyAuditBoundary: {
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    productionReady: boolean;
    readinessClaimed: boolean;
  };
  approvalStatus: "post_apply_audit_evidence";
};

export type PlaybookLifecycleMutationPostApplyEvidenceFinding = {
  code:
    | "invalid_evidence_shape"
    | "invalid_referenced_sequence"
    | "invalid_command_evidence_sequence"
    | "command_not_green"
    | "invalid_sequence_boundary"
    | "invalid_control_audit_evidence"
    | "invalid_handoff_boundary"
    | "invalid_fixture_evidence"
    | "invalid_fixture_summary_evidence"
    | "invalid_runtime_evidence"
    | "invalid_core_workflow_evidence"
    | "invalid_diff_check_evidence"
    | "post_apply_side_effect_performed"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type PlaybookLifecycleMutationPostApplySequenceReport = ReturnType<
  typeof validatePlaybookLifecycleMutationPostApplySequence
>;

type ValidatePlaybookLifecycleMutationPostApplyEvidenceOptions = {
  evidencePath?: string;
  sequenceReport: PlaybookLifecycleMutationPostApplySequenceReport;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asCommandResults(
  value: unknown,
): PlaybookLifecycleMutationPostApplyEvidenceCommandResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is PlaybookLifecycleMutationPostApplyEvidenceCommandResult => {
      if (!isRecord(item)) return false;
      return (
        typeof item.command === "string" &&
        typeof item.ok === "boolean" &&
        typeof item.exitCode === "number" &&
        typeof item.recordedAt === "string"
      );
    },
  );
}

function expectedCommandsFromSequenceReport(
  sequenceReport: PlaybookLifecycleMutationPostApplySequenceReport,
) {
  return Array.isArray(sequenceReport.requiredCommands)
    ? sequenceReport.requiredCommands
    : [];
}

function orderedCommandsMatch(
  results: PlaybookLifecycleMutationPostApplyEvidenceCommandResult[],
  expected: string[],
) {
  if (results.length !== expected.length) return false;
  return expected.every((command, index) => results[index]?.command === command);
}

function missingStringFinding(
  evidenceId: string,
  field: keyof PlaybookLifecycleMutationPostApplyEvidence,
): PlaybookLifecycleMutationPostApplyEvidenceFinding {
  return {
    code: "invalid_evidence_shape",
    severity: "error",
    field,
    message: `Post-apply audit evidence ${evidenceId} must include non-empty ${field}.`,
  };
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationPostApplyEvidenceFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_referenced_sequence")) {
    return "referenced_sequence_not_green";
  }
  if (findings.length > 0) return "post_apply_audit_evidence_not_valid";
  return "post_apply_audit_evidence_ready";
}

export function validatePlaybookLifecycleMutationPostApplyEvidence(
  evidence: unknown,
  options: ValidatePlaybookLifecycleMutationPostApplyEvidenceOptions,
) {
  const record = isRecord(evidence) ? evidence : {};
  const evidenceId = asString(record.evidenceId) || "unknown";
  const owner = asString(record.owner);
  const sequencePath = asString(record.sequencePath);
  const commandResults = asCommandResults(record.commandResults);
  const expectedCommands = expectedCommandsFromSequenceReport(options.sequenceReport);
  const findings: PlaybookLifecycleMutationPostApplyEvidenceFinding[] = [];

  for (const field of [
    "evidenceId",
    "sequencePath",
    "owner",
    "recordedAt",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(evidenceId, field));
    }
  }

  if (!options.sequenceReport.ok) {
    findings.push({
      code: "invalid_referenced_sequence",
      severity: "error",
      path: sequencePath,
      message: `Post-apply audit evidence ${evidenceId} references a post-apply sequence that is not green.`,
    });
  }

  const commandResultsOrdered = orderedCommandsMatch(commandResults, expectedCommands);
  if (!commandResultsOrdered) {
    findings.push({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandResults",
      command: expectedCommands[0],
      message: `Post-apply audit evidence ${evidenceId} commandResults must match the referenced post-apply sequence commands in order.`,
    });
  }

  const commandResultsGreen =
    commandResults.length > 0 &&
    commandResults.every(
      (result) =>
        result.ok === true &&
        result.exitCode === 0 &&
        hasNonEmptyString(result.recordedAt),
    );
  if (!commandResultsGreen) {
    findings.push({
      code: "command_not_green",
      severity: "error",
      field: "commandResults",
      message: `Post-apply audit evidence ${evidenceId} commandResults must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const sequenceResult = isRecord(record.sequenceResult) ? record.sequenceResult : {};
  const sequenceBoundaryOk =
    sequenceResult.ok === true &&
    sequenceResult.sequenceOnly === true &&
    sequenceResult.productionReady === false &&
    sequenceResult.publishingPerformed === false;
  if (!sequenceBoundaryOk) {
    findings.push({
      code: "invalid_sequence_boundary",
      severity: "error",
      field: "sequenceResult",
      message: `Post-apply audit evidence ${evidenceId} must record sequenceOnly true with productionReady false and publishingPerformed false.`,
    });
  }

  const controlAuditResult = commandResults.find(
    (result) => result.command === "npm run playbook:control:audit",
  );
  const controlAuditEvidenceOk =
    controlAuditResult?.controlAudit === "playbook_control_audit_green" &&
    controlAuditResult.productionReady === false &&
    controlAuditResult.publishingPerformed === false;
  if (!controlAuditEvidenceOk) {
    findings.push({
      code: "invalid_control_audit_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run playbook:control:audit",
      message: `Post-apply audit evidence ${evidenceId} must record playbook control audit as green with productionReady false and publishingPerformed false.`,
    });
  }

  const handoffResult = commandResults.find(
    (result) => result.command === "npm run playbook:lifecycle:handoff",
  );
  const handoffBoundaryOk =
    handoffResult?.handoffOnly === true &&
    handoffResult.productionReady === false &&
    handoffResult.publishingPerformed === false;
  if (!handoffBoundaryOk) {
    findings.push({
      code: "invalid_handoff_boundary",
      severity: "error",
      field: "commandResults",
      command: "npm run playbook:lifecycle:handoff",
      message: `Post-apply audit evidence ${evidenceId} must record lifecycle handoff as handoffOnly true with productionReady false and publishingPerformed false.`,
    });
  }

  const fixtureResult = commandResults.find(
    (result) => result.command === "npm run trace:fixtures --silent",
  );
  const fixtureEvidenceOk = fixtureResult?.fixtureGate === "governed_fixtures_green";
  if (!fixtureEvidenceOk) {
    findings.push({
      code: "invalid_fixture_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run trace:fixtures --silent",
      message: `Post-apply audit evidence ${evidenceId} must record governed fixture evidence as governed_fixtures_green.`,
    });
  }

  const fixtureSummaryResult = commandResults.find(
    (result) => result.command === "npm run trace:fixtures:summary --silent",
  );
  const fixtureSummaryEvidenceOk =
    fixtureSummaryResult?.fixtureSummaryGate === "governed_fixture_summary_green";
  if (!fixtureSummaryEvidenceOk) {
    findings.push({
      code: "invalid_fixture_summary_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run trace:fixtures:summary --silent",
      message: `Post-apply audit evidence ${evidenceId} must record governed fixture summary evidence as governed_fixture_summary_green.`,
    });
  }

  const runtimeResult = commandResults.find(
    (result) => result.command === "npm run test:controlled-runtime",
  );
  const runtimeEvidenceOk =
    isPositiveNumber(runtimeResult?.testFiles) && isPositiveNumber(runtimeResult?.tests);
  if (!runtimeEvidenceOk) {
    findings.push({
      code: "invalid_runtime_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run test:controlled-runtime",
      message: `Post-apply audit evidence ${evidenceId} must record positive controlled runtime testFiles and tests counts.`,
    });
  }

  const coreWorkflowResult = commandResults.find(
    (result) => result.command === "npm run test:core-workflows",
  );
  const coreWorkflowEvidenceOk =
    coreWorkflowResult?.coreWorkflowGate === "core_workflows_green";
  if (!coreWorkflowEvidenceOk) {
    findings.push({
      code: "invalid_core_workflow_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run test:core-workflows",
      message: `Post-apply audit evidence ${evidenceId} must record core workflow evidence as core_workflows_green.`,
    });
  }

  const diffCheckResult = commandResults.find(
    (result) => result.command === "git diff --check",
  );
  const diffCheckEvidenceOk = diffCheckResult?.diffCheck === "git_diff_check_green";
  if (!diffCheckEvidenceOk) {
    findings.push({
      code: "invalid_diff_check_evidence",
      severity: "error",
      field: "commandResults",
      command: "git diff --check",
      message: `Post-apply audit evidence ${evidenceId} must record git diff check evidence as git_diff_check_green.`,
    });
  }

  const boundary = isRecord(record.postApplyAuditBoundary)
    ? record.postApplyAuditBoundary
    : {};
  const postApplyAuditBoundaryOk =
    boundary.fixtureRefreshPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.productionReady === false &&
    boundary.readinessClaimed === false;
  if (!postApplyAuditBoundaryOk) {
    findings.push({
      code: "post_apply_side_effect_performed",
      severity: "error",
      field: "postApplyAuditBoundary",
      message: `Post-apply audit evidence ${evidenceId} must record no fixture refresh, store writes, external writes, publishing, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "post_apply_audit_evidence";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Post-apply audit evidence ${evidenceId} approvalStatus must be post_apply_audit_evidence.`,
    });
  }

  const ok = findings.length === 0;
  const status = statusFromFindings(findings);

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    evidenceOnly: true as const,
    readyForFixtureRefreshHandoff: ok,
    status,
    evidencePath: options.evidencePath,
    sequencePath,
    evidence: {
      evidenceId,
      owner,
    },
    summary: {
      findings: findings.length,
      requiredCommands: expectedCommands.length,
      commandResults: commandResults.length,
    },
    checks: {
      sequenceOk: options.sequenceReport.ok,
      commandResultsOrdered,
      commandResultsGreen,
      sequenceBoundaryOk,
      controlAuditEvidenceOk,
      handoffBoundaryOk,
      fixtureEvidenceOk,
      fixtureSummaryEvidenceOk,
      runtimeEvidenceOk,
      coreWorkflowEvidenceOk,
      diffCheckEvidenceOk,
      postApplyAuditBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "define fixture refresh handoff gate"
      : "npm run playbook:lifecycle:mutation:post-apply:evidence:check -- --evidence <path>",
    nextAction: ok
      ? "Post-apply audit evidence is green; fixture refresh handoff can be designed as a separate non-publishing gate."
      : "Fix post-apply audit evidence findings before fixture refresh handoff, publishing, or readiness claims.",
  };
}
