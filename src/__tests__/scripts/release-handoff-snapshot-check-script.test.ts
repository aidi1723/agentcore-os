import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND,
  checkReleaseHandoffSnapshotFile,
  validateReleaseHandoffSnapshot,
} from "../../../scripts/release-handoff/check-release-handoff-snapshot.mjs";

const successfulSnapshot = {
  schemaVersion: 1,
  kind: "release_handoff_evidence_snapshot",
  createdAt: "2026-07-07T00:00:00.000Z",
  command: "release:handoff:snapshot",
  sourceCommand: "release:handoff:check",
  ok: true,
  releaseClaim: "local_release_handoff_ready",
  productionReady: false,
  publishingPerformed: false,
  evidenceOnly: true,
  git: {
    branch: "main",
    commit: "abcdef0",
    dirty: true,
    hasTrackedChanges: false,
    hasUntrackedFiles: true,
    statusShort: ["?? output/"],
  },
  handoffReport: {
    ok: true,
    command: "release:handoff:check",
    releaseClaim: "local_release_handoff_ready",
    productionReady: false,
    publishingPerformed: false,
    checks: [{ name: "build", ok: true }],
  },
};

function failuresOf(result: ReturnType<typeof validateReleaseHandoffSnapshot>) {
  if (!("failures" in result.report)) {
    throw new Error("Expected snapshot validation failures");
  }
  return result.report.failures;
}

describe("release handoff snapshot check script", () => {
  it("passes a valid successful handoff snapshot", () => {
    const result = validateReleaseHandoffSnapshot(
      successfulSnapshot,
      "output/release-handoff/example.json",
    );

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND,
        snapshotPath: "output/release-handoff/example.json",
        snapshotOk: true,
        releaseClaim: "local_release_handoff_ready",
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
      },
    });
    expect(result.report.checkedRules).toEqual([
      "top_level_shape",
      "git_context_shape",
      "handoff_report_shape",
      "release_boundary",
    ]);
  });

  it("validates failed handoff evidence but exits non-zero without a release claim", () => {
    const failedSnapshot = {
      ...successfulSnapshot,
      ok: false,
      handoffReport: {
        ...successfulSnapshot.handoffReport,
        ok: false,
        failedCheck: "build",
      },
    };
    delete (failedSnapshot as { releaseClaim?: string }).releaseClaim;
    delete (failedSnapshot.handoffReport as { releaseClaim?: string }).releaseClaim;

    const result = validateReleaseHandoffSnapshot(failedSnapshot, "failed.json");

    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      ok: true,
      snapshotOk: false,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
    });
    expect(result.report).not.toHaveProperty("releaseClaim");
  });

  it("fails snapshots that omit the production boundary", () => {
    const invalid = { ...successfulSnapshot, productionReady: true };
    const result = validateReleaseHandoffSnapshot(invalid, "bad.json");

    expect(result.exitCode).toBe(1);
    expect(result.report.ok).toBe(false);
    expect(failuresOf(result)).toContain("productionReady must be false");
  });

  it("validates git.commitFull when present", () => {
    const invalid = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commitFull: 123 },
    };
    const result = validateReleaseHandoffSnapshot(invalid, "bad-full.json");

    expect(result.exitCode).toBe(1);
    expect(failuresOf(result)).toContain(
      "git.commitFull must be a non-empty string when present",
    );
  });

  it("fails failed snapshots that expose a release claim", () => {
    const invalid = {
      ...successfulSnapshot,
      ok: false,
      releaseClaim: "local_release_handoff_ready",
      handoffReport: {
        ...successfulSnapshot.handoffReport,
        ok: false,
      },
    };
    const result = validateReleaseHandoffSnapshot(invalid, "bad-failed.json");

    expect(result.exitCode).toBe(1);
    expect(failuresOf(result)).toContain(
      "failed snapshots must not include releaseClaim",
    );
  });

  it("fails invalid JSON without pretending validation ran", () => {
    expect(() =>
      checkReleaseHandoffSnapshotFile({
        snapshotPath: "invalid.json",
        readFile: () => "not json",
      }),
    ).toThrow("snapshot file is not valid JSON");
  });
});
