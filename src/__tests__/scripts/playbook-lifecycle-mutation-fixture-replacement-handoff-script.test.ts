import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND,
  buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult,
  parsePlaybookLifecycleMutationFixtureReplacementHandoffArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-fixture-replacement-handoff.mjs";

const candidateReviewPath =
  "docs/playbook-lifecycle-mutation-candidate-fixture-reviews/example-version-update-candidate-fixture-review.json";
const candidateFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const committedFixturePath =
  "src/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
const exampleHandoffPath =
  "docs/playbook-lifecycle-mutation-fixture-replacement-handoffs/example-version-update-fixture-replacement-handoff.json";

function createHandoffFile(overrides = {}) {
  const cwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "playbook-fixture-replacement-handoff-"));
  const handoffPath = join(dir, "fixture-replacement-handoff.json");
  writeFileSync(
    handoffPath,
    `${JSON.stringify(
      {
        handoffId: "fixture-replacement-handoff-sales-pipeline-v1",
        owner: "agentcore-runtime-maintainers",
        candidateReviewPath,
        catalogFixtureId: "sales-pipeline-governed",
        targetPlaybookId: "sales-pipeline-v1",
        candidateFixturePath,
        committedFixturePath,
        replacementReason:
          "Prepare explicit manual committed fixture replacement after candidate review.",
        rollbackEvidence: {
          priorCommittedFixtureReviewed: true,
          replacementDiffReviewPlanned: true,
          scopedRestorePath: true,
          restorePlanDocumented: true,
          rollbackNotes: [
            "If post-replacement validation fails, revert only the committed governed fixture JSON change before retrying review.",
          ],
        },
        postReplacementValidationPlan: {
          governedFixtureCatalogGate: true,
          fixtureSummaryGate: true,
          controlledRuntimeGate: true,
          coreWorkflowGate: true,
          diffCheckGate: true,
          postReplacementEvidenceRequired: true,
        },
        replacementBoundary: {
          handoffOnly: true,
          committedFixtureReplacementPerformed: false,
          candidateFixtureGenerated: false,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
        },
        replacementPolicy: "manual_replacement_requires_post_replacement_evidence",
        publishingPolicy: "no_publish_or_release",
        productionPolicy: "no_production_ready_claim",
        approvalStatus: "fixture_replacement_handoff_only",
        notes: ["This handoff does not replace committed fixture JSON."],
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, handoffPath };
}

describe("playbook lifecycle mutation fixture replacement handoff script", () => {
  it("parses handoff and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationFixtureReplacementHandoffArgs([
        "--handoff",
        exampleHandoffPath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      handoffPath: exampleHandoffPath,
    });
  });

  it("requires a handoff path", () => {
    expect(() => parsePlaybookLifecycleMutationFixtureReplacementHandoffArgs([])).toThrow(
      "--handoff <path> is required",
    );
  });

  it("builds a successful CLI result for a valid fixture replacement handoff", () => {
    const { cwd, handoffPath } = createHandoffFile();
    const result = buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult({
      cwd,
      handoffPath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REPLACEMENT_HANDOFF_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      handoffOnly: true,
      readyForManualCommittedFixtureReplacement: true,
      handoffPath,
      candidateReviewPath,
      candidateFixturePath,
      committedFixturePath,
      summary: {
        findings: 0,
      },
    });
  });

  it("returns non-zero when rollback evidence is incomplete", () => {
    const { cwd, handoffPath } = createHandoffFile({
      rollbackEvidence: {
        priorCommittedFixtureReviewed: true,
        replacementDiffReviewPlanned: false,
        scopedRestorePath: true,
        restorePlanDocumented: true,
        rollbackNotes: [],
      },
    });
    const result = buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult({
      cwd,
      handoffPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "incomplete_rollback_evidence",
        },
      ],
    });
  });

  it("returns non-zero when committed fixture path is outside governed fixtures", () => {
    const dir = mkdtempSync(join(tmpdir(), "playbook-fixture-replacement-outside-"));
    mkdirSync(join(dir, "tmp"), { recursive: true });
    const { cwd, handoffPath } = createHandoffFile({
      committedFixturePath: "output/tmp/replacement.fixture.json",
    });
    const result = buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult({
      cwd,
      handoffPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "fixture_path_mismatch",
        },
        {
          code: "committed_fixture_path_out_of_scope",
        },
      ],
    });
  });

  it("rejects invalid JSON fixture replacement handoff files", () => {
    const { cwd, handoffPath } = createHandoffFile();
    writeFileSync(handoffPath, "not json");

    expect(() =>
      buildPlaybookLifecycleMutationFixtureReplacementHandoffCliResult({
        cwd,
        handoffPath,
      }),
    ).toThrow("fixture replacement handoff file is not valid JSON");
  });
});
