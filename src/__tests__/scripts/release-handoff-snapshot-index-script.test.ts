import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND,
  buildReleaseHandoffSnapshotIndex,
  parseReleaseHandoffSnapshotIndexArgs,
} from "../../../scripts/release-handoff/index-release-handoff-snapshots.mjs";

const successfulSnapshot = {
  schemaVersion: 1,
  kind: "release_handoff_evidence_snapshot",
  createdAt: "2026-07-07T00:02:00.000Z",
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
    dirty: false,
    hasTrackedChanges: false,
    hasUntrackedFiles: false,
    statusShort: [],
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

const olderSnapshot = {
  ...successfulSnapshot,
  createdAt: "2026-07-07T00:01:00.000Z",
  git: { ...successfulSnapshot.git, commit: "1234567" },
};

function createMemoryFs(files: Record<string, string>) {
  return {
    listFiles: (dir: string) =>
      Object.keys(files)
        .filter((filePath) => filePath.startsWith(`${dir}/`))
        .map((filePath) => filePath.slice(dir.length + 1)),
    readFile: (filePath: string) => files[filePath],
  };
}

describe("release handoff snapshot index script", () => {
  it("indexes snapshots newest first and respects limit", () => {
    const fs = createMemoryFs({
      "output/release-handoff/newer.json": JSON.stringify(successfulSnapshot),
      "output/release-handoff/older.json": JSON.stringify(olderSnapshot),
      "output/release-handoff/ignore.txt": "not a snapshot",
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      limit: 1,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND,
        snapshotDir: "output/release-handoff",
        count: 1,
        checked: false,
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
      },
    });
    expect(result.report.snapshots).toEqual([
      expect.objectContaining({
        path: "output/release-handoff/newer.json",
        createdAt: "2026-07-07T00:02:00.000Z",
        ok: true,
        releaseClaim: "local_release_handoff_ready",
      }),
    ]);
  });

  it("validates listed snapshots when check is enabled", () => {
    const fs = createMemoryFs({
      "output/release-handoff/newer.json": JSON.stringify(successfulSnapshot),
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      check: true,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result.exitCode).toBe(0);
    expect(result.report.snapshots[0]).toMatchObject({
      validation: {
        ok: true,
        exitCode: 0,
        snapshotOk: true,
      },
    });
  });

  it("exits non-zero when checked snapshots include failed evidence", () => {
    const failedSnapshot = {
      ...successfulSnapshot,
      ok: false,
      handoffReport: {
        ...successfulSnapshot.handoffReport,
        ok: false,
      },
    };
    delete (failedSnapshot as { releaseClaim?: string }).releaseClaim;
    delete (failedSnapshot.handoffReport as { releaseClaim?: string }).releaseClaim;
    const fs = createMemoryFs({
      "output/release-handoff/failed.json": JSON.stringify(failedSnapshot),
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      check: true,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      ok: false,
      checked: true,
      count: 1,
    });
    expect(result.report.snapshots[0]).toMatchObject({
      ok: false,
      validation: {
        ok: true,
        exitCode: 1,
        snapshotOk: false,
      },
    });
    expect(result.report.snapshots[0]).not.toHaveProperty("releaseClaim");
  });

  it("includes invalid JSON as a failed entry when check is enabled", () => {
    const fs = createMemoryFs({
      "output/release-handoff/bad.json": "not json",
    });

    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      check: true,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.snapshots[0]).toMatchObject({
      path: "output/release-handoff/bad.json",
      ok: false,
      error: "snapshot file is not valid JSON",
      validation: {
        ok: false,
        exitCode: 1,
        error: "snapshot file is not valid JSON",
      },
    });
  });

  it("returns an empty successful report for a missing snapshot directory", () => {
    const result = buildReleaseHandoffSnapshotIndex({
      snapshotDir: "output/release-handoff",
      listFiles: () => {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      readFile: () => "",
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        count: 0,
        snapshots: [],
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffSnapshotIndexArgs([
        "--dir",
        "custom-output",
        "--limit",
        "5",
        "--check",
      ]),
    ).toEqual({
      snapshotDir: "custom-output",
      limit: 5,
      check: true,
    });

    expect(() =>
      parseReleaseHandoffSnapshotIndexArgs(["--limit", "0"]),
    ).toThrow("--limit must be greater than 0.");
  });
});
