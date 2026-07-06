import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_SNAPSHOT_COMMAND,
  buildReleaseHandoffEvidenceSnapshot,
  parseGitStatusSummary,
  writeReleaseHandoffSnapshot,
} from "../../../scripts/release-handoff/write-release-handoff-snapshot.mjs";

const passingReport = {
  ok: true,
  command: "release:handoff:check",
  releaseClaim: "local_release_handoff_ready",
  productionReady: false,
  publishingPerformed: false,
  checks: [{ name: "release_hygiene_check", ok: true, exitCode: 0 }],
};

describe("release handoff snapshot script", () => {
  it("writes a local evidence snapshot for a passing handoff report", () => {
    const writes: Array<{ path: string; data: string }> = [];
    const result = writeReleaseHandoffSnapshot({
      now: () => new Date("2026-07-07T00:00:00.000Z"),
      outputDir: "output/release-handoff",
      handoffRunner: () => ({
        status: 0,
        stdout: JSON.stringify(passingReport),
        stderr: "",
      }),
      gitRunner: (name: string) => {
        if (name === "branch") return { status: 0, stdout: "main\n", stderr: "" };
        if (name === "commit") return { status: 0, stdout: "abcdef0\n", stderr: "" };
        return { status: 0, stdout: "?? output/\n", stderr: "" };
      },
      writeFile: (path: string, data: string) => writes.push({ path, data }),
      mkdir: () => undefined,
    });

    expect(result.exitCode).toBe(0);
    expect(result.summary).toMatchObject({
      ok: true,
      command: RELEASE_HANDOFF_SNAPSHOT_COMMAND,
      snapshotPath:
        "output/release-handoff/release-handoff-2026-07-07T000000000Z.json",
      releaseClaim: "local_release_handoff_ready",
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
    });
    expect(writes).toHaveLength(1);

    const snapshot = JSON.parse(writes[0].data);
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      kind: "release_handoff_evidence_snapshot",
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
      },
      handoffReport: passingReport,
    });
  });

  it("writes failed handoff evidence but exits non-zero without a release claim", () => {
    const writes: Array<{ path: string; data: string }> = [];
    const failedReport = {
      ok: false,
      command: "release:handoff:check",
      productionReady: false,
      publishingPerformed: false,
      failedCheck: "build",
      checks: [{ name: "build", ok: false, exitCode: 1 }],
    };

    const result = writeReleaseHandoffSnapshot({
      now: () => new Date("2026-07-07T00:01:00.000Z"),
      outputDir: "output/release-handoff",
      handoffRunner: () => ({
        status: 1,
        stdout: JSON.stringify(failedReport),
        stderr: "build failed",
      }),
      gitRunner: () => ({ status: 0, stdout: "", stderr: "" }),
      writeFile: (path: string, data: string) => writes.push({ path, data }),
      mkdir: () => undefined,
    });

    expect(result.exitCode).toBe(1);
    expect(result.summary).not.toHaveProperty("releaseClaim");
    expect(JSON.parse(writes[0].data)).toMatchObject({
      ok: false,
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
      handoffReport: failedReport,
    });
  });

  it("fails invalid handoff JSON without writing an incomplete snapshot", () => {
    const writes: Array<{ path: string; data: string }> = [];

    expect(() =>
      writeReleaseHandoffSnapshot({
        handoffRunner: () => ({ status: 0, stdout: "not json", stderr: "" }),
        gitRunner: () => ({ status: 0, stdout: "", stderr: "" }),
        writeFile: (path: string, data: string) => writes.push({ path, data }),
        mkdir: () => undefined,
      }),
    ).toThrow("release:handoff:check did not return valid JSON");
    expect(writes).toEqual([]);
  });

  it("parses tracked and untracked git status separately", () => {
    expect(parseGitStatusSummary([" M README.md", "A  src/new.ts", "?? output/"])).toEqual({
      dirty: true,
      hasTrackedChanges: true,
      hasUntrackedFiles: true,
    });
  });

  it("builds snapshots with local-only release boundaries", () => {
    const snapshot = buildReleaseHandoffEvidenceSnapshot({
      createdAt: new Date("2026-07-07T00:00:00.000Z"),
      handoffReport: passingReport,
      git: {
        branch: "main",
        commit: "abcdef0",
        dirty: false,
        hasTrackedChanges: false,
        hasUntrackedFiles: false,
        statusShort: [],
      },
    });

    expect(snapshot).toMatchObject({
      productionReady: false,
      publishingPerformed: false,
      evidenceOnly: true,
    });
  });
});
