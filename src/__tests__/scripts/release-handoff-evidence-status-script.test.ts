import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND,
  buildReleaseHandoffEvidenceStatus,
  parseReleaseHandoffEvidenceStatusArgs,
} from "../../../scripts/release-handoff/status-release-handoff-evidence.mjs";
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

describe("release handoff evidence status script", () => {
  it("reports ready when doctor is fresh and checked index passes", () => {
    const fullSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commitFull: fullCommit },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(fullSnapshot),
    });

    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      limit: 5,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: `${fullCommit}\n` }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND,
        snapshotDir: "output/release-handoff",
        limit: 5,
        readyForLocalHandoffEvidence: true,
        nextCommand: "npm run release:handoff:evidence:check",
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        doctor: {
          exitCode: 0,
          status: "fresh_evidence",
          snapshotPath: "output/release-handoff/latest.json",
          snapshotCommit: "abcdef0",
          snapshotCommitFull: fullCommit,
          currentCommit: "abcdef0",
          currentCommitFull: fullCommit,
        },
        index: {
          exitCode: 0,
          count: 1,
          checked: true,
        },
      },
    });
  });

  it("reports not ready and forwards doctor guidance when latest evidence is stale", () => {
    const staleSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commit: "old1111" },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleSnapshot),
    });

    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: "new2222\n" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        readyForLocalHandoffEvidence: false,
        nextCommand: "npm run release:handoff:snapshot",
        doctor: {
          exitCode: 1,
          status: "stale_evidence",
        },
        index: {
          exitCode: 0,
          count: 1,
          checked: true,
        },
      },
    });
  });

  it("reports not ready and recommends index review when recent checked snapshots fail", () => {
    const invalidOlderSnapshot = {
      ...successfulSnapshot,
      createdAt: "2026-07-07T00:01:00.000Z",
      kind: "wrong_kind",
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
      "output/release-handoff/older.json": JSON.stringify(invalidOlderSnapshot),
    });

    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      limit: 5,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => spawnResult({ stdout: "abcdef0\n" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        readyForLocalHandoffEvidence: false,
        nextCommand: "npm run release:handoff:snapshot:index -- --check --limit 5",
        doctor: {
          exitCode: 0,
          status: "fresh_evidence",
        },
        index: {
          exitCode: 1,
          count: 2,
          checked: true,
        },
      },
    });
  });

  it("reports not ready when no snapshots exist", () => {
    const result = buildReleaseHandoffEvidenceStatus({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
      gitRunner: () => spawnResult({ stdout: "abcdef0\n" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        readyForLocalHandoffEvidence: false,
        nextCommand: "npm run release:handoff:snapshot",
        doctor: {
          exitCode: 1,
          status: "missing_evidence",
        },
        index: {
          exitCode: 0,
          count: 0,
          checked: true,
        },
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceStatusArgs([
        "--dir",
        "custom-output",
        "--limit",
        "3",
      ]),
    ).toEqual({
      snapshotDir: "custom-output",
      limit: 3,
    });

    expect(() =>
      parseReleaseHandoffEvidenceStatusArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
    expect(() =>
      parseReleaseHandoffEvidenceStatusArgs(["--limit", "0"]),
    ).toThrow("--limit must be greater than 0.");
  });
});
