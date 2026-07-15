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
import {
  validatePlaybookLifecycleSequenceEvidenceFreshness,
  type PlaybookLifecycleSequenceEvidenceFreshnessInput,
} from "@/lib/executor/playbooks/lifecycle-sequence-evidence-freshness";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const sequenceDigest =
  "617b2adbdbfa4732396d1738d1ac3eb5ec133f152a73654c6efe5c307d329ee6";
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

function buildSequenceReport() {
  const proposalReport = validatePlaybookLifecycleChangeProposal(
    buildValidProposal(),
    {
      proposalPath,
      fileExists: () => true,
    },
  );
  const migrationPlanReport = validatePlaybookLifecycleMigrationPlan(
    buildValidMigrationPlan(),
    {
      planPath: migrationPlanPath,
      proposalReport,
    },
  );
  return validatePlaybookLifecycleMaintenanceSequence(buildValidSequence(), {
    sequencePath,
    proposalReport,
    migrationPlanReport,
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
    ...overrides,
  };
}

function buildEvidenceReport(evidence = buildValidEvidence()) {
  return validatePlaybookLifecycleSequenceEvidence(evidence, {
    sequenceReport: buildSequenceReport(),
  });
}

function buildFreshnessInput(
  overrides: Partial<PlaybookLifecycleSequenceEvidenceFreshnessInput> = {},
): PlaybookLifecycleSequenceEvidenceFreshnessInput {
  return {
    recordedAt: "2026-07-07T02:30:00Z",
    provenance: {
      sourceCommit: fullCommit.slice(0, 7),
      sourceCommitFull: fullCommit,
      sequenceDigest,
      maxAgeHours: 24,
    },
    ...overrides,
  };
}

describe("validatePlaybookLifecycleSequenceEvidenceFreshness", () => {
  it("accepts fresh evidence with matching commit and sequence digest", () => {
    const report = validatePlaybookLifecycleSequenceEvidenceFreshness(
      buildFreshnessInput(),
      {
        evidenceReport: buildEvidenceReport(),
        currentCommitFull: fullCommit,
        sequenceDigest,
        now: "2026-07-07T03:00:00Z",
      },
    );

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:lifecycle:sequence:evidence:freshness:check",
      productionReady: false,
      publishingPerformed: false,
      freshnessOnly: true,
      summary: {
        findings: 0,
      },
      checks: {
        evidenceOk: true,
        sequenceDigestOk: true,
        sourceCommitOk: true,
        evidenceFresh: true,
      },
      findings: [],
    });
  });

  it("fails closed when evidence is older than its max age", () => {
    const report = validatePlaybookLifecycleSequenceEvidenceFreshness(
      buildFreshnessInput(),
      {
        evidenceReport: buildEvidenceReport(),
        currentCommitFull: fullCommit,
        sequenceDigest,
        now: "2026-07-09T03:00:01Z",
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "stale_evidence",
      severity: "error",
      field: "recordedAt",
      message:
        "Sequence evidence freshness evidence-sales-pipeline-v1-review is older than maxAgeHours.",
    });
  });

  it("fails closed when evidence is recorded in the future", () => {
    const report = validatePlaybookLifecycleSequenceEvidenceFreshness(
      buildFreshnessInput({
        recordedAt: "2026-07-07T04:00:00Z",
      }),
      {
        evidenceReport: buildEvidenceReport(),
        currentCommitFull: fullCommit,
        sequenceDigest,
        now: "2026-07-07T03:00:00Z",
      },
    );

    expect(report.ok).toBe(false);
    expect(report.checks.evidenceFresh).toBe(false);
    expect(report.findings).toContainEqual({
      code: "future_recorded_at",
      severity: "error",
      field: "recordedAt",
      message:
        "Sequence evidence freshness evidence-sales-pipeline-v1-review recordedAt must not be later than now.",
    });
    expect(report.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "stale_evidence",
        }),
      ]),
    );
  });

  it("fails closed when the recorded sequence digest does not match", () => {
    const report = validatePlaybookLifecycleSequenceEvidenceFreshness(
      buildFreshnessInput({
        provenance: {
          sourceCommit: fullCommit.slice(0, 7),
          sourceCommitFull: fullCommit,
          sequenceDigest: "stale-digest",
          maxAgeHours: 24,
        },
      }),
      {
        evidenceReport: buildEvidenceReport(),
        currentCommitFull: fullCommit,
        sequenceDigest,
        now: "2026-07-07T03:00:00Z",
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "sequence_digest_mismatch",
      severity: "error",
      field: "provenance.sequenceDigest",
      message:
        "Sequence evidence freshness evidence-sales-pipeline-v1-review sequenceDigest must match the referenced sequence file digest.",
    });
  });

  it("fails closed when the recorded source commit does not match", () => {
    const report = validatePlaybookLifecycleSequenceEvidenceFreshness(
      buildFreshnessInput({
        provenance: {
          sourceCommit: "old1111",
          sourceCommitFull: "old11110000000000000000000000000000000000",
          sequenceDigest,
          maxAgeHours: 24,
        },
      }),
      {
        evidenceReport: buildEvidenceReport(),
        currentCommitFull: fullCommit,
        sequenceDigest,
        now: "2026-07-07T03:00:00Z",
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "source_commit_mismatch",
      severity: "error",
      field: "provenance.sourceCommitFull",
      message:
        "Sequence evidence freshness evidence-sales-pipeline-v1-review source commit must match the current commit.",
    });
  });
});
