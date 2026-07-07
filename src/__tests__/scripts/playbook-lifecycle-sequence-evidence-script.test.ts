import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND,
  buildPlaybookLifecycleSequenceEvidenceCliResult,
  parsePlaybookLifecycleSequenceEvidenceArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-sequence-evidence.mjs";

const proposalPath =
  "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
const migrationPlanPath =
  "docs/playbook-lifecycle-migration-plans/example-version-update-plan.json";
const sequencePath =
  "docs/playbook-lifecycle-maintenance-sequences/example-version-update-sequence.json";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";

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

function createEvidenceFixture(
  evidenceOverrides = {},
  sequenceOverrides = {},
  planOverrides = {},
  proposalOverrides = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-sequence-evidence-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-change-proposals"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-migration-plans"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-maintenance-sequences"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-sequence-evidence"), {
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
  writeFileSync(
    join(cwd, evidencePath),
    `${JSON.stringify(
      {
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
        ...evidenceOverrides,
      },
      null,
      2,
    )}\n`,
  );

  return { cwd, evidencePath };
}

describe("playbook lifecycle sequence evidence script", () => {
  it("parses evidence and compact arguments", () => {
    expect(
      parsePlaybookLifecycleSequenceEvidenceArgs([
        "--evidence",
        "evidence.json",
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      evidencePath: "evidence.json",
    });
  });

  it("requires an evidence path", () => {
    expect(() => parsePlaybookLifecycleSequenceEvidenceArgs([])).toThrow(
      "--evidence <path> is required",
    );
  });

  it("builds a successful CLI result for a valid evidence file", () => {
    const { cwd, evidencePath } = createEvidenceFixture();
    const result = buildPlaybookLifecycleSequenceEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      evidencePath,
      sequencePath,
      summary: {
        findings: 0,
        requiredCommands: 5,
        commandResults: 5,
      },
    });
  });

  it("returns non-zero for invalid evidence", () => {
    const { cwd, evidencePath } = createEvidenceFixture({
      commandResults: [
        {
          command: "npm run playbook:lifecycle:handoff",
          ok: true,
          exitCode: 0,
          recordedAt: "2026-07-07T02:30:03Z",
        },
      ],
    });
    const result = buildPlaybookLifecycleSequenceEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_command_evidence_sequence",
        }),
      ]),
    );
  });

  it("rejects invalid JSON evidence files", () => {
    const { cwd, evidencePath } = createEvidenceFixture();
    writeFileSync(join(cwd, evidencePath), "not json");

    expect(() =>
      buildPlaybookLifecycleSequenceEvidenceCliResult({
        cwd,
        evidencePath,
      }),
    ).toThrow("sequence evidence file is not valid JSON");
  });
});
