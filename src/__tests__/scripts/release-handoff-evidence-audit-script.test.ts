import { describe, expect, it } from "vitest";
import {
  RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND,
  auditReleaseHandoffEvidence,
  parseReleaseHandoffEvidenceAuditArgs,
} from "../../../scripts/release-handoff/audit-release-handoff-evidence.mjs";

const fullCommit = "abcdef0123456789abcdef0123456789abcdef01";

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
    commitFull: fullCommit,
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

function createMemoryFs(files: Record<string, string>) {
  return {
    listFiles: (dir: string) =>
      Object.keys(files)
        .filter((filePath) => filePath.startsWith(`${dir}/`))
        .map((filePath) => filePath.slice(dir.length + 1)),
    readFile: (filePath: string) => files[filePath],
  };
}

describe("release handoff evidence audit script", () => {
  it("passes when recent checked snapshots are successful and full-SHA covered", () => {
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(successfulSnapshot),
    });

    const result = auditReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      limit: 10,
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND,
        snapshotDir: "output/release-handoff",
        limit: 10,
        count: 1,
        productionReady: false,
        publishingPerformed: false,
        evidenceOnly: true,
        nextCommand: "npm run release:handoff:evidence:status",
        summary: {
          total: 1,
          successful: 1,
          failedEvidence: 0,
          invalidEvidence: 0,
          invalidJson: 0,
          withFullCommit: 1,
          missingFullCommit: 0,
        },
        latestSnapshot: {
          path: "output/release-handoff/latest.json",
          ok: true,
          hasFullCommit: true,
        },
        findings: [],
      },
    });
  });

  it("fails with no_snapshots when the evidence directory is empty", () => {
    const result = auditReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: () => [],
      readFile: () => "",
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        count: 0,
        nextCommand: "npm run release:handoff:snapshot",
        summary: {
          total: 0,
        },
        findings: [
          {
            code: "no_snapshots",
            severity: "error",
            count: 0,
          },
        ],
      },
    });
  });

  it("reports failed handoff evidence in the audited window", () => {
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

    const result = auditReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        summary: {
          failedEvidence: 1,
        },
        findings: [
          expect.objectContaining({
            code: "latest_snapshot_not_successful",
            count: 1,
          }),
          expect.objectContaining({
            code: "checked_index_failed",
            count: 1,
          }),
          expect.objectContaining({
            code: "failed_evidence",
            count: 1,
            paths: ["output/release-handoff/failed.json"],
          }),
        ],
      },
    });
  });

  it("reports invalid JSON evidence in the audited window", () => {
    const fs = createMemoryFs({
      "output/release-handoff/bad.json": "not json",
    });

    const result = auditReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        summary: {
          invalidJson: 1,
        },
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_json",
            count: 1,
            paths: ["output/release-handoff/bad.json"],
          }),
        ]),
      },
    });
  });

  it("reports schema-invalid evidence in the audited window", () => {
    const invalidSnapshot = {
      ...successfulSnapshot,
      kind: "wrong_kind",
    };
    const fs = createMemoryFs({
      "output/release-handoff/invalid.json": JSON.stringify(invalidSnapshot),
    });

    const result = auditReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        summary: {
          invalidEvidence: 1,
        },
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_evidence",
            count: 1,
            paths: ["output/release-handoff/invalid.json"],
          }),
        ]),
      },
    });
  });

  it("reports successful short-only snapshots as missing full commit evidence", () => {
    const shortOnlySnapshot = {
      ...successfulSnapshot,
      git: { ...successfulSnapshot.git },
    };
    delete (shortOnlySnapshot.git as { commitFull?: string }).commitFull;
    const fs = createMemoryFs({
      "output/release-handoff/latest.json": JSON.stringify(shortOnlySnapshot),
    });

    const result = auditReleaseHandoffEvidence({
      snapshotDir: "output/release-handoff",
      listFiles: fs.listFiles,
      readFile: fs.readFile,
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        nextCommand: "npm run release:handoff:snapshot",
        summary: {
          successful: 1,
          withFullCommit: 0,
          missingFullCommit: 1,
        },
        findings: [
          expect.objectContaining({
            code: "missing_full_commit_evidence",
            count: 1,
            paths: ["output/release-handoff/latest.json"],
          }),
        ],
        latestSnapshot: {
          path: "output/release-handoff/latest.json",
          ok: true,
          hasFullCommit: false,
        },
      },
    });
  });

  it("parses CLI flags", () => {
    expect(
      parseReleaseHandoffEvidenceAuditArgs(["--dir", "custom", "--limit", "3"]),
    ).toEqual({
      snapshotDir: "custom",
      limit: 3,
    });

    expect(() =>
      parseReleaseHandoffEvidenceAuditArgs(["--limit", "0"]),
    ).toThrow("--limit must be greater than 0.");
    expect(() =>
      parseReleaseHandoffEvidenceAuditArgs(["--unknown"]),
    ).toThrow("Unknown option: --unknown");
  });
});
