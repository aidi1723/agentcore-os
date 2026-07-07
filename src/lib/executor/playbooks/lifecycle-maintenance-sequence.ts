import type { PlaybookLifecycleChangeProposalReport } from "@/lib/executor/playbooks/lifecycle-change-proposal";
import type { PlaybookLifecycleMigrationPlanReport } from "@/lib/executor/playbooks/lifecycle-migration-plan";

export const PLAYBOOK_LIFECYCLE_MAINTENANCE_SEQUENCE_COMMAND =
  "playbook:lifecycle:sequence:check";

export type PlaybookLifecycleMaintenanceSequence = {
  sequenceId: string;
  owner: string;
  proposalPath: string;
  migrationPlanPath: string;
  orderedCommands: string[];
  handoffExpectation: "ready_for_lifecycle_handoff";
  fixtureExpectation: "governed_fixtures_green";
  runtimeTestExpectation: "controlled_runtime_green";
  mutationPolicy: "no_mutation_until_sequence_green";
  publishingPolicy: "no_publish_or_release";
  notes: string[];
};

export type PlaybookLifecycleMaintenanceSequenceFinding = {
  code:
    | "invalid_sequence_shape"
    | "invalid_referenced_proposal"
    | "invalid_referenced_migration_plan"
    | "sequence_plan_mismatch"
    | "invalid_command_sequence"
    | "invalid_handoff_expectation"
    | "invalid_fixture_expectation"
    | "invalid_runtime_test_expectation"
    | "invalid_mutation_policy"
    | "invalid_publishing_policy";
  severity: "error";
  message: string;
  field?: string;
  command?: string;
  path?: string;
};

export type PlaybookLifecycleMaintenanceSequenceReport = {
  ok: boolean;
  command: typeof PLAYBOOK_LIFECYCLE_MAINTENANCE_SEQUENCE_COMMAND;
  productionReady: false;
  publishingPerformed: false;
  sequenceOnly: true;
  sequencePath?: string;
  proposalPath: string;
  migrationPlanPath: string;
  sequence: {
    sequenceId: string;
    owner: string;
  };
  summary: {
    findings: number;
    requiredCommands: number;
    orderedCommands: number;
  };
  checks: {
    proposalOk: boolean;
    migrationPlanOk: boolean;
    proposalPathAligned: boolean;
    migrationPlanPathAligned: boolean;
    commandSequenceValid: boolean;
    handoffExpectationOk: boolean;
    fixtureExpectationOk: boolean;
    runtimeTestExpectationOk: boolean;
    mutationPolicyOk: boolean;
    publishingPolicyOk: boolean;
  };
  findings: PlaybookLifecycleMaintenanceSequenceFinding[];
  nextCommand: string;
  nextAction: string;
};

type ValidatePlaybookLifecycleMaintenanceSequenceOptions = {
  sequencePath?: string;
  proposalReport: PlaybookLifecycleChangeProposalReport;
  migrationPlanReport: PlaybookLifecycleMigrationPlanReport;
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

function requiredSequenceCommands(proposalPath: string, migrationPlanPath: string) {
  return [
    `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
    `npm run playbook:lifecycle:migration:plan:check -- --plan ${migrationPlanPath}`,
    "npm run playbook:lifecycle:handoff",
    "npm run trace:fixtures --silent",
    "npm run test:controlled-runtime",
  ];
}

function missingStringFinding(
  sequenceId: string,
  field: keyof PlaybookLifecycleMaintenanceSequence,
): PlaybookLifecycleMaintenanceSequenceFinding {
  return {
    code: "invalid_sequence_shape",
    severity: "error",
    field,
    message: `Maintenance sequence ${sequenceId} must include non-empty ${field}.`,
  };
}

function orderedCommandsMatch(actual: string[], expected: string[]) {
  if (actual.length !== expected.length) return false;
  return expected.every((command, index) => actual[index] === command);
}

export function validatePlaybookLifecycleMaintenanceSequence(
  sequence: unknown,
  options: ValidatePlaybookLifecycleMaintenanceSequenceOptions,
): PlaybookLifecycleMaintenanceSequenceReport {
  const record = isRecord(sequence) ? sequence : {};
  const sequenceId = asString(record.sequenceId) || "unknown";
  const owner = asString(record.owner);
  const proposalPath = asString(record.proposalPath);
  const migrationPlanPath = asString(record.migrationPlanPath);
  const orderedCommands = asStringArray(record.orderedCommands);
  const requiredCommands = requiredSequenceCommands(proposalPath, migrationPlanPath);
  const findings: PlaybookLifecycleMaintenanceSequenceFinding[] = [];

  for (const field of [
    "sequenceId",
    "owner",
    "proposalPath",
    "migrationPlanPath",
  ] as const) {
    if (!hasNonEmptyString(record[field])) {
      findings.push(missingStringFinding(sequenceId, field));
    }
  }

  if (!options.proposalReport.ok) {
    findings.push({
      code: "invalid_referenced_proposal",
      severity: "error",
      path: proposalPath,
      message: `Maintenance sequence ${sequenceId} references a proposal that is not green.`,
    });
  }

  if (!options.migrationPlanReport.ok) {
    findings.push({
      code: "invalid_referenced_migration_plan",
      severity: "error",
      path: migrationPlanPath,
      message: `Maintenance sequence ${sequenceId} references a migration plan that is not green.`,
    });
  }

  const proposalPathAligned =
    hasNonEmptyString(proposalPath) &&
    options.migrationPlanReport.proposalPath === proposalPath;
  if (hasNonEmptyString(proposalPath) && !proposalPathAligned) {
    findings.push({
      code: "sequence_plan_mismatch",
      severity: "error",
      field: "proposalPath",
      message: `Maintenance sequence ${sequenceId} proposalPath must match the referenced migration plan proposalPath.`,
    });
  }

  const migrationPlanPathAligned =
    !options.migrationPlanReport.planPath ||
    options.migrationPlanReport.planPath === migrationPlanPath;
  if (hasNonEmptyString(migrationPlanPath) && !migrationPlanPathAligned) {
    findings.push({
      code: "sequence_plan_mismatch",
      severity: "error",
      field: "migrationPlanPath",
      path: migrationPlanPath,
      message: `Maintenance sequence ${sequenceId} migrationPlanPath must match the referenced migration plan path.`,
    });
  }

  const commandSequenceValid = orderedCommandsMatch(orderedCommands, requiredCommands);
  if (!commandSequenceValid) {
    findings.push({
      code: "invalid_command_sequence",
      severity: "error",
      field: "orderedCommands",
      command: requiredCommands[0],
      message: `Maintenance sequence ${sequenceId} orderedCommands must include required commands in the exact lifecycle order.`,
    });
  }

  const handoffExpectationOk =
    record.handoffExpectation === "ready_for_lifecycle_handoff";
  if (!handoffExpectationOk) {
    findings.push({
      code: "invalid_handoff_expectation",
      severity: "error",
      field: "handoffExpectation",
      message: `Maintenance sequence ${sequenceId} handoffExpectation must be ready_for_lifecycle_handoff.`,
    });
  }

  const fixtureExpectationOk =
    record.fixtureExpectation === "governed_fixtures_green";
  if (!fixtureExpectationOk) {
    findings.push({
      code: "invalid_fixture_expectation",
      severity: "error",
      field: "fixtureExpectation",
      message: `Maintenance sequence ${sequenceId} fixtureExpectation must be governed_fixtures_green.`,
    });
  }

  const runtimeTestExpectationOk =
    record.runtimeTestExpectation === "controlled_runtime_green";
  if (!runtimeTestExpectationOk) {
    findings.push({
      code: "invalid_runtime_test_expectation",
      severity: "error",
      field: "runtimeTestExpectation",
      message: `Maintenance sequence ${sequenceId} runtimeTestExpectation must be controlled_runtime_green.`,
    });
  }

  const mutationPolicyOk =
    record.mutationPolicy === "no_mutation_until_sequence_green";
  if (!mutationPolicyOk) {
    findings.push({
      code: "invalid_mutation_policy",
      severity: "error",
      field: "mutationPolicy",
      message: `Maintenance sequence ${sequenceId} mutationPolicy must be no_mutation_until_sequence_green.`,
    });
  }

  const publishingPolicyOk = record.publishingPolicy === "no_publish_or_release";
  if (!publishingPolicyOk) {
    findings.push({
      code: "invalid_publishing_policy",
      severity: "error",
      field: "publishingPolicy",
      message: `Maintenance sequence ${sequenceId} publishingPolicy must be no_publish_or_release.`,
    });
  }

  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MAINTENANCE_SEQUENCE_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    sequenceOnly: true,
    ...(options.sequencePath ? { sequencePath: options.sequencePath } : {}),
    proposalPath,
    migrationPlanPath,
    sequence: {
      sequenceId,
      owner,
    },
    summary: {
      findings: findings.length,
      requiredCommands: requiredCommands.length,
      orderedCommands: orderedCommands.length,
    },
    checks: {
      proposalOk: options.proposalReport.ok,
      migrationPlanOk: options.migrationPlanReport.ok,
      proposalPathAligned,
      migrationPlanPathAligned,
      commandSequenceValid,
      handoffExpectationOk,
      fixtureExpectationOk,
      runtimeTestExpectationOk,
      mutationPolicyOk,
      publishingPolicyOk,
    },
    findings,
    nextCommand: ok
      ? "npm run playbook:lifecycle:handoff"
      : "npm run playbook:lifecycle:sequence:check",
    nextAction: ok
      ? "Maintenance sequence contract is green; run declared local checks before any playbook mutation."
      : "Fix maintenance sequence findings before changing registered playbooks or fixtures.",
  };
}
