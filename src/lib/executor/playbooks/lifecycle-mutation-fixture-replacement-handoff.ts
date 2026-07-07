import {
  validatePlaybookLifecycleMutationCandidateFixtureReview,
} from "@/lib/executor/playbooks/lifecycle-mutation-candidate-fixture-review";

export const PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND =
  "playbook:lifecycle:mutation:fixture-replacement:handoff:check";

export type PlaybookLifecycleMutationFixtureReplacementHandoff = {
  handoffId: string;
  owner: string;
  candidateReviewPath: string;
  catalogFixtureId: string;
  targetPlaybookId: string;
  candidateFixturePath: string;
  committedFixturePath: string;
  replacementReason: string;
  rollbackEvidence: {
    priorCommittedFixtureReviewed: boolean;
    replacementDiffReviewPlanned: boolean;
    scopedRestorePath: boolean;
    restorePlanDocumented: boolean;
    rollbackNotes: string[];
  };
  postReplacementValidationPlan: {
    governedFixtureCatalogGate: boolean;
    fixtureSummaryGate: boolean;
    controlledRuntimeGate: boolean;
    coreWorkflowGate: boolean;
    diffCheckGate: boolean;
    postReplacementEvidenceRequired: boolean;
  };
  replacementBoundary: {
    handoffOnly: boolean;
    committedFixtureReplacementPerformed: boolean;
    candidateFixtureGenerated: boolean;
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    productionReady: boolean;
  };
  replacementPolicy: "manual_replacement_requires_post_replacement_evidence";
  publishingPolicy: "no_publish_or_release";
  productionPolicy: "no_production_ready_claim";
  approvalStatus: "fixture_replacement_handoff_only";
  notes: string[];
};

export type PlaybookLifecycleMutationFixtureReplacementHandoffFinding = {
  code:
    | "invalid_handoff_shape"
    | "invalid_candidate_fixture_review"
    | "target_or_catalog_mismatch"
    | "fixture_path_mismatch"
    | "committed_fixture_path_out_of_scope"
    | "incomplete_rollback_evidence"
    | "incomplete_post_replacement_validation_plan"
    | "fixture_replacement_side_effect_performed"
    | "invalid_handoff_policy"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

type CandidateFixtureReviewReport = ReturnType<
  typeof validatePlaybookLifecycleMutationCandidateFixtureReview
>;

type ValidatePlaybookLifecycleMutationFixtureReplacementHandoffOptions = {
  handoffPath?: string;
  candidateReviewReport: CandidateFixtureReviewReport;
};

const COMMITTED_FIXTURE_PATH_PREFIX =
  "src/__tests__/fixtures/controlled-traces/";

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
  handoffId: string,
  field: keyof PlaybookLifecycleMutationFixtureReplacementHandoff,
): PlaybookLifecycleMutationFixtureReplacementHandoffFinding {
  return {
    code: "invalid_handoff_shape",
    severity: "error",
    field,
    message: `Fixture replacement handoff ${handoffId} must include non-empty ${field}.`,
  };
}

function candidateReviewCatalogFixtureId(report: CandidateFixtureReviewReport) {
  return isRecord(report.review) ? asString(report.review.catalogFixtureId) : "";
}

function candidateReviewTargetPlaybookId(report: CandidateFixtureReviewReport) {
  return isRecord(report.review) ? asString(report.review.targetPlaybookId) : "";
}

function rollbackEvidenceComplete(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    value.priorCommittedFixtureReviewed === true &&
    value.replacementDiffReviewPlanned === true &&
    value.scopedRestorePath === true &&
    value.restorePlanDocumented === true &&
    asStringArray(value.rollbackNotes).length > 0
  );
}

function postReplacementValidationPlanComplete(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    value.governedFixtureCatalogGate === true &&
    value.fixtureSummaryGate === true &&
    value.controlledRuntimeGate === true &&
    value.coreWorkflowGate === true &&
    value.diffCheckGate === true &&
    value.postReplacementEvidenceRequired === true
  );
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationFixtureReplacementHandoffFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_candidate_fixture_review")) {
    return "candidate_fixture_review_not_green";
  }
  if (findings.length > 0) return "fixture_replacement_handoff_not_valid";
  return "fixture_replacement_handoff_ready";
}

export function validatePlaybookLifecycleMutationFixtureReplacementHandoff(
  handoff: unknown,
  options: ValidatePlaybookLifecycleMutationFixtureReplacementHandoffOptions,
) {
  const record = isRecord(handoff) ? handoff : {};
  const handoffId = asString(record.handoffId) || "unknown";
  const owner = asString(record.owner);
  const candidateReviewPath = asString(record.candidateReviewPath);
  const catalogFixtureId = asString(record.catalogFixtureId);
  const targetPlaybookId = asString(record.targetPlaybookId);
  const candidateFixturePath = asString(record.candidateFixturePath);
  const committedFixturePath = asString(record.committedFixturePath);
  const findings: PlaybookLifecycleMutationFixtureReplacementHandoffFinding[] = [];

  for (const field of [
    "handoffId",
    "owner",
    "candidateReviewPath",
    "catalogFixtureId",
    "targetPlaybookId",
    "candidateFixturePath",
    "committedFixturePath",
    "replacementReason",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(handoffId, field));
    }
  }

  const candidateReviewOk =
    options.candidateReviewReport.ok === true &&
    options.candidateReviewReport.readyForManualFixtureReplacementReview === true &&
    options.candidateReviewReport.productionReady === false &&
    options.candidateReviewReport.publishingPerformed === false &&
    options.candidateReviewReport.reviewOnly === true;
  if (!candidateReviewOk) {
    findings.push({
      code: "invalid_candidate_fixture_review",
      severity: "error",
      path: candidateReviewPath,
      message: `Fixture replacement handoff ${handoffId} requires a green candidate fixture review before manual committed fixture replacement.`,
    });
  }

  const targetAligned =
    hasNonEmptyString(catalogFixtureId) &&
    hasNonEmptyString(targetPlaybookId) &&
    catalogFixtureId === candidateReviewCatalogFixtureId(options.candidateReviewReport) &&
    targetPlaybookId === candidateReviewTargetPlaybookId(options.candidateReviewReport);
  if (hasNonEmptyString(catalogFixtureId) && hasNonEmptyString(targetPlaybookId) && !targetAligned) {
    findings.push({
      code: "target_or_catalog_mismatch",
      severity: "error",
      field: "catalogFixtureId",
      message: `Fixture replacement handoff ${handoffId} must match the candidate review catalogFixtureId and targetPlaybookId.`,
    });
  }

  const fixturePathsAligned =
    hasNonEmptyString(candidateFixturePath) &&
    hasNonEmptyString(committedFixturePath) &&
    candidateFixturePath === options.candidateReviewReport.candidateFixturePath &&
    committedFixturePath === options.candidateReviewReport.committedFixturePath;
  if (hasNonEmptyString(candidateFixturePath) && hasNonEmptyString(committedFixturePath) && !fixturePathsAligned) {
    findings.push({
      code: "fixture_path_mismatch",
      severity: "error",
      field: "candidateFixturePath",
      message: `Fixture replacement handoff ${handoffId} candidate and committed fixture paths must match the referenced candidate review.`,
    });
  }

  const committedFixturePathScoped = committedFixturePath.startsWith(
    COMMITTED_FIXTURE_PATH_PREFIX,
  );
  if (hasNonEmptyString(committedFixturePath) && !committedFixturePathScoped) {
    findings.push({
      code: "committed_fixture_path_out_of_scope",
      severity: "error",
      field: "committedFixturePath",
      path: committedFixturePath,
      message: `Fixture replacement handoff ${handoffId} committedFixturePath must stay under ${COMMITTED_FIXTURE_PATH_PREFIX}.`,
    });
  }

  const rollbackOk = rollbackEvidenceComplete(record.rollbackEvidence);
  if (!rollbackOk) {
    findings.push({
      code: "incomplete_rollback_evidence",
      severity: "error",
      field: "rollbackEvidence",
      message: `Fixture replacement handoff ${handoffId} must include complete rollback evidence before replacement.`,
    });
  }

  const validationPlanOk = postReplacementValidationPlanComplete(
    record.postReplacementValidationPlan,
  );
  if (!validationPlanOk) {
    findings.push({
      code: "incomplete_post_replacement_validation_plan",
      severity: "error",
      field: "postReplacementValidationPlan",
      message: `Fixture replacement handoff ${handoffId} must declare the post-replacement validation plan.`,
    });
  }

  const boundary = isRecord(record.replacementBoundary)
    ? record.replacementBoundary
    : {};
  const replacementBoundaryOk =
    boundary.handoffOnly === true &&
    boundary.committedFixtureReplacementPerformed === false &&
    boundary.candidateFixtureGenerated === false &&
    boundary.fixtureRefreshPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.productionReady === false;
  if (!replacementBoundaryOk) {
    findings.push({
      code: "fixture_replacement_side_effect_performed",
      severity: "error",
      field: "replacementBoundary",
      message: `Fixture replacement handoff ${handoffId} must remain handoff-only with no fixture replacement, fixture refresh, store writes, external writes, publishing, or production readiness.`,
    });
  }

  const policiesOk =
    record.replacementPolicy ===
      "manual_replacement_requires_post_replacement_evidence" &&
    record.publishingPolicy === "no_publish_or_release" &&
    record.productionPolicy === "no_production_ready_claim";
  if (!policiesOk) {
    findings.push({
      code: "invalid_handoff_policy",
      severity: "error",
      field: "replacementPolicy",
      message: `Fixture replacement handoff ${handoffId} must preserve manual replacement, no publish, and no production-ready policies.`,
    });
  }

  const approvalStatusOk =
    record.approvalStatus === "fixture_replacement_handoff_only";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Fixture replacement handoff ${handoffId} approvalStatus must be fixture_replacement_handoff_only.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    handoffOnly: true as const,
    readyForManualCommittedFixtureReplacement: ok,
    status: statusFromFindings(findings),
    handoffPath: options.handoffPath,
    candidateReviewPath,
    candidateFixturePath,
    committedFixturePath,
    handoff: {
      handoffId,
      owner,
      catalogFixtureId,
      targetPlaybookId,
    },
    summary: {
      findings: findings.length,
    },
    checks: {
      candidateReviewOk,
      targetAligned,
      fixturePathsAligned,
      committedFixturePathScoped,
      rollbackEvidenceComplete: rollbackOk,
      postReplacementValidationPlanComplete: validationPlanOk,
      replacementBoundaryOk,
      policiesOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "Manually replace the committed fixture JSON, then run governed fixture and controlled-runtime validation commands."
      : "npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff <path>",
    nextAction: ok
      ? "Fixture replacement handoff is ready for explicit manual committed fixture replacement; do not publish or claim production readiness."
      : "Fix fixture replacement handoff findings before replacing committed fixtures, publishing, or claiming readiness.",
  };
}
