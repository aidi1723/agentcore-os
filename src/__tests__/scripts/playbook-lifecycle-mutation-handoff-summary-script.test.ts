import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND,
  buildPlaybookLifecycleMutationHandoffSummaryCliResult,
  parsePlaybookLifecycleMutationHandoffSummaryArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-handoff-summary.mjs";

const releaseHandoffReviewPath =
  "docs/playbook-lifecycle-mutation-release-handoff-reviews/example-version-update-release-handoff-review.json";
const exampleSummaryPath =
  "docs/playbook-lifecycle-mutation-handoff-summaries/example-version-update-handoff-summary.json";
const reviewCommand = `npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review ${releaseHandoffReviewPath}`;

function createSummaryFile(overrides = {}) {
  const cwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "playbook-handoff-summary-"));
  const summaryPath = join(dir, "handoff-summary.json");
  writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        summaryId: "handoff-summary-sales-pipeline-v1",
        releaseHandoffReviewPath,
        owner: "agentcore-runtime-maintainers",
        recordedAt: "2026-07-07T10:45:00Z",
        handoffSummary: {
          targetPlaybookId: "sales-pipeline-v1",
          lifecycleMutationStatus: "local_mutation_reviewed",
          evidenceChainStatus: "release_handoff_review_green",
          localReleaseClaim: "local_release_handoff_ready",
          maintainerDecision: "ready_for_non_production_handoff_review",
          nextBoundary: "unified_policy_or_authoring_hardening",
        },
        commandSummary: [
          {
            command: reviewCommand,
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:45:01Z",
            gate: "release_handoff_review_green",
          },
          {
            command: "npm run test:controlled-runtime",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:45:02Z",
            testFiles: 93,
            tests: 481,
          },
          {
            command: "npm run test:core-workflows",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:45:03Z",
            gate: "core_workflows_green",
          },
          {
            command: "npm run lint",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:45:04Z",
            warningCount: 1,
            knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
          },
          {
            command: "npm run build",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:45:05Z",
            warningCount: 1,
            knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
          },
          {
            command: "git diff --check",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:45:06Z",
            gate: "git_diff_check_green",
          },
        ],
        riskSummary: {
          productionReady: false,
          publishingApproved: false,
          externalWritesApproved: false,
          deferredItems: [
            "unified policy/guardrail hardening",
            "real replay depth",
            "authoring UI",
          ],
        },
        rollbackSummary: {
          rollbackAvailable: true,
          rollbackNotes: [
            "Revert the local mutation and regenerate review evidence if summary checks fail.",
          ],
        },
        releaseHandoffReviewResult: {
          ok: true,
          reviewOnly: true,
          productionReady: false,
          publishingPerformed: false,
        },
        handoffSummaryBoundary: {
          summaryOnly: true,
          commandsExecutedByChecker: false,
          snapshotGeneratedByChecker: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          tagCreated: false,
          packageBuilt: false,
          uploadPerformed: false,
          productionReady: false,
          readinessClaimed: false,
        },
        approvalStatus: "handoff_summary_review",
        notes: ["This summary is a local non-production handoff summary only."],
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, summaryPath };
}

describe("playbook lifecycle mutation handoff summary script", () => {
  it("parses summary and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationHandoffSummaryArgs([
        "--summary",
        exampleSummaryPath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      summaryPath: exampleSummaryPath,
    });
  });

  it("requires a summary path", () => {
    expect(() => parsePlaybookLifecycleMutationHandoffSummaryArgs([])).toThrow(
      "--summary <path> is required",
    );
  });

  it("builds a successful CLI result for valid handoff summary", () => {
    const { cwd, summaryPath } = createSummaryFile();
    const result = buildPlaybookLifecycleMutationHandoffSummaryCliResult({
      cwd,
      summaryPath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_HANDOFF_SUMMARY_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      summaryOnly: true,
      readyForMaintainerHandoffSummary: true,
      summaryPath,
      releaseHandoffReviewPath,
      summary: {
        findings: 0,
        requiredCommands: 6,
        commandSummary: 6,
      },
    });
  });

  it("returns non-zero when risk summary is not bounded", () => {
    const { cwd, summaryPath } = createSummaryFile({
      riskSummary: {
        productionReady: true,
        publishingApproved: true,
        externalWritesApproved: true,
        deferredItems: [],
      },
    });
    const result = buildPlaybookLifecycleMutationHandoffSummaryCliResult({
      cwd,
      summaryPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "risk_summary_missing",
        },
      ],
    });
  });

  it("returns non-zero when command summary is incomplete", () => {
    const { cwd, summaryPath } = createSummaryFile({
      commandSummary: [],
    });
    const result = buildPlaybookLifecycleMutationHandoffSummaryCliResult({
      cwd,
      summaryPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "invalid_command_summary_sequence" }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "command_summary_not_green" }),
    );
  });

  it("rejects invalid JSON handoff summary files", () => {
    const { cwd, summaryPath } = createSummaryFile();
    writeFileSync(summaryPath, "not json");

    expect(() =>
      buildPlaybookLifecycleMutationHandoffSummaryCliResult({
        cwd,
        summaryPath,
      }),
    ).toThrow("handoff summary file is not valid JSON");
  });
});
