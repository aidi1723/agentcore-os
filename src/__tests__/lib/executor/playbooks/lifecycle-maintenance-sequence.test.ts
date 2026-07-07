import { describe, expect, it } from "vitest";

import {
  validatePlaybookLifecycleChangeProposal,
  type PlaybookLifecycleChangeProposal,
} from "@/lib/executor/playbooks/lifecycle-change-proposal";
import {
  validatePlaybookLifecycleMaintenanceSequence,
  type PlaybookLifecycleMaintenanceSequence,
} from "@/lib/executor/playbooks/lifecycle-maintenance-sequence";
import {
  validatePlaybookLifecycleMigrationPlan,
  type PlaybookLifecycleMigrationPlan,
} from "@/lib/executor/playbooks/lifecycle-migration-plan";

const proposalPath =
  "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
const migrationPlanPath =
  "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";

const orderedCommands = [
  `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
  `npm run playbook:lifecycle:migration:plan:check -- --plan ${migrationPlanPath}`,
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];

function buildValidProposal(
  overrides: Partial<PlaybookLifecycleChangeProposal> = {},
): PlaybookLifecycleChangeProposal {
  return {
    proposalId: "proposal-sales-pipeline-v1-review",
    changeType: "version_update",
    playbookId: "sales-pipeline-v1",
    owner: "agentcore-runtime-maintainers",
    reason: "Refresh the sales pipeline playbook contract after lifecycle review.",
    specPath:
      "docs/superpowers/specs/2026-07-07-playbook-lifecycle-change-proposal-contract-design.md",
    planPath:
      "docs/superpowers/plans/2026-07-07-playbook-lifecycle-change-proposal-contract.md",
    requiredCommands: [
      "npm run playbook:control:audit",
      "npm run playbook:lifecycle:handoff",
      "npm run trace:fixtures --silent",
      "npm run test:controlled-runtime",
    ],
    expectedFixtureIds: ["sales-pipeline-governed"],
    riskNotes: ["No fixture mutation is performed by the proposal checker."],
    ...overrides,
  };
}

function buildProposalReport(proposal = buildValidProposal()) {
  return validatePlaybookLifecycleChangeProposal(proposal, {
    proposalPath,
    fileExists: () => true,
  });
}

function buildValidMigrationPlan(
  overrides: Partial<PlaybookLifecycleMigrationPlan> = {},
): PlaybookLifecycleMigrationPlan {
  return {
    planId: "migration-sales-pipeline-v1-review",
    proposalPath,
    migrationType: "version_update",
    fromPlaybookId: "sales-pipeline-v1",
    toPlaybookId: "sales-pipeline-v1",
    owner: "agentcore-runtime-maintainers",
    plannedChanges: [
      "Review lifecycle metadata and fixture expectations before editing the registered playbook.",
    ],
    rollbackPlan: [
      "Revert the playbook contract commit and rerun lifecycle handoff before retrying.",
    ],
    requiredCommands: [
      `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
      "npm run playbook:lifecycle:handoff",
      "npm run trace:fixtures --silent",
      "npm run test:controlled-runtime",
    ],
    fixtureReview: {
      expectedFixtureIds: ["sales-pipeline-governed"],
      refreshRequired: false,
      notes: ["No fixture refresh is performed by this plan checker."],
    },
    mutationPolicy: "no_mutation_until_plan_approved",
    ...overrides,
  };
}

function buildMigrationPlanReport(plan = buildValidMigrationPlan()) {
  return validatePlaybookLifecycleMigrationPlan(plan, {
    planPath: migrationPlanPath,
    proposalReport: buildProposalReport(),
  });
}

function buildValidSequence(
  overrides: Partial<PlaybookLifecycleMaintenanceSequence> = {},
): PlaybookLifecycleMaintenanceSequence {
  return {
    sequenceId: "sequence-sales-pipeline-v1-review",
    owner: "agentcore-runtime-maintainers",
    proposalPath,
    migrationPlanPath,
    orderedCommands,
    handoffExpectation: "ready_for_lifecycle_handoff",
    fixtureExpectation: "governed_fixtures_green",
    runtimeTestExpectation: "controlled_runtime_green",
    mutationPolicy: "no_mutation_until_sequence_green",
    publishingPolicy: "no_publish_or_release",
    notes: ["This sequence checker does not execute the declared commands."],
    ...overrides,
  };
}

describe("validatePlaybookLifecycleMaintenanceSequence", () => {
  it("accepts a complete local version update maintenance sequence", () => {
    const report = validatePlaybookLifecycleMaintenanceSequence(buildValidSequence(), {
      proposalReport: buildProposalReport(),
      migrationPlanReport: buildMigrationPlanReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:lifecycle:sequence:check",
      productionReady: false,
      publishingPerformed: false,
      sequenceOnly: true,
      summary: {
        findings: 0,
        requiredCommands: 5,
        orderedCommands: 5,
      },
      sequence: {
        sequenceId: "sequence-sales-pipeline-v1-review",
        owner: "agentcore-runtime-maintainers",
      },
      checks: {
        proposalOk: true,
        migrationPlanOk: true,
        proposalPathAligned: true,
        commandSequenceValid: true,
        mutationPolicyOk: true,
        publishingPolicyOk: true,
      },
      findings: [],
      nextCommand: "npm run playbook:lifecycle:handoff",
    });
  });

  it("fails closed when commands are missing or out of order", () => {
    const report = validatePlaybookLifecycleMaintenanceSequence(
      buildValidSequence({
        orderedCommands: [
          "npm run playbook:lifecycle:handoff",
          `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
        ],
      }),
      {
        proposalReport: buildProposalReport(),
        migrationPlanReport: buildMigrationPlanReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_command_sequence",
      severity: "error",
      field: "orderedCommands",
      command: `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
      message:
        "Maintenance sequence sequence-sales-pipeline-v1-review orderedCommands must include required commands in the exact lifecycle order.",
    });
    expect(report.nextCommand).toBe("npm run playbook:lifecycle:sequence:check");
  });

  it("fails closed when sequence and migration plan proposal paths diverge", () => {
    const report = validatePlaybookLifecycleMaintenanceSequence(
      buildValidSequence({
        proposalPath: "docs/playbook-lifecycle-change-proposals/other-proposal.json",
      }),
      {
        proposalReport: buildProposalReport(),
        migrationPlanReport: buildMigrationPlanReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "sequence_plan_mismatch",
      severity: "error",
      field: "proposalPath",
      message:
        "Maintenance sequence sequence-sales-pipeline-v1-review proposalPath must match the referenced migration plan proposalPath.",
    });
  });

  it("requires no-mutation and no-publish policies before the sequence can pass", () => {
    const report = validatePlaybookLifecycleMaintenanceSequence(
      buildValidSequence({
        mutationPolicy:
          "mutate_after_tests" as PlaybookLifecycleMaintenanceSequence["mutationPolicy"],
        publishingPolicy:
          "publish_after_handoff" as PlaybookLifecycleMaintenanceSequence["publishingPolicy"],
      }),
      {
        proposalReport: buildProposalReport(),
        migrationPlanReport: buildMigrationPlanReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_mutation_policy",
      severity: "error",
      field: "mutationPolicy",
      message:
        "Maintenance sequence sequence-sales-pipeline-v1-review mutationPolicy must be no_mutation_until_sequence_green.",
    });
    expect(report.findings).toContainEqual({
      code: "invalid_publishing_policy",
      severity: "error",
      field: "publishingPolicy",
      message:
        "Maintenance sequence sequence-sales-pipeline-v1-review publishingPolicy must be no_publish_or_release.",
    });
  });
});
