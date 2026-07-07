import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND,
  doctorReleaseHandoffEvidence,
  parseReleaseHandoffEvidenceDoctorArgs,
} from "../../../scripts/release-handoff/doctor-release-handoff-evidence.mjs";

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

describe("release handoff evidence doctor script", () => {
  it("reports fresh evidence with the freshness gate as the next hard check", () => {
    const fullSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commitFull: fullCommit },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(fullSnapshot),
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: `${fullCommit}\n`, stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND,
        snapshotDir: "output/release-handoff",
        status: "fresh_evidence",
        severity: "info",
        snapshotPath: "output/release-handoff/latest.json",
        snapshotCommit: "abcdef0",
        snapshotCommitFull: fullCommit,
        currentCommit: "abcdef0",
        currentCommitFull: fullCommit,
        nextCommand: "npm run release:handoff:evidence:check",
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        releaseClaim: "local_release_handoff_ready",
      },
    });
  });

  it("reports fresh evidence for old short-only snapshots using the current commit prefix", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: `${fullCommit}\n`, stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        status: "fresh_evidence",
        snapshotCommit: "abcdef0",
        currentCommit: "abcdef0",
        currentCommitFull: fullCommit,
      },
    });
    expect(result.report).not.toHaveProperty("snapshotCommitFull");
  });

  it("reports missing evidence with snapshot creation guidance", () => {
    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "missing_evidence",
        severity: "error",
        nextCommand: "npm run release:handoff:snapshot",
      },
    });
  });

  it("reports invalid evidence when the latest snapshot is not valid JSON", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": "not json",
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "invalid_evidence",
        severity: "error",
        snapshotPath: "output/release-handoff/latest.json",
        nextCommand: "npm run release:handoff:snapshot",
        validation: {
          ok: false,
          exitCode: 1,
          error: "snapshot file is not valid JSON",
        },
      },
    });
  });

  it("reports invalid evidence when the latest snapshot fails schema validation", () => {
    const invalidSnapshot = {
      ...successfulSnapshot,
      kind: "wrong_kind",
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(invalidSnapshot),
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "invalid_evidence",
        severity: "error",
        snapshotPath: "output/release-handoff/latest.json",
        snapshotCommit: "abcdef0",
        nextCommand: "npm run release:handoff:snapshot",
        validation: {
          ok: false,
          exitCode: 1,
          snapshotOk: false,
          failures: ["kind must be release_handoff_evidence_snapshot"],
        },
      },
    });
  });

  it("reports failed evidence when the latest snapshot is structurally valid but failed", () => {
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

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: "abcdef0\n", stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "failed_evidence",
        severity: "error",
        snapshotCommit: "abcdef0",
        nextCommand: "npm run release:handoff:check",
        validation: {
          ok: true,
          exitCode: 1,
          snapshotOk: false,
        },
      },
    });
    expect(result.report).not.toHaveProperty("releaseClaim");
  });

  it("reports stale evidence when the latest snapshot commit differs from current commit", () => {
    const staleSnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git, commit: "old1111" },
    };
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(staleSnapshot),
    });

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({
        status: 0,
        stdout: "new22223456789abcdef0123456789abcdef01\n",
        stderr: "",
      }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "stale_evidence",
        severity: "error",
        snapshotCommit: "old1111",
        currentCommit: "new2222",
        currentCommitFull: "new22223456789abcdef0123456789abcdef01",
        nextCommand: "npm run release:handoff:snapshot",
      },
    });
  });

  it("reports stale evidence when full snapshot commit differs even if short commit matches", () => {
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

    const result = doctorReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
      gitRunner: () => ({ status: 0, stdout: `${fullCommit}\n`, stderr: "" }),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "stale_evidence",
        severity: "error",
        snapshotCommit: "abcdef0",
        snapshotCommitFull: "abcdef0000000000000000000000000000000000",
        currentCommit: "abcdef0",
        currentCommitFull: fullCommit,
        nextCommand: "npm run release:handoff:snapshot",
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceDoctorArgs(["--dir", "custom-output"]),
    ).toEqual({
      snapshotDir: "custom-output",
    });

    expect(() =>
      parseReleaseHandoffEvidenceDoctorArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
  });
});
