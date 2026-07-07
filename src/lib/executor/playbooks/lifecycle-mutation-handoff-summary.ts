import {
  validatePlaybookLifecycleMutationReleaseHandoffReview,
} from "@/lib/executor/playbooks/lifecycle-mutation-release-handoff-review";

export const PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND =
  "playbook:lifecycle:mutation:handoff:summary:check";

export type PlaybookLifecycleMutationHandoffSummaryCommand = {
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

export type PlaybookLifecycleMutationHandoffSummary = {
  summaryId: string;
  releaseHandoffReviewPath: string;
  owner: string;
  recordedAt: string;
  handoffSummary: {
    targetPlaybookId: string;
    lifecycleMutationStatus: string;
    evidenceChainStatus: string;
    localReleaseClaim: string;
    maintainerDecision: string;
    nextBoundary: string;
  };
  commandSummary: PlaybookLifecycleMutationHandoffSummaryCommand[];
  riskSummary: {
    productionReady: boolean;
    publishingApproved: boolean;
    externalWritesApproved: boolean;
    deferredItems: string[];
  };
  rollbackSummary: {
    rollbackAvailable: boolean;
    rollbackNotes: string[];
  };
  releaseHandoffReviewResult: {
    ok: boolean;
    reviewOnly: boolean;
    productionReady: boolean;
    publishingPerformed: boolean;
  };
  handoffSummaryBoundary: {
    summaryOnly: boolean;
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
  approvalStatus: "handoff_summary_review";
  notes: string[];
};

export type PlaybookLifecycleMutationHandoffSummaryFinding = {
  code:
    | "invalid_summary_shape"
    | "invalid_release_handoff_review"
    | "handoff_summary_missing"
    | "invalid_command_summary_sequence"
    | "command_summary_not_green"
    | "invalid_command_summary_metadata"
    | "risk_summary_missing"
    | "rollback_summary_missing"
    | "invalid_release_handoff_review_boundary"
    | "handoff_summary_side_effect_performed"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type ReleaseHandoffReviewReport = ReturnType<
  typeof validatePlaybookLifecycleMutationReleaseHandoffReview
>;

type ValidatePlaybookLifecycleMutationHandoffSummaryOptions = {
  summaryPath?: string;
  releaseHandoffReviewReport: ReleaseHandoffReviewReport;
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

function asCommandSummary(
  value: unknown,
): PlaybookLifecycleMutationHandoffSummaryCommand[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PlaybookLifecycleMutationHandoffSummaryCommand => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function missingStringFinding(
  summaryId: string,
  field: keyof PlaybookLifecycleMutationHandoffSummary,
): PlaybookLifecycleMutationHandoffSummaryFinding {
  return {
    code: "invalid_summary_shape",
    severity: "error",
    field,
    message: `Handoff summary ${summaryId} must include non-empty ${field}.`,
  };
}

function expectedCommands(releaseHandoffReviewPath: string) {
  return [
    `npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review ${releaseHandoffReviewPath}`,
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "npm run lint",
    "npm run build",
    "git diff --check",
  ];
}

function orderedCommandsMatch(
  results: PlaybookLifecycleMutationHandoffSummaryCommand[],
  expected: string[],
) {
  if (results.length !== expected.length) return false;
  return expected.every((command, index) => results[index]?.command === command);
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationHandoffSummaryFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("invalid_release_handoff_review")) {
    return "release_handoff_review_not_green";
  }
  if (findings.length > 0) return "handoff_summary_not_valid";
  return "handoff_summary_ready";
}

function commandByName(
  commandSummary: PlaybookLifecycleMutationHandoffSummaryCommand[],
  command: string,
) {
  return commandSummary.find((entry) => entry.command === command);
}

export function validatePlaybookLifecycleMutationHandoffSummary(
  summary: unknown,
  options: ValidatePlaybookLifecycleMutationHandoffSummaryOptions,
) {
  const record = isRecord(summary) ? summary : {};
  const summaryId = asString(record.summaryId) || "unknown";
  const releaseHandoffReviewPath = asString(record.releaseHandoffReviewPath);
  const owner = asString(record.owner);
  const commandSummary = asCommandSummary(record.commandSummary);
  const requiredCommands = expectedCommands(releaseHandoffReviewPath);
  const findings: PlaybookLifecycleMutationHandoffSummaryFinding[] = [];

  for (const field of [
    "summaryId",
    "releaseHandoffReviewPath",
    "owner",
    "recordedAt",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(summaryId, field));
    }
  }

  const releaseHandoffReviewOk =
    options.releaseHandoffReviewReport.ok === true &&
    options.releaseHandoffReviewReport.readyForLocalReleaseHandoffReview === true &&
    options.releaseHandoffReviewReport.productionReady === false &&
    options.releaseHandoffReviewReport.publishingPerformed === false &&
    options.releaseHandoffReviewReport.reviewOnly === true;
  if (!releaseHandoffReviewOk) {
    findings.push({
      code: "invalid_release_handoff_review",
      severity: "error",
      path: releaseHandoffReviewPath,
      message: `Handoff summary ${summaryId} requires green release handoff review evidence.`,
    });
  }

  const handoff = isRecord(record.handoffSummary) ? record.handoffSummary : {};
  const handoffSummaryComplete =
    hasNonEmptyString(handoff.targetPlaybookId) &&
    hasNonEmptyString(handoff.lifecycleMutationStatus) &&
    handoff.evidenceChainStatus === "release_handoff_review_green" &&
    handoff.localReleaseClaim === "local_release_handoff_ready" &&
    hasNonEmptyString(handoff.maintainerDecision) &&
    hasNonEmptyString(handoff.nextBoundary);
  if (!handoffSummaryComplete) {
    findings.push({
      code: "handoff_summary_missing",
      severity: "error",
      field: "handoffSummary",
      message: `Handoff summary ${summaryId} must record target, evidence chain status, maintainer decision, and next boundary.`,
    });
  }

  const commandSummaryOrdered = orderedCommandsMatch(commandSummary, requiredCommands);
  if (!commandSummaryOrdered) {
    findings.push({
      code: "invalid_command_summary_sequence",
      severity: "error",
      field: "commandSummary",
      command: requiredCommands[0],
      message: `Handoff summary ${summaryId} commandSummary must match the required commands in order.`,
    });
  }

  const commandSummaryGreen =
    commandSummary.length > 0 &&
    commandSummary.every(
      (entry) =>
        entry.ok === true &&
        entry.exitCode === 0 &&
        hasNonEmptyString(entry.recordedAt),
    );
  if (!commandSummaryGreen) {
    findings.push({
      code: "command_summary_not_green",
      severity: "error",
      field: "commandSummary",
      message: `Handoff summary ${summaryId} commandSummary entries must all record ok true, exitCode 0, and recordedAt.`,
    });
  }

  const reviewEntry = commandByName(commandSummary, requiredCommands[0]);
  const controlledRuntimeEntry = commandByName(
    commandSummary,
    "npm run test:controlled-runtime",
  );
  const coreWorkflowEntry = commandByName(
    commandSummary,
    "npm run test:core-workflows",
  );
  const lintEntry = commandByName(commandSummary, "npm run lint");
  const buildEntry = commandByName(commandSummary, "npm run build");
  const diffEntry = commandByName(commandSummary, "git diff --check");
  const commandMetadataOk =
    reviewEntry?.gate === "release_handoff_review_green" &&
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
      code: "invalid_command_summary_metadata",
      severity: "error",
      field: "commandSummary",
      message: `Handoff summary ${summaryId} commandSummary must include review, runtime, workflow, lint, build, and diff metadata.`,
    });
  }

  const risk = isRecord(record.riskSummary) ? record.riskSummary : {};
  const riskSummaryOk =
    risk.productionReady === false &&
    risk.publishingApproved === false &&
    risk.externalWritesApproved === false &&
    asStringArray(risk.deferredItems).length > 0;
  if (!riskSummaryOk) {
    findings.push({
      code: "risk_summary_missing",
      severity: "error",
      field: "riskSummary",
      message: `Handoff summary ${summaryId} must record non-production risk boundaries and deferred items.`,
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
      message: `Handoff summary ${summaryId} must record rollback availability and rollback notes.`,
    });
  }

  const reviewBoundary = isRecord(record.releaseHandoffReviewResult)
    ? record.releaseHandoffReviewResult
    : {};
  const releaseHandoffReviewBoundaryOk =
    reviewBoundary.ok === true &&
    reviewBoundary.reviewOnly === true &&
    reviewBoundary.productionReady === false &&
    reviewBoundary.publishingPerformed === false;
  if (!releaseHandoffReviewBoundaryOk) {
    findings.push({
      code: "invalid_release_handoff_review_boundary",
      severity: "error",
      field: "releaseHandoffReviewResult",
      message: `Handoff summary ${summaryId} must record release handoff review as green and non-production.`,
    });
  }

  const boundary = isRecord(record.handoffSummaryBoundary)
    ? record.handoffSummaryBoundary
    : {};
  const handoffSummaryBoundaryOk =
    boundary.summaryOnly === true &&
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
  if (!handoffSummaryBoundaryOk) {
    findings.push({
      code: "handoff_summary_side_effect_performed",
      severity: "error",
      field: "handoffSummaryBoundary",
      message: `Handoff summary ${summaryId} must record summary-only behavior with no checker execution, snapshot generation, publishing, tag, package, upload, production readiness, or readiness claim.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "handoff_summary_review";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Handoff summary ${summaryId} approvalStatus must be handoff_summary_review.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    summaryOnly: true as const,
    readyForMaintainerHandoffSummary: ok,
    status: statusFromFindings(findings),
    summaryPath: options.summaryPath,
    releaseHandoffReviewPath,
    handoff: {
      summaryId,
      owner,
      targetPlaybookId: asString(handoff.targetPlaybookId),
      maintainerDecision: asString(handoff.maintainerDecision),
      nextBoundary: asString(handoff.nextBoundary),
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      commandSummary: commandSummary.length,
      deferredItems: asStringArray(risk.deferredItems).length,
    },
    checks: {
      releaseHandoffReviewOk,
      handoffSummaryComplete,
      commandSummaryOrdered,
      commandSummaryGreen,
      commandMetadataOk,
      riskSummaryOk,
      rollbackSummaryOk,
      releaseHandoffReviewBoundaryOk,
      handoffSummaryBoundaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "start unified policy/guardrail hardening or authoring workflow hardening"
      : "npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary <path>",
    nextAction: ok
      ? "Handoff summary is green for non-production maintainer review; publishing and production readiness remain separate phases."
      : "Fix handoff summary findings before using this summary for maintainer handoff.",
  };
}
