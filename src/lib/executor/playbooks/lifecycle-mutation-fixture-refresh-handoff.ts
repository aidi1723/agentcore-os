import {
  validatePlaybookLifecycleMutationPostApplyEvidence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence";
import {
  validatePlaybookLifecycleMutationPostApplySequence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-sequence";

export const PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REFRESH_HANDOFF_COMMAND =
  "playbook:lifecycle:mutation:fixture-refresh:handoff:check";

export type PlaybookLifecycleMutationFixtureRefreshHandoff = {
  handoffId: string;
  owner: string;
  postApplyEvidencePath: string;
  targetPlaybookId: string;
  intendedFixtureIds: string[];
  refreshReason: string;
  reviewChecklist: {
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
  handoffBoundary: {
    handoffOnly: boolean;
    candidateFixtureGenerated: boolean;
    committedFixtureReplaced: boolean;
    fixtureRefreshPerformed: boolean;
    storeWritesPerformed: boolean;
    externalWritesPerformed: boolean;
    publishingPerformed: boolean;
    productionReady: boolean;
  };
  fixtureRefreshPolicy: "manual_fixture_refresh_review_required";
  publishingPolicy: "no_publish_or_release";
  productionPolicy: "no_production_ready_claim";
  approvalStatus: "fixture_refresh_handoff_only";
  notes: string[];
};

export type PlaybookLifecycleMutationFixtureRefreshHandoffFinding = {
  code:
    | "invalid_handoff_shape"
    | "invalid_post_apply_evidence"
    | "target_playbook_mismatch"
    | "missing_fixture_targets"
    | "incomplete_review_checklist"
    | "fixture_refresh_side_effect_performed"
    | "invalid_handoff_policy"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

type PlaybookLifecycleMutationPostApplyEvidenceReport = ReturnType<
  typeof validatePlaybookLifecycleMutationPostApplyEvidence
>;
type PlaybookLifecycleMutationPostApplySequenceReport = ReturnType<
  typeof validatePlaybookLifecycleMutationPostApplySequence
>;

type ValidatePlaybookLifecycleMutationFixtureRefreshHandoffOptions = {
  handoffPath?: string;
  postApplyEvidenceReport: PlaybookLifecycleMutationPostApplyEvidenceReport;
  postApplySequenceReport: PlaybookLifecycleMutationPostApplySequenceReport;
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
  handoffId: string,
  field: keyof PlaybookLifecycleMutationFixtureRefreshHandoff,
): PlaybookLifecycleMutationFixtureRefreshHandoffFinding {
  return {
    code: "invalid_handoff_shape",
    severity: "error",
    field,
    message: `Fixture refresh handoff ${handoffId} must include non-empty ${field}.`,
  };
}

function reviewChecklistComplete(value: unknown) {
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

function targetPlaybookIdFromSequenceReport(
  sequenceReport: PlaybookLifecycleMutationPostApplySequenceReport,
) {
  return isRecord(sequenceReport.sequence)
    ? asString(sequenceReport.sequence.targetPlaybookId)
    : "";
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationFixtureRefreshHandoffFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_post_apply_evidence")) {
    return "post_apply_evidence_not_green";
  }
  if (findings.length > 0) return "fixture_refresh_handoff_not_valid";
  return "fixture_refresh_handoff_ready";
}

export function validatePlaybookLifecycleMutationFixtureRefreshHandoff(
  handoff: unknown,
  options: ValidatePlaybookLifecycleMutationFixtureRefreshHandoffOptions,
) {
  const record = isRecord(handoff) ? handoff : {};
  const handoffId = asString(record.handoffId) || "unknown";
  const owner = asString(record.owner);
  const postApplyEvidencePath = asString(record.postApplyEvidencePath);
  const targetPlaybookId = asString(record.targetPlaybookId);
  const intendedFixtureIds = asStringArray(record.intendedFixtureIds);
  const findings: PlaybookLifecycleMutationFixtureRefreshHandoffFinding[] = [];

  for (const field of [
    "handoffId",
    "owner",
    "postApplyEvidencePath",
    "targetPlaybookId",
    "refreshReason",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(handoffId, field));
    }
  }

  const postApplyEvidenceOk =
    options.postApplyEvidenceReport.ok === true &&
    options.postApplyEvidenceReport.readyForFixtureRefreshHandoff === true &&
    options.postApplyEvidenceReport.productionReady === false &&
    options.postApplyEvidenceReport.publishingPerformed === false &&
    options.postApplyEvidenceReport.evidenceOnly === true;
  if (!postApplyEvidenceOk) {
    findings.push({
      code: "invalid_post_apply_evidence",
      severity: "error",
      path: postApplyEvidencePath,
      message: `Fixture refresh handoff ${handoffId} requires green post-apply evidence before fixture refresh review.`,
    });
  }

  const sequenceTargetPlaybookId = targetPlaybookIdFromSequenceReport(
    options.postApplySequenceReport,
  );
  const targetPlaybookAligned =
    hasNonEmptyString(targetPlaybookId) &&
    targetPlaybookId === sequenceTargetPlaybookId;
  if (hasNonEmptyString(targetPlaybookId) && !targetPlaybookAligned) {
    findings.push({
      code: "target_playbook_mismatch",
      severity: "error",
      field: "targetPlaybookId",
      message: `Fixture refresh handoff ${handoffId} targetPlaybookId must match the referenced post-apply sequence target.`,
    });
  }

  const intendedFixturesDeclared = intendedFixtureIds.length > 0;
  if (!intendedFixturesDeclared) {
    findings.push({
      code: "missing_fixture_targets",
      severity: "error",
      field: "intendedFixtureIds",
      message: `Fixture refresh handoff ${handoffId} must declare at least one intended governed fixture id.`,
    });
  }

  const reviewChecklistOk = reviewChecklistComplete(record.reviewChecklist);
  if (!reviewChecklistOk) {
    findings.push({
      code: "incomplete_review_checklist",
      severity: "error",
      field: "reviewChecklist",
      message: `Fixture refresh handoff ${handoffId} must declare every manual fixture refresh review gate and rollback notes.`,
    });
  }

  const boundary = isRecord(record.handoffBoundary) ? record.handoffBoundary : {};
  const handoffBoundaryOk =
    boundary.handoffOnly === true &&
    boundary.candidateFixtureGenerated === false &&
    boundary.committedFixtureReplaced === false &&
    boundary.fixtureRefreshPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.productionReady === false;
  if (!handoffBoundaryOk) {
    findings.push({
      code: "fixture_refresh_side_effect_performed",
      severity: "error",
      field: "handoffBoundary",
      message: `Fixture refresh handoff ${handoffId} must remain handoff-only with no candidate generation, committed fixture replacement, fixture refresh, store writes, external writes, publishing, or production readiness.`,
    });
  }

  const policiesOk =
    record.fixtureRefreshPolicy === "manual_fixture_refresh_review_required" &&
    record.publishingPolicy === "no_publish_or_release" &&
    record.productionPolicy === "no_production_ready_claim";
  if (!policiesOk) {
    findings.push({
      code: "invalid_handoff_policy",
      severity: "error",
      field: "fixtureRefreshPolicy",
      message: `Fixture refresh handoff ${handoffId} must preserve manual fixture review, no publish, and no production-ready policies.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "fixture_refresh_handoff_only";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Fixture refresh handoff ${handoffId} approvalStatus must be fixture_refresh_handoff_only.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REFRESH_HANDOFF_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    handoffOnly: true as const,
    readyForFixtureRefreshReview: ok,
    status: statusFromFindings(findings),
    handoffPath: options.handoffPath,
    postApplyEvidencePath,
    handoff: {
      handoffId,
      owner,
      targetPlaybookId,
      intendedFixtureIds,
    },
    summary: {
      findings: findings.length,
      intendedFixtureIds: intendedFixtureIds.length,
    },
    checks: {
      postApplyEvidenceOk,
      targetPlaybookAligned,
      intendedFixturesDeclared,
      reviewChecklistComplete: reviewChecklistOk,
      handoffBoundaryOk,
      policiesOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "npm run trace:fixture:build -- <governed-artifact.json>"
      : "npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check -- --handoff <path>",
    nextAction: ok
      ? "Fixture refresh handoff is ready for manual candidate generation and review; do not publish or claim production readiness."
      : "Fix fixture refresh handoff findings before generating candidates, replacing committed fixtures, publishing, or claiming readiness.",
  };
}
