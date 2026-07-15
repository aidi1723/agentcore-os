export const PLAYBOOK_LIFECYCLE_MUTATION_POST_REPLACEMENT_EVIDENCE_COMMAND =
  "playbook:lifecycle:mutation:post-replacement:evidence:check";

export type PlaybookLifecycleMutationPostReplacementEvidenceCommandResult = {
  command: string;
  ok: boolean;
  exitCode: number;
  recordedAt: string;
  fixtureReplacementHandoff?: "fixture_replacement_handoff_green";
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

export type PlaybookLifecycleMutationPostReplacementEvidence = {
  evidenceId: string;
  replacementHandoffPath: string;
  owner: string;
  recordedAt: string;
  replacementSummary: {
    committedFixtureReplacementPerformed: boolean;
    catalogFixtureId: string;
    targetPlaybookId: string;
    candidateFixturePath: string;
    committedFixturePath: string;
    replacementReviewedInGitDiff: boolean;
    rollbackAvailable: boolean;
    rollbackNotes: string[];
  };
  commandResults: PlaybookLifecycleMutationPostReplacementEvidenceCommandResult[];
  replacementHandoffResult: {
    ok: boolean;
    handoffOnly: boolean;
    productionReady: boolean;
    publishingPerformed: boolean;
  };
  postReplacementBoundary: {
    evidenceOnly: boolean;
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    productionReady: boolean;
    readinessClaimed: boolean;
  };
  approvalStatus: "post_replacement_fixture_evidence";
  notes: string[];
};

export type PlaybookLifecycleMutationPostReplacementEvidenceFinding = {
  code:
    | "invalid_evidence_shape"
    | "invalid_fixture_replacement_handoff"
    | "replacement_summary_mismatch"
    | "replacement_review_or_rollback_missing"
    | "invalid_command_evidence_sequence"
    | "command_not_green"
    | "invalid_handoff_evidence"
    | "invalid_fixture_evidence"
    | "invalid_fixture_summary_evidence"
    | "invalid_runtime_evidence"
    | "invalid_core_workflow_evidence"
    | "invalid_diff_check_evidence"
    | "invalid_replacement_handoff_boundary"
    | "post_replacement_side_effect_performed"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type FixtureReplacementHandoffReport = {
  ok: boolean;
  productionReady: boolean;
  publishingPerformed: boolean;
  handoffOnly: boolean;
  readyForManualCommittedFixtureReplacement: boolean;
  handoff: unknown;
  candidateFixturePath: string;
  committedFixturePath: string;
};

type ValidatePlaybookLifecycleMutationPostReplacementEvidenceOptions = {
  evidencePath?: string;
  replacementHandoffReport: FixtureReplacementHandoffReport;
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

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asCommandResults(
  value: unknown,
): PlaybookLifecycleMutationPostReplacementEvidenceCommandResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (
      item,
    ): item is PlaybookLifecycleMutationPostReplacementEvidenceCommandResult => {
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

function missingStringFinding(
  evidenceId: string,
  field: keyof PlaybookLifecycleMutationPostReplacementEvidence,
): PlaybookLifecycleMutationPostReplacementEvidenceFinding {
  return {
    code: "invalid_evidence_shape",
    severity: "error",
    field,
    message: `Post-replacement fixture evidence ${evidenceId} must include non-empty ${field}.`,
  };
}

function handoffCatalogFixtureId(report: FixtureReplacementHandoffReport) {
  return isRecord(report.handoff) ? asString(report.handoff.catalogFixtureId) : "";
}

function handoffTargetPlaybookId(report: FixtureReplacementHandoffReport) {
  return isRecord(report.handoff) ? asString(report.handoff.targetPlaybookId) : "";
}

function expectedCommands(replacementHandoffPath: string) {
  return [
    `npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff ${replacementHandoffPath}`,
    "npm run trace:fixtures --silent",
    "npm run trace:fixtures:summary --silent",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  results: PlaybookLifecycleMutationPostReplacementEvidenceCommandResult[],
  expected: string[],
) {
  if (results.length !== expected.length) return false;
  return expected.every((command, index) => results[index]?.command === command);
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationPostReplacementEvidenceFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_fixture_replacement_handoff")) {
    return "fixture_replacement_handoff_not_green";
  }
  if (findings.length > 0) return "post_replacement_fixture_evidence_not_valid";
  return "post_replacement_fixture_evidence_ready";
}

export function validatePlaybookLifecycleMutationPostReplacementEvidence(
  evidence: unknown,
  options: ValidatePlaybookLifecycleMutationPostReplacementEvidenceOptions,
) {
  const record = isRecord(evidence) ? evidence : {};
  const evidenceId = asString(record.evidenceId) || "unknown";
  const replacementHandoffPath = asString(record.replacementHandoffPath);
  const owner = asString(record.owner);
  const commandResults = asCommandResults(record.commandResults);
  const requiredCommands = expectedCommands(replacementHandoffPath);
  const findings: PlaybookLifecycleMutationPostReplacementEvidenceFinding[] = [];

  for (const field of [
    "evidenceId",
    "replacementHandoffPath",
    "owner",
    "recordedAt",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(evidenceId, field));
    }
  }

  const replacementHandoffOk =
    options.replacementHandoffReport.ok === true &&
    options.replacementHandoffReport.readyForManualCommittedFixtureReplacement === true &&
    options.replacementHandoffReport.productionReady === false &&
    options.replacementHandoffReport.publishingPerformed === false &&
    options.replacementHandoffReport.handoffOnly === true;
  if (!replacementHandoffOk) {
    findings.push({
      code: "invalid_fixture_replacement_handoff",
      severity: "error",
      path: replacementHandoffPath,
      message: `Post-replacement fixture evidence ${evidenceId} requires a green fixture replacement handoff.`,
    });
  }

  const summary = isRecord(record.replacementSummary)
    ? record.replacementSummary
    : {};
  const replacementSummaryAligned =
    summary.committedFixtureReplacementPerformed === true &&
    asString(summary.catalogFixtureId) ===
      handoffCatalogFixtureId(options.replacementHandoffReport) &&
    asString(summary.targetPlaybookId) ===
      handoffTargetPlaybookId(options.replacementHandoffReport) &&
    asString(summary.candidateFixturePath) ===
      options.replacementHandoffReport.candidateFixturePath &&
    asString(summary.committedFixturePath) ===
      options.replacementHandoffReport.committedFixturePath;
  if (!replacementSummaryAligned) {
    findings.push({
      code: "replacement_summary_mismatch",
      severity: "error",
      field: "replacementSummary",
      message: `Post-replacement fixture evidence ${evidenceId} replacementSummary must match the fixture replacement handoff target and paths.`,
    });
  }

  const replacementReviewedAndRollbackReady =
    summary.replacementReviewedInGitDiff === true &&
    summary.rollbackAvailable === true &&
    asStringArray(summary.rollbackNotes).length > 0;
  if (!replacementReviewedAndRollbackReady) {
    findings.push({
      code: "replacement_review_or_rollback_missing",
      severity: "error",
      field: "replacementSummary",
      message: `Post-replacement fixture evidence ${evidenceId} must record git diff review and rollback notes.`,
    });
  }

  const commandResultsOrdered = orderedCommandsMatch(commandResults, requiredCommands);
  if (!commandResultsOrdered) {
    findings.push({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandResults",
      command: requiredCommands[0],
      message: `Post-replacement fixture evidence ${evidenceId} commandResults must match the required commands in order.`,
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
      message: `Post-replacement fixture evidence ${evidenceId} commandResults must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const handoffResult = commandResults.find(
    (result) => result.command === requiredCommands[0],
  );
  const handoffEvidenceOk =
    handoffResult?.fixtureReplacementHandoff ===
      "fixture_replacement_handoff_green" &&
    handoffResult.handoffOnly === true &&
    handoffResult.productionReady === false &&
    handoffResult.publishingPerformed === false;
  if (!handoffEvidenceOk) {
    findings.push({
      code: "invalid_handoff_evidence",
      severity: "error",
      field: "commandResults",
      command: requiredCommands[0],
      message: `Post-replacement fixture evidence ${evidenceId} must record fixture replacement handoff as green and handoff-only.`,
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
      message: `Post-replacement fixture evidence ${evidenceId} must record governed fixture evidence as governed_fixtures_green.`,
    });
  }

  const fixtureSummaryResult = commandResults.find(
    (result) => result.command === "npm run trace:fixtures:summary --silent",
  );
  const fixtureSummaryEvidenceOk =
    fixtureSummaryResult?.fixtureSummaryGate ===
    "governed_fixture_summary_green";
  if (!fixtureSummaryEvidenceOk) {
    findings.push({
      code: "invalid_fixture_summary_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run trace:fixtures:summary --silent",
      message: `Post-replacement fixture evidence ${evidenceId} must record governed fixture summary evidence as governed_fixture_summary_green.`,
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
      message: `Post-replacement fixture evidence ${evidenceId} must record positive controlled runtime testFiles and tests counts.`,
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
      message: `Post-replacement fixture evidence ${evidenceId} must record core workflow evidence as core_workflows_green.`,
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
      message: `Post-replacement fixture evidence ${evidenceId} must record git diff check evidence as git_diff_check_green.`,
    });
  }

  const handoffBoundary = isRecord(record.replacementHandoffResult)
    ? record.replacementHandoffResult
    : {};
  const replacementHandoffBoundaryOk =
    handoffBoundary.ok === true &&
    handoffBoundary.handoffOnly === true &&
    handoffBoundary.productionReady === false &&
    handoffBoundary.publishingPerformed === false;
  if (!replacementHandoffBoundaryOk) {
    findings.push({
      code: "invalid_replacement_handoff_boundary",
      severity: "error",
      field: "replacementHandoffResult",
      message: `Post-replacement fixture evidence ${evidenceId} must record the replacement handoff boundary as green and non-production.`,
    });
  }

  const boundary = isRecord(record.postReplacementBoundary)
    ? record.postReplacementBoundary
    : {};
  const postReplacementBoundaryOk =
    boundary.evidenceOnly === true &&
    boundary.fixtureRefreshPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.productionReady === false &&
    boundary.readinessClaimed === false;
  if (!postReplacementBoundaryOk) {
    findings.push({
      code: "post_replacement_side_effect_performed",
      severity: "error",
      field: "postReplacementBoundary",
      message: `Post-replacement fixture evidence ${evidenceId} must record no fixture refresh automation, store writes, external writes, publishing, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "post_replacement_fixture_evidence";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Post-replacement fixture evidence ${evidenceId} approvalStatus must be post_replacement_fixture_evidence.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_POST_REPLACEMENT_EVIDENCE_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    evidenceOnly: true as const,
    readyForReleaseHandoffReview: ok,
    status: statusFromFindings(findings),
    evidencePath: options.evidencePath,
    replacementHandoffPath,
    evidence: {
      evidenceId,
      owner,
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandResults: commandResults.length,
    },
    checks: {
      replacementHandoffOk,
      replacementSummaryAligned,
      replacementReviewedAndRollbackReady,
      commandResultsOrdered,
      commandResultsGreen,
      handoffEvidenceOk,
      fixtureEvidenceOk,
      fixtureSummaryEvidenceOk,
      runtimeEvidenceOk,
      coreWorkflowEvidenceOk,
      diffCheckEvidenceOk,
      replacementHandoffBoundaryOk,
      postReplacementBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "define release handoff review integration without production readiness claims"
      : "npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence <path>",
    nextAction: ok
      ? "Post-replacement fixture evidence is green; release handoff review can be designed as a separate non-production gate."
      : "Fix post-replacement fixture evidence findings before release handoff, publishing, or readiness claims.",
  };
}
