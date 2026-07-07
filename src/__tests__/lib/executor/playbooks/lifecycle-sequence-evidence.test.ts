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
import {
  validatePlaybookLifecycleSequenceEvidence,
  type PlaybookLifecycleSequenceEvidence,
} from "@/lib/executor/playbooks/lifecycle-sequence-evidence";

const proposalPath =
  "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
const migrationPlanPath =
  "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";
const sequencePath =
  "docs/playbook-lifecycle-maintenance-sequences/example-version-update-sequence.json";

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

function buildSequenceReport(sequence = buildValidSequence()) {
  return validatePlaybookLifecycleMaintenanceSequence(sequence, {
    sequencePath,
    proposalReport: buildProposalReport(),
    migrationPlanReport: buildMigrationPlanReport(),
  });
}

function buildValidEvidence(
  overrides: Partial<PlaybookLifecycleSequenceEvidence> = {},
): PlaybookLifecycleSequenceEvidence {
  return {
    evidenceId: "evidence-sales-pipeline-v1-review",
    sequencePath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T02:30:00Z",
    commandResults: [
      {
        command: orderedCommands[0],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T02:30:01Z",
      },
      {
        command: orderedCommands[1],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T02:30:02Z",
      },
      {
        command: orderedCommands[2],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T02:30:03Z",
        handoffOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
      {
        command: orderedCommands[3],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T02:30:04Z",
        fixtureGate: "governed_fixtures_green",
      },
      {
        command: orderedCommands[4],
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T02:30:05Z",
        testFiles: 63,
        tests: 323,
      },
    ],
    sequenceResult: {
      ok: true,
      sequenceOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    mutationSummary: {
      performed: false,
      changedPaths: [],
    },
    publishingSummary: {
      performed: false,
      targets: [],
    },
    approvalStatus: "evidence_only",
    ...overrides,
  };
}

describe("validatePlaybookLifecycleSequenceEvidence", () => {
  it("accepts complete local evidence for a green maintenance sequence", () => {
    const report = validatePlaybookLifecycleSequenceEvidence(buildValidEvidence(), {
      sequenceReport: buildSequenceReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:lifecycle:sequence:evidence:check",
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      sequencePath,
      evidence: {
        evidenceId: "evidence-sales-pipeline-v1-review",
        owner: "agentcore-runtime-maintainers",
      },
      summary: {
        findings: 0,
        requiredCommands: 5,
        commandResults: 5,
      },
      checks: {
        sequenceOk: true,
        commandResultsOrdered: true,
        commandResultsGreen: true,
        sequenceBoundaryOk: true,
        handoffBoundaryOk: true,
        fixtureEvidenceOk: true,
        runtimeEvidenceOk: true,
        mutationSummaryOk: true,
        publishingSummaryOk: true,
        approvalStatusOk: true,
      },
      findings: [],
      nextCommand: "npm run playbook:lifecycle:handoff",
    });
  });

  it("fails closed when command evidence is missing or out of order", () => {
    const report = validatePlaybookLifecycleSequenceEvidence(
      buildValidEvidence({
        commandResults: [
          {
            command: "npm run playbook:lifecycle:handoff",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T02:30:03Z",
          },
        ],
      }),
      {
        sequenceReport: buildSequenceReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_command_evidence_sequence",
      severity: "error",
      field: "commandResults",
      command: orderedCommands[0],
      message:
        "Sequence evidence evidence-sales-pipeline-v1-review commandResults must match the referenced sequence commands in order.",
    });
  });

  it("requires boundary metadata for sequence and handoff evidence", () => {
    const report = validatePlaybookLifecycleSequenceEvidence(
      buildValidEvidence({
        sequenceResult: {
          ok: true,
          sequenceOnly: false,
          productionReady: true,
          publishingPerformed: false,
        },
        commandResults: buildValidEvidence().commandResults.map((result) =>
          result.command === "npm run playbook:lifecycle:handoff"
            ? {
                ...result,
                handoffOnly: false,
                productionReady: true,
              }
            : result,
        ),
      }),
      {
        sequenceReport: buildSequenceReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_sequence_boundary",
      severity: "error",
      field: "sequenceResult",
      message:
        "Sequence evidence evidence-sales-pipeline-v1-review must record sequenceOnly true with productionReady false and publishingPerformed false.",
    });
    expect(report.findings).toContainEqual({
      code: "invalid_handoff_boundary",
      severity: "error",
      field: "commandResults",
      command: "npm run playbook:lifecycle:handoff",
      message:
        "Sequence evidence evidence-sales-pipeline-v1-review must record lifecycle handoff as handoffOnly true with productionReady false and publishingPerformed false.",
    });
  });

  it("requires mutation and publishing summaries to stay false", () => {
    const report = validatePlaybookLifecycleSequenceEvidence(
      buildValidEvidence({
        mutationSummary: {
          performed: true,
          changedPaths: ["src/lib/executor/playbooks/catalog.ts"],
        },
        publishingSummary: {
          performed: true,
          targets: ["github-release"],
        },
      }),
      {
        sequenceReport: buildSequenceReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "mutation_performed",
      severity: "error",
      field: "mutationSummary",
      message:
        "Sequence evidence evidence-sales-pipeline-v1-review must record mutationSummary.performed as false.",
    });
    expect(report.findings).toContainEqual({
      code: "publishing_performed",
      severity: "error",
      field: "publishingSummary",
      message:
        "Sequence evidence evidence-sales-pipeline-v1-review must record publishingSummary.performed as false.",
    });
  });
});
