import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND,
  buildPlaybookLifecycleMutationPostApplyEvidenceCliResult,
  parsePlaybookLifecycleMutationPostApplyEvidenceArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-post-apply-evidence.mjs";

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

const orderedCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run trace:fixtures:summary --silent",
  "npm run test:controlled-runtime",
  "npm run test:core-workflows",
  "git diff --check",
];

function createPostApplyEvidenceFixture(
  evidenceOverrides = {},
  sequenceOverrides = {},
  applyOverrides = {},
) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-post-apply-evidence-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-apply-reports"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-post-apply-sequences"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-post-apply-evidence"), {
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
        orderedCommands,
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
            command: orderedCommands[0],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:01Z",
            controlAudit: "playbook_control_audit_green",
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: orderedCommands[1],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:02Z",
            handoffOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: orderedCommands[2],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:03Z",
            fixtureGate: "governed_fixtures_green",
          },
          {
            command: orderedCommands[3],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:04Z",
            fixtureSummaryGate: "governed_fixture_summary_green",
          },
          {
            command: orderedCommands[4],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:05Z",
            testFiles: 81,
            tests: 413,
          },
          {
            command: orderedCommands[5],
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T03:30:06Z",
            coreWorkflowGate: "core_workflows_green",
          },
          {
            command: orderedCommands[6],
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

  return { cwd, evidencePath };
}

describe("playbook lifecycle mutation post-apply evidence script", () => {
  it("parses evidence and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationPostApplyEvidenceArgs([
        "--evidence",
        evidencePath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      evidencePath,
    });
  });

  it("requires an evidence path", () => {
    expect(() => parsePlaybookLifecycleMutationPostApplyEvidenceArgs([])).toThrow(
      "--evidence <path> is required",
    );
  });

  it("builds a successful CLI result for valid post-apply evidence", () => {
    const { cwd, evidencePath } = createPostApplyEvidenceFixture();
    const result = buildPlaybookLifecycleMutationPostApplyEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      readyForFixtureRefreshHandoff: true,
      evidencePath,
      sequencePath,
      summary: {
        findings: 0,
        requiredCommands: 7,
        commandResults: 7,
      },
    });
  });

  it("returns non-zero when the referenced sequence is not green", () => {
    const { cwd, evidencePath } = createPostApplyEvidenceFixture(
      {},
      {
        orderedCommands: ["npm run test:controlled-runtime"],
      },
    );
    const result = buildPlaybookLifecycleMutationPostApplyEvidenceCliResult({
      cwd,
      evidencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      status: "referenced_sequence_not_green",
      findings: [
        {
          code: "invalid_referenced_sequence",
        },
      ],
    });
  });

  it("rejects invalid JSON post-apply evidence files", () => {
    const { cwd, evidencePath } = createPostApplyEvidenceFixture();
    writeFileSync(join(cwd, evidencePath), "not json");

    expect(() =>
      buildPlaybookLifecycleMutationPostApplyEvidenceCliResult({
        cwd,
        evidencePath,
      }),
    ).toThrow("post-apply evidence file is not valid JSON");
  });
});
