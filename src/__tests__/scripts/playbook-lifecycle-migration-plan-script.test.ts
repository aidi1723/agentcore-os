import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND,
  buildPlaybookLifecycleMigrationPlanCliResult,
  parsePlaybookLifecycleMigrationPlanArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-migration-plan.mjs";

const proposalPath =
  "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
const planPath = "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";
const migrationRequiredCommands = [
  `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];
const proposalRequiredCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];

function createPlanFixture(planOverrides = {}, proposalOverrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-migration-plan-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-change-proposals"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-migration-plans"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/superpowers/specs"), { recursive: true });
  mkdirSync(join(cwd, "docs/superpowers/plans"), { recursive: true });
  writeFileSync(
    join(
      cwd,
      "docs/superpowers/specs/2026-07-07-playbook-lifecycle-change-proposal-contract-design.md",
    ),
    "# Spec\n",
  );
  writeFileSync(
    join(
      cwd,
      "docs/superpowers/plans/2026-07-07-playbook-lifecycle-change-proposal-contract.md",
    ),
    "# Plan\n",
  );
  writeFileSync(
    join(cwd, proposalPath),
    `${JSON.stringify(
      {
        proposalId: "proposal-sales-pipeline-v1-review",
        changeType: "version_update",
        playbookId: "sales-pipeline-v1",
        owner: "agentcore-runtime-maintainers",
        reason: "Refresh the sales pipeline playbook contract after lifecycle review.",
        specPath:
          "docs/superpowers/specs/2026-07-07-playbook-lifecycle-change-proposal-contract-design.md",
        planPath:
          "docs/superpowers/plans/2026-07-07-playbook-lifecycle-change-proposal-contract.md",
        requiredCommands: proposalRequiredCommands,
        expectedFixtureIds: ["sales-pipeline-governed"],
        riskNotes: ["No fixture mutation is performed by the proposal checker."],
        ...proposalOverrides,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(cwd, planPath),
    `${JSON.stringify(
      {
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
        requiredCommands: migrationRequiredCommands,
        fixtureReview: {
          expectedFixtureIds: ["sales-pipeline-governed"],
          refreshRequired: false,
          notes: ["No fixture refresh is performed by this plan checker."],
        },
        mutationPolicy: "no_mutation_until_plan_approved",
        ...planOverrides,
      },
      null,
      2,
    )}\n`,
  );

  return { cwd, planPath };
}

describe("playbook lifecycle migration plan script", () => {
  it("parses plan and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMigrationPlanArgs(["--plan", "plan.json", "--compact"]),
    ).toEqual({
      pretty: false,
      planPath: "plan.json",
    });
  });

  it("requires a plan path", () => {
    expect(() => parsePlaybookLifecycleMigrationPlanArgs([])).toThrow(
      "--plan <path> is required",
    );
  });

  it("builds a successful CLI result for a valid migration plan file", () => {
    const { cwd, planPath } = createPlanFixture();
    const result = buildPlaybookLifecycleMigrationPlanCliResult({
      cwd,
      planPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      planOnly: true,
      planPath,
      proposalPath,
      summary: {
        findings: 0,
        requiredCommands: 4,
        expectedFixtureIds: 1,
      },
    });
  });

  it("returns non-zero for an invalid migration plan file", () => {
    const { cwd, planPath } = createPlanFixture({
      requiredCommands: ["npm run playbook:lifecycle:handoff"],
    });
    const result = buildPlaybookLifecycleMigrationPlanCliResult({
      cwd,
      planPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      summary: {
        findings: 3,
      },
    });
  });

  it("rejects invalid JSON migration plan files", () => {
    const { cwd, planPath } = createPlanFixture();
    writeFileSync(join(cwd, planPath), "not json");

    expect(() =>
      buildPlaybookLifecycleMigrationPlanCliResult({
        cwd,
        planPath,
      }),
    ).toThrow("migration plan file is not valid JSON");
  });
});
