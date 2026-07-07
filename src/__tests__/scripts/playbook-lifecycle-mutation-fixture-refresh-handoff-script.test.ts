import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REFRESH_HANDOFF_COMMAND,
  buildPlaybookLifecycleMutationFixtureRefreshHandoffCliResult,
  parsePlaybookLifecycleMutationFixtureRefreshHandoffArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-fixture-refresh-handoff.mjs";

const applyReportPath =
  "docs/playbook-lifecycle-mutation-apply-reports/example-version-update-apply-report.json";
const manifestPath =
  "docs/playbook-lifecycle-mutation-manifests/example-version-update-manifest.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const sequencePath =
  "docs/playbook-lifecycle-mutation-post-apply-sequences/example-version-update-post-apply-sequence.json";
const evidencePath =
  "docs/playbook-lifecycle-mutation-post-apply-evidence/example-version-update-post-apply-evidence.json";
const handoffPath =
  "docs/playbook-lifecycle-mutation-fixture-refresh-handoffs/example-version-update-fixture-refresh-handoff.json";

const postApplyCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run trace:fixtures:summary --silent",
  "npm run test:controlled-runtime",
  "npm run test:core-workflows",
  "git diff --check",
];

function createFixtureRefreshHandoffFixture(
  handoffOverrides = {},
  evidenceOverrides = {},
  sequenceOverrides = {},
  applyOverrides = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-fixture-refresh-handoff-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-apply-reports"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-post-apply-sequences"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-post-apply-evidence"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-fixture-refresh-handoffs"), {
    recursive: true,
  });
  writeFileSync(
    join(cwd, applyReportPath),
    `${JSON.stringify(
      {
        ok: true,
        command: "playbook:lifecycle:mutation:executor",
        mode: "apply",
        status: "mutation_apply_complete",
        productionReady: false,
        publishingPerformed: false,
        mutationExecutorOnly: true,
        readyForLifecycleMutationExecutor: true,
        manifest: {
          manifestId: "mutation-manifest-sales-pipeline-v1-review",
          dryRunPath,
          targetPlaybookId: "sales-pipeline-v1",
        },
        dryRunPath,
        summary: {
          findings: 0,
          targets: 1,
          mutatedTargets: 1,
        },
        executionBoundary: {
          mutationExecutorOnly: true,
          previewOnly: false,
          applyConfirmationRequired: true,
          applyConfirmed: true,
          mutationPerformed: true,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
        },
        findings: [],
        ...applyOverrides,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(cwd, sequencePath),
    `${JSON.stringify(
      {
        sequenceId: "post-apply-sequence-sales-pipeline-v1-review",
        owner: "agentcore-runtime-maintainers",
        applyReportPath,
        manifestPath,
        dryRunPath,
        targetPlaybookId: "sales-pipeline-v1",
        orderedCommands: postApplyCommands,
        applyExpectation: "mutation_apply_complete",
        controlAuditExpectation: "playbook_control_audit_green",
        handoffExpectation: "ready_for_lifecycle_handoff",
        fixtureExpectation: "governed_fixtures_green",
        fixtureSummaryExpectation: "governed_fixture_summary_green",
        runtimeTestExpectation: "controlled_runtime_green",
        coreWorkflowExpectation: "core_workflows_green",
        diffCheckExpectation: "git_diff_check_green",
        fixtureRefreshPolicy: "no_fixture_refresh_until_post_apply_audit_green",
        publishingPolicy: "no_publish_or_release",
        productionPolicy: "no_production_ready_claim",
        notes: ["This checker declares the post-apply audit order only."],
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
        evidenceId: "post-apply-evidence-sales-pipeline-v1-review",
        sequencePath,
        owner: "agentcore-runtime-maintainers",
        recordedAt: "2026-07-07T03:30:00Z",
        commandResults: [
          {
            command: postApplyCommands[0],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:01Z",
            controlAudit: "playbook_control_audit_green",
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: postApplyCommands[1],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:02Z",
            handoffOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: postApplyCommands[2],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:03Z",
            fixtureGate: "governed_fixtures_green",
          },
          {
            command: postApplyCommands[3],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:04Z",
            fixtureSummaryGate: "governed_fixture_summary_green",
          },
          {
            command: postApplyCommands[4],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:05Z",
            testFiles: 83,
            tests: 423,
          },
          {
            command: postApplyCommands[5],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:06Z",
            coreWorkflowGate: "core_workflows_green",
          },
          {
            command: postApplyCommands[6],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:07Z",
            diffCheck: "git_diff_check_green",
          },
        ],
        sequenceResult: {
          ok: true,
          sequenceOnly: true,
          productionReady: false,
          publishingPerformed: false,
        },
        postApplyAuditBoundary: {
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
          readinessClaimed: false,
        },
        approvalStatus: "post_apply_audit_evidence",
        ...evidenceOverrides,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(cwd, handoffPath),
    `${JSON.stringify(
      {
        handoffId: "fixture-refresh-handoff-sales-pipeline-v1-review",
        owner: "agentcore-runtime-maintainers",
        postApplyEvidencePath: evidencePath,
        targetPlaybookId: "sales-pipeline-v1",
        intendedFixtureIds: ["sales-pipeline-governed"],
        refreshReason:
          "Post-apply audit evidence is green; start manual fixture refresh review.",
        reviewChecklist: {
          sourceIdentityGate: true,
          redactionGate: true,
          playbookContractGate: true,
          approvalTerminalStateGate: true,
          writebackIdentityGate: true,
          failureTriageGate: true,
          sensitiveStringSearchGate: true,
          replacementDiffGate: true,
          catalogGate: true,
          runtimeRegressionGate: true,
          rollbackNotes: [
            "Reject the candidate fixture if catalog replay, redaction, or diff review fails.",
          ],
        },
        handoffBoundary: {
          handoffOnly: true,
          candidateFixtureGenerated: false,
          committedFixtureReplaced: false,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
        },
        fixtureRefreshPolicy: "manual_fixture_refresh_review_required",
        publishingPolicy: "no_publish_or_release",
        productionPolicy: "no_production_ready_claim",
        approvalStatus: "fixture_refresh_handoff_only",
        notes: ["This gate does not build or replace fixture JSON."],
        ...handoffOverrides,
      },
      null,
      2,
    )}\n`,
  );

  return { cwd, handoffPath };
}

describe("playbook lifecycle mutation fixture refresh handoff script", () => {
  it("parses handoff and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationFixtureRefreshHandoffArgs([
        "--handoff",
        handoffPath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      handoffPath,
    });
  });

  it("requires a handoff path", () => {
    expect(() => parsePlaybookLifecycleMutationFixtureRefreshHandoffArgs([])).toThrow(
      "--handoff <path> is required",
    );
  });

  it("builds a successful CLI result for valid fixture refresh handoff", () => {
    const { cwd, handoffPath } = createFixtureRefreshHandoffFixture();
    const result = buildPlaybookLifecycleMutationFixtureRefreshHandoffCliResult({
      cwd,
      handoffPath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_FIXTURE_REFRESH_HANDOFF_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      handoffOnly: true,
      readyForFixtureRefreshReview: true,
      handoffPath,
      postApplyEvidencePath: evidencePath,
      summary: {
        findings: 0,
        intendedFixtureIds: 1,
      },
    });
  });

  it("returns non-zero when post-apply evidence is not green", () => {
    const { cwd, handoffPath } = createFixtureRefreshHandoffFixture(
      {},
      {
        postApplyAuditBoundary: {
          fixtureRefreshPerformed: true,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
          readinessClaimed: false,
        },
      },
    );
    const result = buildPlaybookLifecycleMutationFixtureRefreshHandoffCliResult({
      cwd,
      handoffPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      status: "post_apply_evidence_not_green",
      findings: [
        {
          code: "invalid_post_apply_evidence",
        },
      ],
    });
  });

  it("rejects invalid JSON fixture refresh handoff files", () => {
    const { cwd, handoffPath } = createFixtureRefreshHandoffFixture();
    writeFileSync(join(cwd, handoffPath), "not json");

    expect(() =>
      buildPlaybookLifecycleMutationFixtureRefreshHandoffCliResult({
        cwd,
        handoffPath,
      }),
    ).toThrow("fixture refresh handoff file is not valid JSON");
  });
});
