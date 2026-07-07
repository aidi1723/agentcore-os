import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND,
  buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult,
  parsePlaybookLifecycleSequenceEvidenceFreshnessArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-sequence-evidence-freshness.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
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

function createFreshnessFixture(evidenceOverrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-sequence-freshness-"));
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
      },
      null,
      2,
    )}\n`,
  );
  const sequenceJson = `${JSON.stringify(
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
    },
    null,
    2,
  )}\n`;
  writeFileSync(join(cwd, sequencePath), sequenceJson);

  const sequenceDigest = createHash("sha256").update(sequenceJson).digest("hex");
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
            testFiles: 65,
            tests: 332,
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
        provenance: {
          sourceCommit: fullCommit.slice(0, 7),
          sourceCommitFull: fullCommit,
          sequenceDigest,
          maxAgeHours: 24,
        },
        ...evidenceOverrides,
      },
      null,
      2,
    )}\n`,
  );

  return { cwd, evidencePath };
}

describe("playbook lifecycle sequence evidence freshness script", () => {
  it("parses evidence, compact, now, and current commit arguments", () => {
    expect(
      parsePlaybookLifecycleSequenceEvidenceFreshnessArgs([
        "--evidence",
        "evidence.json",
        "--now",
        "2026-07-07T03:00:00Z",
        "--current-commit",
        fullCommit,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      evidencePath: "evidence.json",
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });
  });

  it("requires an evidence path", () => {
    expect(() =>
      parsePlaybookLifecycleSequenceEvidenceFreshnessArgs([]),
    ).toThrow("--evidence <path> is required");
  });

  it("builds a successful CLI result for fresh evidence", () => {
    const { cwd, evidencePath } = createFreshnessFixture();
    const result = buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult({
      cwd,
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      freshnessOnly: true,
      evidencePath,
      checks: {
        evidenceOk: true,
        sequenceDigestOk: true,
        sourceCommitOk: true,
        evidenceFresh: true,
      },
    });
  });

  it("returns non-zero for stale evidence", () => {
    const { cwd, evidencePath } = createFreshnessFixture();
    const result = buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult({
      cwd,
      evidencePath,
      now: "2026-07-09T03:00:01Z",
      currentCommit: fullCommit,
      pretty: false,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "stale_evidence",
        }),
      ]),
    );
  });

  it("returns non-zero for evidence recorded in the future", () => {
    const { cwd, evidencePath } = createFreshnessFixture({
      recordedAt: "2026-07-07T04:00:00Z",
    });
    const result = buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult({
      cwd,
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "future_recorded_at",
        }),
      ]),
    );
  });

  it("rejects invalid JSON evidence files", () => {
    const { cwd, evidencePath } = createFreshnessFixture();
    writeFileSync(join(cwd, evidencePath), "not json");

    expect(() =>
      buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult({
        cwd,
        evidencePath,
      }),
    ).toThrow("sequence evidence file is not valid JSON");
  });
});
