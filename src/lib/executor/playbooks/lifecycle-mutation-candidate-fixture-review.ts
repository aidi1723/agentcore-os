import {
  replayControlledTraceFixture,
} from "@/lib/executor/runtime/trace-replay";
import {
  validateControlledTraceFixture,
  type ControlledTraceFixture,
} from "@/lib/executor/runtime/trace-fixtures";

export const PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND =
  "playbook:lifecycle:mutation:candidate-fixture:review:check";

export type PlaybookLifecycleMutationCandidateFixtureReview = {
  reviewId: string;
  owner: string;
  handoffPath: string;
  catalogFixtureId: string;
  candidateFixturePath: string;
  committedFixturePath: string;
  targetPlaybookId: string;
  reviewReason: string;
  reviewEvidence: {
    sourceIdentityGate: boolean;
    redactionGate: boolean;
    playbookContractGate: boolean;
    approvalTerminalStateGate: boolean;
    writebackIdentityGate: boolean;
    failureTriageGate: boolean;
    sensitiveStringSearchGate: boolean;
    replacementDiffGate: boolean;
    catalogGate: boolean;
    runtimeRegressionGate: boolean;
    rollbackNotes: string[];
  };
  reviewBoundary: {
    reviewOnly: boolean;
    candidateFixtureProvided: boolean;
    committedFixtureReplaced: boolean;
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    productionReady: boolean;
  };
  candidatePolicy: "manual_committed_fixture_replacement_required";
  publishingPolicy: "no_publish_or_release";
  productionPolicy: "no_production_ready_claim";
  approvalStatus: "candidate_fixture_review_only";
  notes: string[];
};

export type PlaybookLifecycleMutationCandidateFixtureReviewFinding = {
  code:
    | "invalid_review_shape"
    | "invalid_fixture_refresh_handoff"
    | "catalog_fixture_not_intended"
    | "target_playbook_mismatch"
    | "candidate_fixture_validation_failed"
    | "candidate_fixture_replay_failed"
    | "incomplete_review_evidence"
    | "sensitive_marker_detected"
    | "candidate_review_side_effect_performed"
    | "invalid_review_policy"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

type FixtureRefreshHandoffReport = {
  ok: boolean;
  productionReady: boolean;
  publishingPerformed: boolean;
  handoffOnly: boolean;
  readyForFixtureRefreshReview: boolean;
  handoff: unknown;
};
type CandidateFixtureValidationReport = ReturnType<typeof validateControlledTraceFixture>;
type CandidateFixtureReplayReport = ReturnType<typeof replayControlledTraceFixture>;

type ValidatePlaybookLifecycleMutationCandidateFixtureReviewOptions = {
  reviewPath?: string;
  handoffReport: FixtureRefreshHandoffReport;
  candidateFixture: ControlledTraceFixture;
  committedFixture?: ControlledTraceFixture;
  candidateValidation: CandidateFixtureValidationReport;
  candidateReplay: CandidateFixtureReplayReport;
  candidateSensitiveStringMatches: string[];
};

const SENSITIVE_MARKERS = [
  { label: "openai_api_key", pattern: /sk-[A-Za-z0-9_-]{6,}/ },
  { label: "api_key", pattern: /api[_-]?key/i },
  { label: "secret", pattern: /secret/i },
  { label: "password", pattern: /password/i },
  { label: "email_or_at_sign", pattern: /@/ },
  { label: "known_raw_name_nora", pattern: /Nora/i },
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

function missingStringFinding(
  reviewId: string,
  field: keyof PlaybookLifecycleMutationCandidateFixtureReview,
): PlaybookLifecycleMutationCandidateFixtureReviewFinding {
  return {
    code: "invalid_review_shape",
    severity: "error",
    field,
    message: `Candidate fixture review ${reviewId} must include non-empty ${field}.`,
  };
}

function reviewEvidenceComplete(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    value.sourceIdentityGate === true &&
    value.redactionGate === true &&
    value.playbookContractGate === true &&
    value.approvalTerminalStateGate === true &&
    value.writebackIdentityGate === true &&
    value.failureTriageGate === true &&
    value.sensitiveStringSearchGate === true &&
    value.replacementDiffGate === true &&
    value.catalogGate === true &&
    value.runtimeRegressionGate === true &&
    asStringArray(value.rollbackNotes).length > 0
  );
}

function handoffTargetPlaybookId(report: FixtureRefreshHandoffReport) {
  return isRecord(report.handoff) ? asString(report.handoff.targetPlaybookId) : "";
}

function handoffIntendedFixtureIds(report: FixtureRefreshHandoffReport) {
  return isRecord(report.handoff) ? asStringArray(report.handoff.intendedFixtureIds) : [];
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationCandidateFixtureReviewFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_fixture_refresh_handoff")) {
    return "fixture_refresh_handoff_not_green";
  }
  if (
    codes.has("candidate_fixture_validation_failed") ||
    codes.has("candidate_fixture_replay_failed")
  ) {
    return "candidate_fixture_not_valid";
  }
  if (findings.length > 0) return "candidate_fixture_review_not_valid";
  return "candidate_fixture_review_ready";
}

export function scanCandidateFixtureSensitiveMarkers(candidateFixtureText: string) {
  return SENSITIVE_MARKERS.filter(({ pattern }) => pattern.test(candidateFixtureText)).map(
    ({ label }) => label,
  );
}

export function validatePlaybookLifecycleMutationCandidateFixtureReview(
  review: unknown,
  options: ValidatePlaybookLifecycleMutationCandidateFixtureReviewOptions,
) {
  const record = isRecord(review) ? review : {};
  const reviewId = asString(record.reviewId) || "unknown";
  const owner = asString(record.owner);
  const handoffPath = asString(record.handoffPath);
  const catalogFixtureId = asString(record.catalogFixtureId);
  const candidateFixturePath = asString(record.candidateFixturePath);
  const committedFixturePath = asString(record.committedFixturePath);
  const targetPlaybookId = asString(record.targetPlaybookId);
  const findings: PlaybookLifecycleMutationCandidateFixtureReviewFinding[] = [];

  for (const field of [
    "reviewId",
    "owner",
    "handoffPath",
    "catalogFixtureId",
    "candidateFixturePath",
    "committedFixturePath",
    "targetPlaybookId",
    "reviewReason",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(reviewId, field));
    }
  }

  const handoffOk =
    options.handoffReport.ok === true &&
    options.handoffReport.readyForFixtureRefreshReview === true &&
    options.handoffReport.productionReady === false &&
    options.handoffReport.publishingPerformed === false &&
    options.handoffReport.handoffOnly === true;
  if (!handoffOk) {
    findings.push({
      code: "invalid_fixture_refresh_handoff",
      severity: "error",
      path: handoffPath,
      message: `Candidate fixture review ${reviewId} requires a green fixture refresh handoff before candidate review.`,
    });
  }

  const intendedFixtureIds = handoffIntendedFixtureIds(options.handoffReport);
  const catalogFixtureIntended =
    hasNonEmptyString(catalogFixtureId) && intendedFixtureIds.includes(catalogFixtureId);
  if (hasNonEmptyString(catalogFixtureId) && !catalogFixtureIntended) {
    findings.push({
      code: "catalog_fixture_not_intended",
      severity: "error",
      field: "catalogFixtureId",
      message: `Candidate fixture review ${reviewId} catalogFixtureId must be declared by the referenced fixture refresh handoff.`,
    });
  }

  const handoffTarget = handoffTargetPlaybookId(options.handoffReport);
  const candidateFixtureRecord: Record<string, unknown> = isRecord(options.candidateFixture)
    ? (options.candidateFixture as unknown as Record<string, unknown>)
    : {};
  const candidateFixturePlaybookId = asString(candidateFixtureRecord.playbookId);
  const candidateFixtureStepOrder = Array.isArray(candidateFixtureRecord.steps)
    ? candidateFixtureRecord.steps
        .filter((step): step is Record<string, unknown> => isRecord(step))
        .map((step) => asString(step.stepId))
    : [];

  const targetPlaybookAligned =
    hasNonEmptyString(targetPlaybookId) &&
    targetPlaybookId === handoffTarget &&
    candidateFixturePlaybookId === targetPlaybookId;
  if (hasNonEmptyString(targetPlaybookId) && !targetPlaybookAligned) {
    findings.push({
      code: "target_playbook_mismatch",
      severity: "error",
      field: "targetPlaybookId",
      message: `Candidate fixture review ${reviewId} targetPlaybookId and candidate fixture playbookId must match the referenced handoff target.`,
    });
  }

  const candidateFixtureValid = options.candidateValidation.ok === true;
  if (!candidateFixtureValid) {
    findings.push({
      code: "candidate_fixture_validation_failed",
      severity: "error",
      path: candidateFixturePath,
      message: `Candidate fixture review ${reviewId} candidate fixture validation failed: ${options.candidateValidation.errors.join("; ")}`,
    });
  }

  const candidateReplayOk =
    options.candidateReplay.ok === true &&
    options.candidateReplay.guarantees.toolCallsExecuted === false &&
    options.candidateReplay.guarantees.assetsWritten === false;
  if (!candidateReplayOk) {
    findings.push({
      code: "candidate_fixture_replay_failed",
      severity: "error",
      path: candidateFixturePath,
      message: `Candidate fixture review ${reviewId} candidate fixture replay failed: ${options.candidateReplay.errors.join("; ")}`,
    });
  }

  const evidenceOk = reviewEvidenceComplete(record.reviewEvidence);
  if (!evidenceOk) {
    findings.push({
      code: "incomplete_review_evidence",
      severity: "error",
      field: "reviewEvidence",
      message: `Candidate fixture review ${reviewId} must declare every candidate review gate and rollback notes.`,
    });
  }

  const sensitiveStringSearchOk = options.candidateSensitiveStringMatches.length === 0;
  if (!sensitiveStringSearchOk) {
    findings.push({
      code: "sensitive_marker_detected",
      severity: "error",
      field: "candidateFixturePath",
      path: candidateFixturePath,
      message: `Candidate fixture review ${reviewId} detected sensitive markers in candidate fixture: ${options.candidateSensitiveStringMatches.join(", ")}`,
    });
  }

  const boundary = isRecord(record.reviewBoundary) ? record.reviewBoundary : {};
  const reviewBoundaryOk =
    boundary.reviewOnly === true &&
    boundary.candidateFixtureProvided === true &&
    boundary.committedFixtureReplaced === false &&
    boundary.fixtureRefreshPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.productionReady === false;
  if (!reviewBoundaryOk) {
    findings.push({
      code: "candidate_review_side_effect_performed",
      severity: "error",
      field: "reviewBoundary",
      message: `Candidate fixture review ${reviewId} must remain review-only with no committed fixture replacement, fixture refresh, store writes, external writes, publishing, or production readiness.`,
    });
  }

  const policiesOk =
    record.candidatePolicy === "manual_committed_fixture_replacement_required" &&
    record.publishingPolicy === "no_publish_or_release" &&
    record.productionPolicy === "no_production_ready_claim";
  if (!policiesOk) {
    findings.push({
      code: "invalid_review_policy",
      severity: "error",
      field: "candidatePolicy",
      message: `Candidate fixture review ${reviewId} must preserve manual replacement, no publish, and no production-ready policies.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "candidate_fixture_review_only";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Candidate fixture review ${reviewId} approvalStatus must be candidate_fixture_review_only.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_CANDIDATE_FIXTURE_REVIEW_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    reviewOnly: true as const,
    readyForManualFixtureReplacementReview: ok,
    status: statusFromFindings(findings),
    reviewPath: options.reviewPath,
    handoffPath,
    candidateFixturePath,
    committedFixturePath,
    review: {
      reviewId,
      owner,
      catalogFixtureId,
      targetPlaybookId,
    },
    candidate: {
      fixtureId: asString(candidateFixtureRecord.fixtureId),
      sourceRunId: asString(candidateFixtureRecord.sourceRunId),
      playbookId: candidateFixturePlaybookId,
      playbookVersion: asString(candidateFixtureRecord.playbookVersion),
      scenarioId: asString(candidateFixtureRecord.scenarioId),
      terminalState: asString(candidateFixtureRecord.terminalState),
      stepOrder: candidateFixtureStepOrder,
    },
    summary: {
      findings: findings.length,
      candidateValidationErrors: options.candidateValidation.errors.length,
      candidateReplayErrors: options.candidateReplay.errors.length,
      sensitiveStringMatches: options.candidateSensitiveStringMatches.length,
    },
    checks: {
      handoffOk,
      catalogFixtureIntended,
      targetPlaybookAligned,
      candidateFixtureValid,
      candidateReplayOk,
      reviewEvidenceComplete: evidenceOk,
      sensitiveStringSearchOk,
      reviewBoundaryOk,
      policiesOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "git diff -- src/__tests__/fixtures/controlled-traces/"
      : "npm run playbook:lifecycle:mutation:candidate-fixture:review:check -- --review <path>",
    nextAction: ok
      ? "Candidate fixture review is ready for explicit manual committed fixture replacement review; do not publish or claim production readiness."
      : "Fix candidate fixture review findings before replacing committed fixtures, publishing, or claiming readiness.",
  };
}
