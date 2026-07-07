import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND,
  buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult,
  parsePlaybookLifecycleMutationReleaseHandoffReviewArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-mutation-release-handoff-review.mjs";

const postReplacementEvidencePath =
  "docs/playbook-lifecycle-mutation-post-replacement-evidence/example-version-update-post-replacement-evidence.json";
const exampleReviewPath =
  "docs/playbook-lifecycle-mutation-release-handoff-reviews/example-version-update-release-handoff-review.json";
const postReplacementCommand = `npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence ${postReplacementEvidencePath}`;

function createReviewFile(overrides = {}) {
  const cwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "playbook-release-handoff-review-"));
  const reviewPath = join(dir, "release-handoff-review.json");
  writeFileSync(
    reviewPath,
    `${JSON.stringify(
      {
        reviewId: "release-handoff-review-sales-pipeline-v1",
        postReplacementEvidencePath,
        owner: "agentcore-runtime-maintainers",
        recordedAt: "2026-07-07T10:30:00Z",
        reviewSummary: {
          postReplacementEvidenceAccepted: true,
          releaseHandoffEvidenceAccepted: true,
          rollbackAvailable: true,
          rollbackNotes: [
            "Revert the local playbook mutation commit and regenerate handoff evidence if release handoff review fails.",
          ],
          nextBoundary: "local_release_handoff_review_only",
        },
        commandResults: [
          {
            command: postReplacementCommand,
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:30:01Z",
            postReplacementEvidence: "post_replacement_fixture_evidence_green",
            evidenceOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: "npm run release:handoff:check",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:30:02Z",
            releaseClaim: "local_release_handoff_ready",
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: "npm run release:handoff:snapshot",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:30:03Z",
            snapshotEvidence: "release_handoff_snapshot_written",
            evidenceOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: "npm run release:handoff:evidence:status",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:30:04Z",
            readyForLocalHandoffEvidence: true,
            evidenceOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: "npm run release:handoff:evidence:audit",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:30:05Z",
            releaseHandoffEvidenceAudit: "release_handoff_evidence_audit_green",
            evidenceOnly: true,
            productionReady: false,
            publishingPerformed: false,
          },
          {
            command: "git diff --check",
            ok: true,
            exitCode: 0,
            recordedAt: "2026-07-07T10:30:06Z",
            diffCheck: "git_diff_check_green",
          },
        ],
        postReplacementEvidenceResult: {
          ok: true,
          evidenceOnly: true,
          productionReady: false,
          publishingPerformed: false,
        },
        releaseHandoffReviewBoundary: {
          reviewOnly: true,
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
        approvalStatus: "release_handoff_review",
        notes: ["This review records local handoff evidence only."],
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
  return { cwd, reviewPath };
}

describe("playbook lifecycle mutation release handoff review script", () => {
  it("parses review and compact arguments", () => {
    expect(
      parsePlaybookLifecycleMutationReleaseHandoffReviewArgs([
        "--review",
        exampleReviewPath,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      reviewPath: exampleReviewPath,
    });
  });

  it("requires a review path", () => {
    expect(() => parsePlaybookLifecycleMutationReleaseHandoffReviewArgs([])).toThrow(
      "--review <path> is required",
    );
  });

  it("builds a successful CLI result for valid release handoff review evidence", () => {
    const { cwd, reviewPath } = createReviewFile();
    const result = buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult({
      cwd,
      reviewPath,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_RELEASE_HANDOFF_REVIEW_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      reviewOnly: true,
      readyForLocalReleaseHandoffReview: true,
      reviewPath,
      postReplacementEvidencePath,
      summary: {
        findings: 0,
        requiredCommands: 6,
        commandResults: 6,
      },
    });
  });

  it("returns non-zero when review summary is not accepted", () => {
    const { cwd, reviewPath } = createReviewFile({
      reviewSummary: {
        postReplacementEvidenceAccepted: true,
        releaseHandoffEvidenceAccepted: false,
        rollbackAvailable: true,
        rollbackNotes: [],
        nextBoundary: "",
      },
    });
    const result = buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult({
      cwd,
      reviewPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      findings: [
        {
          code: "review_summary_missing",
        },
      ],
    });
  });

  it("returns non-zero when command evidence is incomplete", () => {
    const { cwd, reviewPath } = createReviewFile({
      commandResults: [],
    });
    const result = buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult({
      cwd,
      reviewPath,
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

  it("rejects invalid JSON release handoff review files", () => {
    const { cwd, reviewPath } = createReviewFile();
    writeFileSync(reviewPath, "not json");

    expect(() =>
      buildPlaybookLifecycleMutationReleaseHandoffReviewCliResult({
        cwd,
        reviewPath,
      }),
    ).toThrow("release handoff review file is not valid JSON");
  });
});
