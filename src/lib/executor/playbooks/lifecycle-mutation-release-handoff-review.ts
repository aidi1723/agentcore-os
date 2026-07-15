export const PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND =
  "playbook:lifecycle:mutation:release-handoff:review:check";

export type PlaybookLifecycleMutationReleaseHandoffReviewCommandResult = {
  command: string;
  ok: boolean;
  exitCode: number;
  recordedAt: string;
  postReplacementEvidence?: "post_replacement_fixture_evidence_green";
  releaseClaim?: "local_release_handoff_ready" | string;
  snapshotEvidence?: "release_handoff_snapshot_written";
  readyForLocalHandoffEvidence?: boolean;
  releaseHandoffEvidenceAudit?: "release_handoff_evidence_audit_green";
  diffCheck?: "git_diff_check_green";
  evidenceOnly?: boolean;
  productionReady?: boolean;
  publishingPerformed?: boolean;
};

export type PlaybookLifecycleMutationReleaseHandoffReview = {
  reviewId: string;
  postReplacementEvidencePath: string;
  owner: string;
  recordedAt: string;
  reviewSummary: {
    postReplacementEvidenceAccepted: boolean;
    releaseHandoffEvidenceAccepted: boolean;
    rollbackAvailable: boolean;
    rollbackNotes: string[];
    nextBoundary: string;
  };
  commandResults: PlaybookLifecycleMutationReleaseHandoffReviewCommandResult[];
  postReplacementEvidenceResult: {
    ok: boolean;
    evidenceOnly: boolean;
    productionReady: boolean;
    publishingPerformed: boolean;
  };
  releaseHandoffReviewBoundary: {
    reviewOnly: boolean;
    commandsExecutedByChecker: boolean;
    snapshotGeneratedByChecker: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    tagCreated: boolean;
    packageBuilt: boolean;
    uploadPerformed: boolean;
    productionReady: boolean;
    readinessClaimed: boolean;
  };
  approvalStatus: "release_handoff_review";
  notes: string[];
};

export type PlaybookLifecycleMutationReleaseHandoffReviewFinding = {
  code:
    | "invalid_review_shape"
    | "invalid_post_replacement_evidence"
    | "review_summary_missing"
    | "invalid_command_evidence_sequence"
    | "command_not_green"
    | "invalid_post_replacement_command_evidence"
    | "invalid_release_handoff_evidence"
    | "invalid_release_handoff_snapshot_evidence"
    | "invalid_release_handoff_status_evidence"
    | "invalid_release_handoff_audit_evidence"
    | "invalid_diff_check_evidence"
    | "invalid_post_replacement_evidence_boundary"
    | "release_handoff_review_side_effect_performed"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type PostReplacementEvidenceReport = {
  ok: boolean;
  productionReady: boolean;
  publishingPerformed: boolean;
  evidenceOnly: boolean;
  readyForReleaseHandoffReview: boolean;
};

type ValidatePlaybookLifecycleMutationReleaseHandoffReviewOptions = {
  reviewPath?: string;
  postReplacementEvidenceReport: PostReplacementEvidenceReport;
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

function asCommandResults(
  value: unknown,
): PlaybookLifecycleMutationReleaseHandoffReviewCommandResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (
      item,
    ): item is PlaybookLifecycleMutationReleaseHandoffReviewCommandResult => {
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
  reviewId: string,
  field: keyof PlaybookLifecycleMutationReleaseHandoffReview,
): PlaybookLifecycleMutationReleaseHandoffReviewFinding {
  return {
    code: "invalid_review_shape",
    severity: "error",
    field,
    message: `Release handoff review ${reviewId} must include non-empty ${field}.`,
  };
}

function expectedCommands(postReplacementEvidencePath: string) {
  return [
    `npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence ${postReplacementEvidencePath}`,
    "npm run release:handoff:check",
    "npm run release:handoff:snapshot",
    "npm run release:handoff:evidence:status",
    "npm run release:handoff:evidence:audit",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  results: PlaybookLifecycleMutationReleaseHandoffReviewCommandResult[],
  expected: string[],
) {
  if (results.length !== expected.length) return false;
  return expected.every((command, index) => results[index]?.command === command);
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationReleaseHandoffReviewFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_post_replacement_evidence")) {
    return "post_replacement_evidence_not_green";
  }
  if (findings.length > 0) return "release_handoff_review_not_valid";
  return "release_handoff_review_ready";
}

export function validatePlaybookLifecycleMutationReleaseHandoffReview(
  review: unknown,
  options: ValidatePlaybookLifecycleMutationReleaseHandoffReviewOptions,
) {
  const record = isRecord(review) ? review : {};
  const reviewId = asString(record.reviewId) || "unknown";
  const postReplacementEvidencePath = asString(record.postReplacementEvidencePath);
  const owner = asString(record.owner);
  const commandResults = asCommandResults(record.commandResults);
  const requiredCommands = expectedCommands(postReplacementEvidencePath);
  const findings: PlaybookLifecycleMutationReleaseHandoffReviewFinding[] = [];

  for (const field of [
    "reviewId",
    "postReplacementEvidencePath",
    "owner",
    "recordedAt",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(reviewId, field));
    }
  }

  const postReplacementEvidenceOk =
    options.postReplacementEvidenceReport.ok === true &&
    options.postReplacementEvidenceReport.readyForReleaseHandoffReview === true &&
    options.postReplacementEvidenceReport.productionReady === false &&
    options.postReplacementEvidenceReport.publishingPerformed === false &&
    options.postReplacementEvidenceReport.evidenceOnly === true;
  if (!postReplacementEvidenceOk) {
    findings.push({
      code: "invalid_post_replacement_evidence",
      severity: "error",
      path: postReplacementEvidencePath,
      message: `Release handoff review ${reviewId} requires green post-replacement fixture evidence.`,
    });
  }

  const summary = isRecord(record.reviewSummary) ? record.reviewSummary : {};
  const reviewSummaryAccepted =
    summary.postReplacementEvidenceAccepted === true &&
    summary.releaseHandoffEvidenceAccepted === true &&
    summary.rollbackAvailable === true &&
    asStringArray(summary.rollbackNotes).length > 0 &&
    hasNonEmptyString(summary.nextBoundary);
  if (!reviewSummaryAccepted) {
    findings.push({
      code: "review_summary_missing",
      severity: "error",
      field: "reviewSummary",
      message: `Release handoff review ${reviewId} must record evidence acceptance, rollback notes, and next boundary.`,
    });
  }

  const commandResultsOrdered = orderedCommandsMatch(commandResults, requiredCommands);
  if (!commandResultsOrdered) {
    findings.push({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandResults",
      command: requiredCommands[0],
      message: `Release handoff review ${reviewId} commandResults must match the required commands in order.`,
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
      message: `Release handoff review ${reviewId} commandResults must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const postReplacementResult = commandResults.find(
    (result) => result.command === requiredCommands[0],
  );
  const postReplacementEvidenceCommandOk =
    postReplacementResult?.postReplacementEvidence ===
      "post_replacement_fixture_evidence_green" &&
    postReplacementResult.evidenceOnly === true &&
    postReplacementResult.productionReady === false &&
    postReplacementResult.publishingPerformed === false;
  if (!postReplacementEvidenceCommandOk) {
    findings.push({
      code: "invalid_post_replacement_command_evidence",
      severity: "error",
      field: "commandResults",
      command: requiredCommands[0],
      message: `Release handoff review ${reviewId} must record post-replacement evidence as green and evidence-only.`,
    });
  }

  const releaseHandoffResult = commandResults.find(
    (result) => result.command === "npm run release:handoff:check",
  );
  const releaseHandoffCommandOk =
    releaseHandoffResult?.releaseClaim === "local_release_handoff_ready" &&
    releaseHandoffResult.productionReady === false &&
    releaseHandoffResult.publishingPerformed === false;
  if (!releaseHandoffCommandOk) {
    findings.push({
      code: "invalid_release_handoff_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run release:handoff:check",
      message: `Release handoff review ${reviewId} must record release handoff as local-only and non-production.`,
    });
  }

  const snapshotResult = commandResults.find(
    (result) => result.command === "npm run release:handoff:snapshot",
  );
  const releaseHandoffSnapshotCommandOk =
    snapshotResult?.snapshotEvidence === "release_handoff_snapshot_written" &&
    snapshotResult.evidenceOnly === true &&
    snapshotResult.productionReady === false &&
    snapshotResult.publishingPerformed === false;
  if (!releaseHandoffSnapshotCommandOk) {
    findings.push({
      code: "invalid_release_handoff_snapshot_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run release:handoff:snapshot",
      message: `Release handoff review ${reviewId} must record snapshot evidence as local evidence-only.`,
    });
  }

  const statusResult = commandResults.find(
    (result) => result.command === "npm run release:handoff:evidence:status",
  );
  const releaseHandoffStatusCommandOk =
    statusResult?.readyForLocalHandoffEvidence === true &&
    statusResult.evidenceOnly === true &&
    statusResult.productionReady === false &&
    statusResult.publishingPerformed === false;
  if (!releaseHandoffStatusCommandOk) {
    findings.push({
      code: "invalid_release_handoff_status_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run release:handoff:evidence:status",
      message: `Release handoff review ${reviewId} must record release handoff evidence status as ready and evidence-only.`,
    });
  }

  const auditResult = commandResults.find(
    (result) => result.command === "npm run release:handoff:evidence:audit",
  );
  const releaseHandoffAuditCommandOk =
    auditResult?.releaseHandoffEvidenceAudit ===
      "release_handoff_evidence_audit_green" &&
    auditResult.evidenceOnly === true &&
    auditResult.productionReady === false &&
    auditResult.publishingPerformed === false;
  if (!releaseHandoffAuditCommandOk) {
    findings.push({
      code: "invalid_release_handoff_audit_evidence",
      severity: "error",
      field: "commandResults",
      command: "npm run release:handoff:evidence:audit",
      message: `Release handoff review ${reviewId} must record release handoff evidence audit as green and evidence-only.`,
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
      message: `Release handoff review ${reviewId} must record git diff check evidence as git_diff_check_green.`,
    });
  }

  const postReplacementBoundary = isRecord(record.postReplacementEvidenceResult)
    ? record.postReplacementEvidenceResult
    : {};
  const postReplacementEvidenceBoundaryOk =
    postReplacementBoundary.ok === true &&
    postReplacementBoundary.evidenceOnly === true &&
    postReplacementBoundary.productionReady === false &&
    postReplacementBoundary.publishingPerformed === false;
  if (!postReplacementEvidenceBoundaryOk) {
    findings.push({
      code: "invalid_post_replacement_evidence_boundary",
      severity: "error",
      field: "postReplacementEvidenceResult",
      message: `Release handoff review ${reviewId} must record post-replacement evidence as green and non-production.`,
    });
  }

  const boundary = isRecord(record.releaseHandoffReviewBoundary)
    ? record.releaseHandoffReviewBoundary
    : {};
  const releaseHandoffReviewBoundaryOk =
    boundary.reviewOnly === true &&
    boundary.commandsExecutedByChecker === false &&
    boundary.snapshotGeneratedByChecker === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.tagCreated === false &&
    boundary.packageBuilt === false &&
    boundary.uploadPerformed === false &&
    boundary.productionReady === false &&
    boundary.readinessClaimed === false;
  if (!releaseHandoffReviewBoundaryOk) {
    findings.push({
      code: "release_handoff_review_side_effect_performed",
      severity: "error",
      field: "releaseHandoffReviewBoundary",
      message: `Release handoff review ${reviewId} must record review-only behavior with no checker execution, snapshot generation, publishing, tag, package, upload, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "release_handoff_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Release handoff review ${reviewId} approvalStatus must be release_handoff_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    reviewOnly: true as const,
    readyForLocalReleaseHandoffReview: ok,
    status: statusFromFindings(findings),
    reviewPath: options.reviewPath,
    postReplacementEvidencePath,
    review: {
      reviewId,
      owner,
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandResults: commandResults.length,
    },
    checks: {
      postReplacementEvidenceOk,
      reviewSummaryAccepted,
      commandResultsOrdered,
      commandResultsGreen,
      postReplacementEvidenceCommandOk,
      releaseHandoffCommandOk,
      releaseHandoffSnapshotCommandOk,
      releaseHandoffStatusCommandOk,
      releaseHandoffAuditCommandOk,
      diffCheckEvidenceOk,
      postReplacementEvidenceBoundaryOk,
      releaseHandoffReviewBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "review local release handoff summaries without publishing or production readiness claims"
      : "npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review <path>",
    nextAction: ok
      ? "Release handoff review evidence is green; any publishing or production-readiness work remains a separate explicit phase."
      : "Fix release handoff review findings before using local handoff evidence for delivery review.",
  };
}
