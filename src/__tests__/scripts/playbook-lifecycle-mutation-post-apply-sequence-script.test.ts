import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_SEQUENCE_COMMAND,
  buildPlaybookLifecycleMutationPostApplySequenceCliResult,
  parsePlaybookLifecycleMutationPostApplySequenceArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-post-apply-sequence.mjs";

const applyReportPath =
  "docs/playbook-lifecycle-mutation-apply-reports/example-version-update-apply-report.json";
const manifestPath =
  "docs/playbook-lifecycle-mutation-manifests/example-version-update-manifest.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const sequencePath =
  "docs/playbook-lifecycle-mutation-post-apply-sequences/example-version-update-post-apply-sequence.json";

const orderedCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run trace:fixtures:summary --silent",
  "npm run test:controlled-runtime",
  "npm run test:core-workflows",
  "git diff --check",
];

function createPostApplySequenceFixture(sequenceOverrides = {}, applyOverrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-post-apply-sequence-"));
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-apply-reports"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-post-apply-sequences"), {
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

  return { cwd, sequencePath };
}

describe("playbook lifecycle mutation post-apply sequence script", () => {
  it("parses sequence and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationPostApplySequenceArgs([
        "--sequence",
        sequencePath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      sequencePath,
    });
  });

  it("requires a sequence path", () => {
    expect(() => parsePlaybookLifecycleMutationPostApplySequenceArgs([])).toThrow(
      "--sequence <path> is required",
    );
  });

  it("builds a successful CLI result for a valid post-apply sequence file", () => {
    const { cwd, sequencePath } = createPostApplySequenceFixture();
    const result = buildPlaybookLifecycleMutationPostApplySequenceCliResult({
      cwd,
      sequencePath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_SEQUENCE_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      sequenceOnly: true,
      sequencePath,
      applyReportPath,
      summary: {
        findings: 0,
        requiredCommands: 7,
        orderedCommands: 7,
      },
    });
  });

  it("returns non-zero when the referenced apply report is not green", () => {
    const { cwd, sequencePath } = createPostApplySequenceFixture(
      {},
      {
        mode: "preview",
        status: "mutation_preview_ready",
      },
    );
    const result = buildPlaybookLifecycleMutationPostApplySequenceCliResult({
      cwd,
      sequencePath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      status: "apply_report_not_green",
      findings: [
        {
          code: "apply_report_not_green",
        },
      ],
    });
  });

  it("rejects invalid JSON post-apply sequence files", () => {
    const { cwd, sequencePath } = createPostApplySequenceFixture();
    writeFileSync(join(cwd, sequencePath), "not json");

    expect(() =>
      buildPlaybookLifecycleMutationPostApplySequenceCliResult({
        cwd,
        sequencePath,
      }),
    ).toThrow("post-apply sequence file is not valid JSON");
  });
});
