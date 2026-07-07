import { describe, expect, it } from "vitest";

import {
  validatePlaybookLifecycleChangeProposal,
  type PlaybookLifecycleChangeProposal,
} from "@/lib/executor/playbooks/lifecycle-change-proposal";
import {
  validatePlaybookLifecycleMigrationPlan,
  type PlaybookLifecycleMigrationPlan,
} from "@/lib/executor/playbooks/lifecycle-migration-plan";

const proposalPath =
  "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
const requiredCommands = [
  `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
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

function buildValidPlan(
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
    requiredCommands,
    fixtureReview: {
      expectedFixtureIds: ["sales-pipeline-governed"],
      refreshRequired: false,
      notes: ["No fixture refresh is performed by this plan checker."],
    },
    mutationPolicy: "no_mutation_until_plan_approved",
    ...overrides,
  };
}

describe("validatePlaybookLifecycleMigrationPlan", () => {
  it("accepts a complete local version update migration plan", () => {
    const report = validatePlaybookLifecycleMigrationPlan(buildValidPlan(), {
      proposalReport: buildProposalReport(),
    });

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:lifecycle:migration:plan:check",
      productionReady: false,
      publishingPerformed: false,
      planOnly: true,
      summary: {
        findings: 0,
        requiredCommands: 4,
        plannedChanges: 1,
        rollbackSteps: 1,
        expectedFixtureIds: 1,
      },
      plan: {
        planId: "migration-sales-pipeline-v1-review",
        migrationType: "version_update",
        fromPlaybookId: "sales-pipeline-v1",
        toPlaybookId: "sales-pipeline-v1",
        owner: "agentcore-runtime-maintainers",
      },
      findings: [],
      nextCommand: "npm run playbook:lifecycle:handoff",
    });
  });

  it("fails closed when required migration commands are missing", () => {
    const report = validatePlaybookLifecycleMigrationPlan(
      buildValidPlan({
        requiredCommands: ["npm run playbook:lifecycle:handoff"],
      }),
      {
        proposalReport: buildProposalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "missing_required_command",
      severity: "error",
      message:
        "Migration plan migration-sales-pipeline-v1-review must include required command: npm run trace:fixtures --silent.",
      command: "npm run trace:fixtures --silent",
    });
    expect(report.nextCommand).toBe("npm run playbook:lifecycle:migration:plan:check");
  });

  it("fails closed when the referenced proposal is invalid", () => {
    const invalidProposal = buildProposalReport(
      buildValidProposal({
        requiredCommands: ["npm run playbook:control:audit"],
      }),
    );
    const report = validatePlaybookLifecycleMigrationPlan(buildValidPlan(), {
      proposalReport: invalidProposal,
    });

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_referenced_proposal",
      severity: "error",
      message:
        "Migration plan migration-sales-pipeline-v1-review references a proposal that is not green.",
      path: proposalPath,
    });
  });

  it("requires the no-mutation policy before migration planning can pass", () => {
    const report = validatePlaybookLifecycleMigrationPlan(
      buildValidPlan({
        mutationPolicy: "apply_after_tests" as PlaybookLifecycleMigrationPlan["mutationPolicy"],
      }),
      {
        proposalReport: buildProposalReport(),
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "invalid_mutation_policy",
      severity: "error",
      field: "mutationPolicy",
      message:
        "Migration plan migration-sales-pipeline-v1-review mutationPolicy must be no_mutation_until_plan_approved.",
    });
  });
});
