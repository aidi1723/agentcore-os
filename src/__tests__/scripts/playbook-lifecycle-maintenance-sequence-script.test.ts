import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MAINTENANCE_SEQUENCE_COMMAND,
  buildPlaybookLifecycleMaintenanceSequenceCliResult,
  parsePlaybookLifecycleMaintenanceSequenceArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-maintenance-sequence.mjs";

const proposalPath =
  "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
const migrationPlanPath =
  "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";
const sequencePath =
  "docs/playbook-lifecycle-maintenance-sequences/example-version-update-sequence.json";

const proposalRequiredCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];
const migrationRequiredCommands = [
  `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];
const orderedCommands = [
  `npm run playbook:lifecycle:change:check -- --proposal ${proposalPath}`,
  `npm run playbook:lifecycle:migration:plan:check -- --plan ${migrationPlanPath}`,
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];

function createSequenceFixture(sequenceOverrides = {}, planOverrides = {}, proposalOverrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-maintenance-sequence-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-change-proposals"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-migration-plans"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-maintenance-sequences"), {
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
    join(cwd, migrationPlanPath),
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
  writeFileSync(
    join(cwd, sequencePath),
    `${JSON.stringify(
      {
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
        ...sequenceOverrides,
      },
      null,
      2,
    )}\n`,
  );

  return { cwd, sequencePath };
}

describe("playbook lifecycle maintenance sequence script", () => {
  it("parses sequence and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMaintenanceSequenceArgs([
        "--sequence",
        "sequence.json",
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      sequencePath: "sequence.json",
    });
  });

  it("requires a sequence path", () => {
    expect(() => parsePlaybookLifecycleMaintenanceSequenceArgs([])).toThrow(
      "--sequence <path> is required",
    );
  });

  it("builds a successful CLI result for a valid maintenance sequence file", () => {
    const { cwd, sequencePath } = createSequenceFixture();
    const result = buildPlaybookLifecycleMaintenanceSequenceCliResult({
      cwd,
      sequencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MAINTENANCE_SEQUENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      sequenceOnly: true,
      sequencePath,
      proposalPath,
      migrationPlanPath,
      summary: {
        findings: 0,
        requiredCommands: 5,
        orderedCommands: 5,
      },
    });
  });

  it("returns non-zero for an invalid maintenance sequence file", () => {
    const { cwd, sequencePath } = createSequenceFixture({
      orderedCommands: ["npm run playbook:lifecycle:handoff"],
    });
    const result = buildPlaybookLifecycleMaintenanceSequenceCliResult({
      cwd,
      sequencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "invalid_command_sequence",
        },
      ],
    });
  });

  it("rejects invalid JSON maintenance sequence files", () => {
    const { cwd, sequencePath } = createSequenceFixture();
    writeFileSync(join(cwd, sequencePath), "not json");

    expect(() =>
      buildPlaybookLifecycleMaintenanceSequenceCliResult({
        cwd,
        sequencePath,
      }),
    ).toThrow("maintenance sequence file is not valid JSON");
  });
});
