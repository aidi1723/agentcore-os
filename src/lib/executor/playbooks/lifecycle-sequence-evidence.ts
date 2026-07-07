import type { PlaybookLifecycleMaintenanceSequenceReport } from "@/lib/executor/playbooks/lifecycle-maintenance-sequence";

export const PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND =
  "playbook:lifecycle:sequence:evidence:check";

export type PlaybookLifecycleSequenceEvidenceCommandResult = {
  command: string;
  ok: boolean;
  exitCode: number;
  recordedAt: string;
  handoffOnly?: boolean;
  productionReady?: boolean;
  publishingPerformed?: boolean;
  fixtureGate?: "governed_fixtures_green";
  testFiles?: number;
  tests?: number;
};

export type PlaybookLifecycleSequenceEvidence = {
  evidenceId: string;
  sequencePath: string;
  owner: string;
  recordedAt: string;
  commandResults: PlaybookLifecycleSequenceEvidenceCommandResult[];
  sequenceResult: {
    ok: boolean;
    sequenceOnly: boolean;
    productionReady: boolean;
    publishingPerformed: boolean;
  };
  mutationSummary: {
    performed: boolean;
    changedPaths: string[];
  };
  publishingSummary: {
    performed: boolean;
    targets: string[];
  };
  approvalStatus: "evidence_only";
};

export type PlaybookLifecycleSequenceEvidenceFinding = {
  code:
    | "invalid_evidence_shape"
    | "invalid_referenced_sequence"
    | "invalid_command_evidence_sequence"
    | "command_not_green"
    | "invalid_sequence_boundary"
    | "invalid_handoff_boundary"
    | "invalid_fixture_evidence"
    | "invalid_runtime_evidence"
    | "mutation_performed"
    | "publishing_performed"
    | "invalid_approval_status";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

export type PlaybookLifecycleSequenceEvidenceReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  evidenceOnly: true;
  evidencePath?: string;
  sequencePath: string;
  evidence: {
    evidenceId: string;
    owner: string;
  };
  summary: {
    findings: number;
    requiredCommands: number;
    commandResults: number;
  };
  checks: {
    sequenceOk: boolean;
    commandResultsOrdered: boolean;
    commandResultsGreen: boolean;
    sequenceBoundaryOk: boolean;
    handoffBoundaryOk: boolean;
    fixtureEvidenceOk: boolean;
    runtimeEvidenceOk: boolean;
    mutationSummaryOk: boolean;
    publishingSummaryOk: boolean;
    approvalStatusOk: boolean;
  };
  findings: PlaybookLifecycleSequenceEvidenceFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleSequenceEvidenceOptions = {
  evidencePath?: string;
  sequenceReport: PlaybookLifecycleMaintenanceSequenceReport;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asCommandResults(value: unknown): PlaybookLifecycleSequenceEvidenceCommandResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PlaybookLifecycleSequenceEvidenceCommandResult => {
    if (!isRecord(item)) return false;
    return (
      typeof item.command === "string" &&
      typeof item.ok === "boolean" &&
      typeof item.exitCode === "number" &&
      typeof item.recordedAt === "string"
    );
  });
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function expectedCommandsFromSequenceReport(
  sequenceReport: PlaybookLifecycleMaintenanceSequenceReport,
) {
  return [
    `npm run playbook:lifecycle:change:check -- --proposal ${sequenceReport.proposalPath}`,
    `npm run playbook:lifecycle:migration:plan:check -- --plan ${sequenceReport.migrationPlanPath}`,
    "npm run playbook:lifecycle:handoff",
    "npm run trace:fixtures --silent",
    "npm run test:controlled-runtime",
  ];
}

function orderedCommandsMatch(
  results: PlaybookLifecycleSequenceEvidenceCommandResult[],
  expected: string[],
) {
  if (results.length !== expected.length) return false;
  return expected.every((command, index) => results[index]?.command === command);
}

function missingStringFinding(
  evidenceId: string,
  field: keyof PlaybookLifecycleSequenceEvidence,
): PlaybookLifecycleSequenceEvidenceFinding {
  return {
    code: "invalid_evidence_shape",
    severity: "error",
    field,
    message: `Sequence evidence ${evidenceId} must include non-empty ${field}.`,
  };
}

export function validatePlaybookLifecycleSequenceEvidence(
  evidence: unknown,
  options: ValidatePlaybookLifecycleSequenceEvidenceOptions,
): PlaybookLifecycleSequenceEvidenceReport {
  const record = isRecord(evidence) ? evidence : {};
  const evidenceId = asString(record.evidenceId) || "unknown";
  const owner = asString(record.owner);
  const sequencePath = asString(record.sequencePath);
  const commandResults = asCommandResults(record.commandResults);
  const expectedCommands = expectedCommandsFromSequenceReport(options.sequenceReport);
  const findings: PlaybookLifecycleSequenceEvidenceFinding[] = [];

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
      message: `Sequence evidence ${evidenceId} references a maintenance sequence that is not green.`,
    });
  }

  const commandResultsOrdered = orderedCommandsMatch(commandResults, expectedCommands);
  if (!commandResultsOrdered) {
    findings.push({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandResults",
      command: expectedCommands[0],
      message: `Sequence evidence ${evidenceId} commandResults must match the referenced sequence commands in order.`,
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
      message: `Sequence evidence ${evidenceId} commandResults must all record ok true, exitCode 0, and recordedAt.`,
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
      message: `Sequence evidence ${evidenceId} must record sequenceOnly true with productionReady false and publishingPerformed false.`,
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
      message: `Sequence evidence ${evidenceId} must record lifecycle handoff as handoffOnly true with productionReady false and publishingPerformed false.`,
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
      message: `Sequence evidence ${evidenceId} must record governed fixture evidence as governed_fixtures_green.`,
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
      message: `Sequence evidence ${evidenceId} must record positive controlled runtime testFiles and tests counts.`,
    });
  }

  const mutationSummary = isRecord(record.mutationSummary) ? record.mutationSummary : {};
  const mutationSummaryOk = mutationSummary.performed === false;
  if (!mutationSummaryOk) {
    findings.push({
      code: "mutation_performed",
      severity: "error",
      field: "mutationSummary",
      message: `Sequence evidence ${evidenceId} must record mutationSummary.performed as false.`,
    });
  }

  const publishingSummary = isRecord(record.publishingSummary)
    ? record.publishingSummary
    : {};
  const publishingSummaryOk = publishingSummary.performed === false;
  if (!publishingSummaryOk) {
    findings.push({
      code: "publishing_performed",
      severity: "error",
      field: "publishingSummary",
      message: `Sequence evidence ${evidenceId} must record publishingSummary.performed as false.`,
    });
  }

  const approvalStatusOk = record.approvalStatus === "evidence_only";
  if (!approvalStatusOk) {
    findings.push({
      code: "invalid_approval_status",
      severity: "error",
      field: "approvalStatus",
      message: `Sequence evidence ${evidenceId} approvalStatus must be evidence_only.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    ...(options.evidencePath ? { evidencePath: options.evidencePath } : {}),
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
      handoffBoundaryOk,
      fixtureEvidenceOk,
      runtimeEvidenceOk,
      mutationSummaryOk,
      publishingSummaryOk,
      approvalStatusOk,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:handoff"
      : "npm run playbook:lifecycle:sequence:evidence:check",
    nextAction: ok
      ? "Sequence evidence contract is green; keep this as local evidence before any playbook mutation."
      : "Fix sequence evidence findings before changing registered playbooks or fixtures.",
  };
}
