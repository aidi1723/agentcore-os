export const PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_SEQUENCE_COMMAND =
  "playbook:lifecycle:mutation:post-apply:sequence:check";

type GateReport = Record<string, unknown>;

export type PlaybookLifecycleMutationPostApplySequence = {
  sequenceId: string;
  owner: string;
  applyReportPath: string;
  manifestPath: string;
  dryRunPath: string;
  targetPlaybookId: string;
  orderedCommands: string[];
  applyExpectation: "mutation_apply_complete";
  controlAuditExpectation: "playbook_control_audit_green";
  handoffExpectation: "ready_for_lifecycle_handoff";
  fixtureExpectation: "governed_fixtures_green";
  fixtureSummaryExpectation: "governed_fixture_summary_green";
  runtimeTestExpectation: "controlled_runtime_green";
  coreWorkflowExpectation: "core_workflows_green";
  diffCheckExpectation: "git_diff_check_green";
  fixtureRefreshPolicy: "no_fixture_refresh_until_post_apply_audit_green";
  publishingPolicy: "no_publish_or_release";
  productionPolicy: "no_production_ready_claim";
  notes: string[];
};

export type PlaybookLifecycleMutationPostApplySequenceFinding = {
  code:
    | "invalid_sequence_shape"
    | "apply_report_not_green"
    | "sequence_apply_report_mismatch"
    | "invalid_command_sequence"
    | "invalid_apply_expectation"
    | "invalid_control_audit_expectation"
    | "invalid_handoff_expectation"
    | "invalid_fixture_expectation"
    | "invalid_fixture_summary_expectation"
    | "invalid_runtime_test_expectation"
    | "invalid_core_workflow_expectation"
    | "invalid_diff_check_expectation"
    | "invalid_fixture_refresh_policy"
    | "invalid_publishing_policy"
    | "invalid_production_policy";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

type ValidatePlaybookLifecycleMutationPostApplySequenceOptions = {
  sequencePath?: string;
  applyReport: GateReport;
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

function requiredPostApplyCommands() {
  return [
    "npm run playbook:control:audit",
    "npm run playbook:lifecycle:handoff",
    "npm run trace:fixtures --silent",
    "npm run trace:fixtures:summary --silent",
    "npm run test:controlled-runtime",
    "npm run test:core-workflows",
    "git diff --check",
  ];
}

function orderedCommandsMatch(actual: string[], expected: string[]) {
  if (actual.length !== expected.length) return false;
  return expected.every((command, index) => actual[index] === command);
}

function missingStringFinding(
  sequenceId: string,
  field: keyof PlaybookLifecycleMutationPostApplySequence,
): PlaybookLifecycleMutationPostApplySequenceFinding {
  return {
    code: "invalid_sequence_shape",
    severity: "error",
    field,
    message: `Post-apply audit sequence ${sequenceId} must include non-empty ${field}.`,
  };
}

function applyReportOk(report: GateReport) {
  const summary = isRecord(report.summary) ? report.summary : {};
  const boundary = isRecord(report.executionBoundary)
    ? report.executionBoundary
    : {};

  return (
    report.ok === true &&
    report.command === "playbook:lifecycle:mutation:executor" &&
    report.mode === "apply" &&
    report.status === "mutation_apply_complete" &&
    report.productionReady === false &&
    report.publishingPerformed === false &&
    report.mutationExecutorOnly === true &&
    report.readyForLifecycleMutationExecutor === true &&
    summary.findings === 0 &&
    typeof summary.mutatedTargets === "number" &&
    summary.mutatedTargets > 0 &&
    boundary.mutationExecutorOnly === true &&
    boundary.previewOnly === false &&
    boundary.applyConfirmed === true &&
    boundary.mutationPerformed === true &&
    boundary.fixtureRefreshPerformed === false &&
    boundary.storeWritesPerformed === false &&
    boundary.externalWritesPerformed === false &&
    boundary.publishingPerformed === false &&
    boundary.productionReady === false
  );
}

function applyReportDryRunPath(report: GateReport) {
  if (typeof report.dryRunPath === "string") return report.dryRunPath;
  const manifest = isRecord(report.manifest) ? report.manifest : {};
  return asString(manifest.dryRunPath);
}

function applyReportTargetPlaybookId(report: GateReport) {
  const manifest = isRecord(report.manifest) ? report.manifest : {};
  return asString(manifest.targetPlaybookId);
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationPostApplySequenceFinding[],
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("apply_report_not_green")) return "apply_report_not_green";
  if (findings.length > 0) return "post_apply_audit_sequence_not_valid";
  return "post_apply_audit_sequence_ready";
}

export function validatePlaybookLifecycleMutationPostApplySequence(
  sequence: unknown,
  options: ValidatePlaybookLifecycleMutationPostApplySequenceOptions,
) {
  const record = isRecord(sequence) ? sequence : {};
  const sequenceId = asString(record.sequenceId) || "unknown";
  const owner = asString(record.owner);
  const applyReportPath = asString(record.applyReportPath);
  const manifestPath = asString(record.manifestPath);
  const dryRunPath = asString(record.dryRunPath);
  const targetPlaybookId = asString(record.targetPlaybookId);
  const orderedCommands = asStringArray(record.orderedCommands);
  const requiredCommands = requiredPostApplyCommands();
  const findings: PlaybookLifecycleMutationPostApplySequenceFinding[] = [];

  for (const field of [
    "sequenceId",
    "owner",
    "applyReportPath",
    "manifestPath",
    "dryRunPath",
    "targetPlaybookId",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(sequenceId, field));
    }
  }

  const referencedApplyReportOk = applyReportOk(options.applyReport);
  if (!referencedApplyReportOk) {
    findings.push({
      code: "apply_report_not_green",
      severity: "error",
      path: applyReportPath,
      message: `Post-apply audit sequence ${sequenceId} references an apply report that is not a completed local mutation apply.`,
    });
  }

  const dryRunPathAligned =
    hasNonEmptyString(dryRunPath) &&
    applyReportDryRunPath(options.applyReport) === dryRunPath;
  if (hasNonEmptyString(dryRunPath) && !dryRunPathAligned) {
    findings.push({
      code: "sequence_apply_report_mismatch",
      severity: "error",
      field: "dryRunPath",
      path: dryRunPath,
      message: `Post-apply audit sequence ${sequenceId} dryRunPath must match the referenced apply report.`,
    });
  }

  const targetPlaybookAligned =
    hasNonEmptyString(targetPlaybookId) &&
    applyReportTargetPlaybookId(options.applyReport) === targetPlaybookId;
  if (hasNonEmptyString(targetPlaybookId) && !targetPlaybookAligned) {
    findings.push({
      code: "sequence_apply_report_mismatch",
      severity: "error",
      field: "targetPlaybookId",
      message: `Post-apply audit sequence ${sequenceId} targetPlaybookId must match the referenced apply report.`,
    });
  }

  const commandSequenceValid = orderedCommandsMatch(
    orderedCommands,
    requiredCommands,
  );
  if (!commandSequenceValid) {
    findings.push({
      code: "invalid_command_sequence",
      severity: "error",
      field: "orderedCommands",
      command: requiredCommands[0],
      message: `Post-apply audit sequence ${sequenceId} orderedCommands must include required commands in the exact post-apply order.`,
    });
  }

  const applyExpectationOk = record.applyExpectation === "mutation_apply_complete";
  if (!applyExpectationOk) {
    findings.push({
      code: "invalid_apply_expectation",
      severity: "error",
      field: "applyExpectation",
      message: `Post-apply audit sequence ${sequenceId} applyExpectation must be mutation_apply_complete.`,
    });
  }

  const controlAuditExpectationOk =
    record.controlAuditExpectation === "playbook_control_audit_green";
  if (!controlAuditExpectationOk) {
    findings.push({
      code: "invalid_control_audit_expectation",
      severity: "error",
      field: "controlAuditExpectation",
      message: `Post-apply audit sequence ${sequenceId} controlAuditExpectation must be playbook_control_audit_green.`,
    });
  }

  const handoffExpectationOk =
    record.handoffExpectation === "ready_for_lifecycle_handoff";
  if (!handoffExpectationOk) {
    findings.push({
      code: "invalid_handoff_expectation",
      severity: "error",
      field: "handoffExpectation",
      message: `Post-apply audit sequence ${sequenceId} handoffExpectation must be ready_for_lifecycle_handoff.`,
    });
  }

  const fixtureExpectationOk =
    record.fixtureExpectation === "governed_fixtures_green";
  if (!fixtureExpectationOk) {
    findings.push({
      code: "invalid_fixture_expectation",
      severity: "error",
      field: "fixtureExpectation",
      message: `Post-apply audit sequence ${sequenceId} fixtureExpectation must be governed_fixtures_green.`,
    });
  }

  const fixtureSummaryExpectationOk =
    record.fixtureSummaryExpectation === "governed_fixture_summary_green";
  if (!fixtureSummaryExpectationOk) {
    findings.push({
      code: "invalid_fixture_summary_expectation",
      severity: "error",
      field: "fixtureSummaryExpectation",
      message: `Post-apply audit sequence ${sequenceId} fixtureSummaryExpectation must be governed_fixture_summary_green.`,
    });
  }

  const runtimeTestExpectationOk =
    record.runtimeTestExpectation === "controlled_runtime_green";
  if (!runtimeTestExpectationOk) {
    findings.push({
      code: "invalid_runtime_test_expectation",
      severity: "error",
      field: "runtimeTestExpectation",
      message: `Post-apply audit sequence ${sequenceId} runtimeTestExpectation must be controlled_runtime_green.`,
    });
  }

  const coreWorkflowExpectationOk =
    record.coreWorkflowExpectation === "core_workflows_green";
  if (!coreWorkflowExpectationOk) {
    findings.push({
      code: "invalid_core_workflow_expectation",
      severity: "error",
      field: "coreWorkflowExpectation",
      message: `Post-apply audit sequence ${sequenceId} coreWorkflowExpectation must be core_workflows_green.`,
    });
  }

  const diffCheckExpectationOk =
    record.diffCheckExpectation === "git_diff_check_green";
  if (!diffCheckExpectationOk) {
    findings.push({
      code: "invalid_diff_check_expectation",
      severity: "error",
      field: "diffCheckExpectation",
      message: `Post-apply audit sequence ${sequenceId} diffCheckExpectation must be git_diff_check_green.`,
    });
  }

  const fixtureRefreshPolicyOk =
    record.fixtureRefreshPolicy ===
    "no_fixture_refresh_until_post_apply_audit_green";
  if (!fixtureRefreshPolicyOk) {
    findings.push({
      code: "invalid_fixture_refresh_policy",
      severity: "error",
      field: "fixtureRefreshPolicy",
      message: `Post-apply audit sequence ${sequenceId} fixtureRefreshPolicy must be no_fixture_refresh_until_post_apply_audit_green.`,
    });
  }

  const publishingPolicyOk = record.publishingPolicy === "no_publish_or_release";
  if (!publishingPolicyOk) {
    findings.push({
      code: "invalid_publishing_policy",
      severity: "error",
      field: "publishingPolicy",
      message: `Post-apply audit sequence ${sequenceId} publishingPolicy must be no_publish_or_release.`,
    });
  }

  const productionPolicyOk = record.productionPolicy === "no_production_ready_claim";
  if (!productionPolicyOk) {
    findings.push({
      code: "invalid_production_policy",
      severity: "error",
      field: "productionPolicy",
      message: `Post-apply audit sequence ${sequenceId} productionPolicy must be no_production_ready_claim.`,
    });
  }

  const ok = findings.length === 0;
  const status = statusFromFindings(findings);

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_SEQUENCE_COMMAND,
    productionReady: false as const,
    publishingPerformed: false as const,
    sequenceOnly: true as const,
    readyForPostApplyAuditSequence: ok,
    status,
    sequencePath: options.sequencePath,
    applyReportPath,
    manifestPath,
    dryRunPath,
    sequence: {
      sequenceId,
      owner,
      targetPlaybookId,
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      orderedCommands: orderedCommands.length,
    },
    checks: {
      applyReportOk: referencedApplyReportOk,
      dryRunPathAligned,
      targetPlaybookAligned,
      commandSequenceValid,
      applyExpectationOk,
      controlAuditExpectationOk,
      handoffExpectationOk,
      fixtureExpectationOk,
      fixtureSummaryExpectationOk,
      runtimeTestExpectationOk,
      coreWorkflowExpectationOk,
      diffCheckExpectationOk,
      noFixtureRefreshBeforeAudit: fixtureRefreshPolicyOk,
      publishingPolicyOk,
      productionPolicyOk,
    },
    requiredCommands,
    orderedCommands,
    findings,
    nextCommand: ok
      ? "npm run playbook:control:audit"
      : "npm run playbook:lifecycle:mutation:post-apply:sequence:check -- --sequence <path>",
    nextAction: ok
      ? "Post-apply audit sequence is declared; run and record the commands before refreshing fixtures, publishing, or claiming readiness."
      : "Fix post-apply audit sequence findings before running or recording post-apply audit evidence.",
  };
}
