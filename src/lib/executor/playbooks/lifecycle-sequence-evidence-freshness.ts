import type { PlaybookLifecycleSequenceEvidenceReport } from "@/lib/executor/playbooks/lifecycle-sequence-evidence";

export const PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND =
  "playbook:lifecycle:sequence:evidence:freshness:check";

export type PlaybookLifecycleSequenceEvidenceFreshnessInput = {
  recordedAt?: string;
  provenance?: {
    sourceCommit?: string;
    sourceCommitFull?: string;
    sequenceDigest?: string;
    maxAgeHours?: number;
  };
};

export type PlaybookLifecycleSequenceEvidenceFreshnessFinding = {
  code:
    | "invalid_evidence_report"
    | "invalid_provenance"
    | "sequence_digest_mismatch"
    | "source_commit_mismatch"
    | "invalid_recorded_at"
    | "future_recorded_at"
    | "stale_evidence";
  severity: "error";
  message: string;
  field?: string;
};

export type PlaybookLifecycleSequenceEvidenceFreshnessReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  freshnessOnly: true;
  evidencePath?: string;
  evidence: {
    evidenceId: string;
    owner: string;
    sequencePath: string;
  };
  provenance: {
    sourceCommit: string;
    sourceCommitFull?: string;
    currentCommit: string;
    currentCommitFull: string;
    sequenceDigest: string;
    currentSequenceDigest: string;
    recordedAt: string;
    now: string;
    ageHours?: number;
    maxAgeHours?: number;
  };
  summary: {
    findings: number;
  };
  checks: {
    evidenceOk: boolean;
    provenanceShapeOk: boolean;
    sequenceDigestOk: boolean;
    sourceCommitOk: boolean;
    recordedAtOk: boolean;
    evidenceFresh: boolean;
  };
  findings: PlaybookLifecycleSequenceEvidenceFreshnessFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleSequenceEvidenceFreshnessOptions = {
  evidencePath?: string;
  evidenceReport: PlaybookLifecycleSequenceEvidenceReport;
  currentCommitFull: string;
  sequenceDigest: string;
  now: string;
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

function shortCommit(commit: string, length = 7) {
  return commit.slice(0, length);
}

function parseTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundAgeHours(ageMs: number) {
  return Math.round((ageMs / 3_600_000) * 1000) / 1000;
}

export function validatePlaybookLifecycleSequenceEvidenceFreshness(
  input: PlaybookLifecycleSequenceEvidenceFreshnessInput,
  options: ValidatePlaybookLifecycleSequenceEvidenceFreshnessOptions,
): PlaybookLifecycleSequenceEvidenceFreshnessReport {
  const provenance = isRecord(input.provenance) ? input.provenance : {};
  const sourceCommit = asString(provenance.sourceCommit);
  const sourceCommitFull = asString(provenance.sourceCommitFull);
  const recordedSequenceDigest = asString(provenance.sequenceDigest);
  const maxAgeHours = provenance.maxAgeHours;
  const evidenceId = options.evidenceReport.evidence.evidenceId;
  const findings: PlaybookLifecycleSequenceEvidenceFreshnessFinding[] = [];

  if (!options.evidenceReport.ok) {
    findings.push({
      code: "invalid_evidence_report",
      severity: "error",
      message: `Sequence evidence freshness ${evidenceId} requires a green sequence evidence report.`,
    });
  }

  const provenanceShapeOk =
    hasNonEmptyString(sourceCommit) &&
    hasNonEmptyString(recordedSequenceDigest) &&
    isPositiveNumber(maxAgeHours);
  if (!provenanceShapeOk) {
    findings.push({
      code: "invalid_provenance",
      severity: "error",
      field: "provenance",
      message: `Sequence evidence freshness ${evidenceId} must include sourceCommit, sequenceDigest, and positive maxAgeHours.`,
    });
  }

  const sequenceDigestOk = recordedSequenceDigest === options.sequenceDigest;
  if (hasNonEmptyString(recordedSequenceDigest) && !sequenceDigestOk) {
    findings.push({
      code: "sequence_digest_mismatch",
      severity: "error",
      field: "provenance.sequenceDigest",
      message: `Sequence evidence freshness ${evidenceId} sequenceDigest must match the referenced sequence file digest.`,
    });
  }

  const currentCommitFull = options.currentCommitFull;
  const sourceCommitOk = hasNonEmptyString(sourceCommitFull)
    ? sourceCommitFull === currentCommitFull
    : hasNonEmptyString(sourceCommit) &&
      shortCommit(currentCommitFull, sourceCommit.length) === sourceCommit;
  if ((hasNonEmptyString(sourceCommit) || hasNonEmptyString(sourceCommitFull)) && !sourceCommitOk) {
    findings.push({
      code: "source_commit_mismatch",
      severity: "error",
      field: hasNonEmptyString(sourceCommitFull)
        ? "provenance.sourceCommitFull"
        : "provenance.sourceCommit",
      message: `Sequence evidence freshness ${evidenceId} source commit must match the current commit.`,
    });
  }

  const recordedAt = asString(input.recordedAt);
  const recordedAtMs = parseTime(recordedAt);
  const nowMs = parseTime(options.now);
  const normalizedMaxAgeHours = isPositiveNumber(maxAgeHours)
    ? maxAgeHours
    : undefined;
  const recordedAtOk = recordedAtMs !== undefined && nowMs !== undefined;
  const recordedAtInFuture =
    recordedAtMs !== undefined && nowMs !== undefined && recordedAtMs > nowMs;
  if (!recordedAtOk) {
    findings.push({
      code: "invalid_recorded_at",
      severity: "error",
      field: "recordedAt",
      message: `Sequence evidence freshness ${evidenceId} must include parseable recordedAt and now timestamps.`,
    });
  }
  if (recordedAtInFuture) {
    findings.push({
      code: "future_recorded_at",
      severity: "error",
      field: "recordedAt",
      message: `Sequence evidence freshness ${evidenceId} recordedAt must not be later than now.`,
    });
  }

  const ageHours =
    recordedAtMs !== undefined && nowMs !== undefined
      ? roundAgeHours(nowMs - recordedAtMs)
      : undefined;
  const evidenceFresh =
    recordedAtOk &&
    !recordedAtInFuture &&
    normalizedMaxAgeHours !== undefined &&
    typeof ageHours === "number" &&
    ageHours <= normalizedMaxAgeHours;
  if (
    recordedAtOk &&
    !recordedAtInFuture &&
    normalizedMaxAgeHours !== undefined &&
    !evidenceFresh
  ) {
    findings.push({
      code: "stale_evidence",
      severity: "error",
      field: "recordedAt",
      message: `Sequence evidence freshness ${evidenceId} is older than maxAgeHours.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    freshnessOnly: true,
    ...(options.evidencePath ? { evidencePath: options.evidencePath } : {}),
    evidence: {
      evidenceId,
      owner: options.evidenceReport.evidence.owner,
      sequencePath: options.evidenceReport.sequencePath,
    },
    provenance: {
      sourceCommit,
      ...(hasNonEmptyString(sourceCommitFull) ? { sourceCommitFull } : {}),
      currentCommit: shortCommit(currentCommitFull, sourceCommit.length || 7),
      currentCommitFull,
      sequenceDigest: recordedSequenceDigest,
      currentSequenceDigest: options.sequenceDigest,
      recordedAt,
      now: options.now,
      ...(typeof ageHours === "number" ? { ageHours } : {}),
      ...(normalizedMaxAgeHours !== undefined
        ? { maxAgeHours: normalizedMaxAgeHours }
        : {}),
    },
    summary: {
      findings: findings.length,
    },
    checks: {
      evidenceOk: options.evidenceReport.ok,
      provenanceShapeOk,
      sequenceDigestOk,
      sourceCommitOk,
      recordedAtOk,
      evidenceFresh,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:sequence:evidence:check"
      : "npm run playbook:lifecycle:sequence:evidence:freshness:check",
    nextAction: ok
      ? "Sequence evidence is fresh for the referenced commit and sequence digest."
      : "Refresh lifecycle sequence evidence before changing registered playbooks or fixtures.",
  };
}
