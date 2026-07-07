import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_REPLACEMENT_EVIDENCE_COMMAND,
  buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult,
  parsePlaybookLifecycleMutationPostReplacementEvidenceArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-post-replacement-evidence.mjs";

const replacementHandoffPath =
  "docs/playbook-lifecycle-mutation-fixture-replacement-handoffs/example-version-update-fixture-replacement-handoff.json";
const candidateFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const committedFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const exampleEvidencePath =
  "docs/playbook-lifecycle-mutation-post-replacement-evidence/example-version-update-post-replacement-evidence.json";
const handoffCommand = `npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff ${replacementHandoffPath}`;

function createEvidenceFile(overrides = {}) {
  const cwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "playbook-post-replacement-evidence-"));
  const evidencePath = join(dir, "post-replacement-evidence.json");
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        evidenceId: "post-replacement-evidence-sales-pipeline-v1",
        replacementHandoffPath,
        owner: "agentcore-runtime-maintainers",
        recordedAt: "2026-07-07T10:10:00Z",
        replacementSummary: {
          committedFixtureReplacementPerformed: true,
          catalogFixtureId: "sales-pipeline-governed",
          targetPlaybookId: "sales-pipeline-v1",
          candidateFixturePath,
          committedFixturePath,
          replacementReviewedInGitDiff: true,
          rollbackAvailable: true,
          rollbackNotes: [
            "Revert the committed fixture JSON replacement if governed fixture validation fails.",
          ],
        },
        commandResults: [
          {
            command: handoffCommand,
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:10:01Z",
            fixtureReplacementHandoff: "fixture_replacement_handoff_green",
            handoffOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: "npm run trace:fixtures --silent",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:10:02Z",
            fixtureGate: "governed_fixtures_green",
          },
          {
            command: "npm run trace:fixtures:summary --silent",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:10:03Z",
            fixtureSummaryGate: "governed_fixture_summary_green",
          },
          {
            command: "npm run test:controlled-runtime",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:10:04Z",
            testFiles: 89,
            tests: 457,
          },
          {
            command: "npm run test:core-workflows",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:10:05Z",
            coreWorkflowGate: "core_workflows_green",
          },
          {
            command: "git diff --check",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:10:06Z",
            diffCheck: "git_diff_check_green",
          },
        ],
        replacementHandoffResult: {
          ok: true,
          handoffOnly: true,
          productionReady: false,
          publishingPerformed: false,
        },
        postReplacementBoundary: {
          evidenceOnly: true,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
          readinessClaimed: false,
        },
        approvalStatus: "post_replacement_fixture_evidence",
        notes: ["This evidence validates recorded commands only."],
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, evidencePath };
}

describe("playbook lifecycle mutation post-replacement evidence script", () => {
  it("parses evidence and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationPostReplacementEvidenceArgs([
        "--evidence",
        exampleEvidencePath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      evidencePath: exampleEvidencePath,
    });
  });

  it("requires an evidence path", () => {
    expect(() => parsePlaybookLifecycleMutationPostReplacementEvidenceArgs([])).toThrow(
      "--evidence <path> is required",
    );
  });

  it("builds a successful CLI result for valid post-replacement evidence", () => {
    const { cwd, evidencePath } = createEvidenceFile();
    const result = buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_POST_REPLACEMENT_EVIDENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      readyForReleaseHandoffReview: true,
      evidencePath,
      replacementHandoffPath,
      summary: {
        findings: 0,
        requiredCommands: 6,
        commandResults: 6,
      },
    });
  });

  it("returns non-zero when replacement summary is not aligned", () => {
    const { cwd, evidencePath } = createEvidenceFile({
      replacementSummary: {
        committedFixtureReplacementPerformed: true,
        catalogFixtureId: "support-resolution-governed",
        targetPlaybookId: "support-resolution-v1",
        candidateFixturePath,
        committedFixturePath,
        replacementReviewedInGitDiff: true,
        rollbackAvailable: true,
        rollbackNotes: ["Rollback scoped fixture replacement."],
      },
    });
    const result = buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "replacement_summary_mismatch",
        },
      ],
    });
  });

  it("returns non-zero when command evidence is incomplete", () => {
    const { cwd, evidencePath } = createEvidenceFile({
      commandResults: [],
    });
    const result = buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
          code: "invalid_command_evidence_sequence",
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({
          code: "command_not_green",
      }),
    );
  });

  it("rejects invalid JSON post-replacement evidence files", () => {
    const { cwd, evidencePath } = createEvidenceFile();
    writeFileSync(evidencePath, "not json");

    expect(() =>
      buildPlaybookLifecycleMutationPostReplacementEvidenceCliResult({
        cwd,
        evidencePath,
      }),
    ).toThrow("post-replacement evidence file is not valid JSON");
  });
});
