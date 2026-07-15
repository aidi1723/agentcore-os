import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND,
  checkReleaseHandoffEvidence,
  parseReleaseHandoffEvidenceCheckArgs,
} from "../../../scripts/release-handoff/check-release-handoff-evidence.mjs";
import { spawnResult } from "../helpers/spawn-result";

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
const fullCommit = "abcdef0123456789abcdef0123456789abcdef01";

function createMemoryFs(files: Record<string, string>) {
  return {
    listFiles: (dir: string) =>
      Object.keys(files)
        .filter((filePath) => filePath.startsWith(`${dir}/`))
        .map((filePath) => filePath.slice(dir.length + 1)),
    readFile: (filePath: string) => files[filePath],
  };
}

describe("release handoff evidence freshness script", () => {
  it("passes when the newest snapshot validates and matches current commit", () => {
    const fullSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commitFull: fullCommit },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(fullSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: `${fullCommit}\n` }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND,
        snapshotPath: "output/release-handoff/latest.json",
        snapshotCommit: "abcdef0",
        snapshotCommitFull: fullCommit,
        currentCommit: "abcdef0",
        currentCommitFull: fullCommit,
        fresh: true,
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        releaseClaim: "local_release_handoff_ready",
        validation: {
          ok: true,
          exitCode: 0,
          snapshotOk: true,
        },
      },
    });
  });

  it("passes old short-only snapshots by comparing against the current commit prefix", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: `${fullCommit}\n` }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        snapshotCommit: "abcdef0",
        currentCommit: "abcdef0",
        currentCommitFull: fullCommit,
        fresh: true,
      },
    });
    expect(result.report).not.toHaveProperty("snapshotCommitFull");
  });

  it("fails when the full snapshot commit is stale even if the short commit matches", () => {
    const staleFullSnapshot = {
      ...successfulSnapshot,
      git: {
        ...successfulSnapshot.git,
        commit: "abcdef0",
        commitFull: "abcdef0000000000000000000000000000000000",
      },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleFullSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: `${fullCommit}\n` }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        snapshotCommit: "abcdef0",
        snapshotCommitFull: "abcdef0000000000000000000000000000000000",
        currentCommit: "abcdef0",
        currentCommitFull: fullCommit,
        fresh: false,
        failure: "snapshot commit does not match current commit",
      },
    });
  });

  it("fails when the newest snapshot commit is stale", () => {
    const staleSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commit: "old1111" },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({
        stdout: "new22223456789abcdef0123456789abcdef01\n",
      }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        snapshotCommit: "old1111",
        currentCommit: "new2222",
        currentCommitFull: "new22223456789abcdef0123456789abcdef01",
        fresh: false,
        failure: "snapshot commit does not match current commit",
      },
    });
  });

  it("fails when no snapshot exists", () => {
    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
      gitRunner: () => spawnResult({ stdout: "abcdef0\n" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        fresh: false,
        failure: "no release handoff snapshots found",
      },
    });
  });

  it("fails when newest snapshot validation is non-zero", () => {
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
      "output/release-handoff/latest.json": JSON.stringify(failedSnapshot),
    });

    const result = checkReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: "abcdef0\n" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        fresh: false,
        failure: "latest snapshot validation failed",
        validation: {
          ok: true,
          exitCode: 1,
          snapshotOk: false,
        },
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceCheckArgs(["--dir", "custom-output"]),
    ).toEqual({
      snapshotDir: "custom-output",
    });

    expect(() =>
      parseReleaseHandoffEvidenceCheckArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
  });
});
