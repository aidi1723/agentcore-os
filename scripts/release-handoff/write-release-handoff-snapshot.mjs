import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const RELEASE_HANDOFF_SNAPSHOT_COMMAND = "release:handoff:snapshot";
export const RELEASE_HANDOFF_SOURCE_COMMAND = "release:handoff:check";
export const DEFAULT_RELEASE_HANDOFF_SNAPSHOT_OUTPUT_DIR =
  "output/release-handoff";

export function parseGitStatusSummary(statusShort) {
  const lines = statusShort.map((line) => String(line)).filter(Boolean);
  return {
    dirty: lines.length > 0,
    hasTrackedChanges: lines.some((line) => !line.startsWith("??")),
    hasUntrackedFiles: lines.some((line) => line.startsWith("??")),
  };
}

export function buildReleaseHandoffEvidenceSnapshot({
  createdAt,
  handoffReport,
  git,
}) {
  const ok = handoffReport?.ok === true;
  const snapshot = {
    schemaVersion: 1,
    kind: "release_handoff_evidence_snapshot",
    createdAt: createdAt.toISOString(),
    command: RELEASE_HANDOFF_SNAPSHOT_COMMAND,
    sourceCommand: RELEASE_HANDOFF_SOURCE_COMMAND,
    ok,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    git,
    handoffReport,
    knownWarnings: [
      "snapshot is local evidence only and is not a published release artifact",
      "output/release-handoff snapshots should not be committed by default",
    ],
  };

  if (ok && handoffReport.releaseClaim) {
    snapshot.releaseClaim = handoffReport.releaseClaim;
  }

  return snapshot;
}

function runReleaseHandoffCheck() {
  return spawnSync("npm", ["run", "release:handoff:check", "--silent"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runGitContextCommand(name) {
  const commands = {
    branch: ["git", ["branch", "--show-current"]],
    commit: ["git", ["rev-parse", "--short", "HEAD"]],
    status: ["git", ["status", "--short"]],
  };
  const command = commands[name];
  if (!command) {
    throw new Error(`unknown git context command: ${name}`);
  }

  return spawnSync(command[0], command[1], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function requireSuccessfulResult(result, description) {
  if (result?.status === 0) return result.stdout ?? "";
  const stderr = String(result?.stderr ?? "").trim();
  throw new Error(stderr || `${description} failed`);
}

function parseHandoffReport(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("release:handoff:check did not return valid JSON");
  }
}

function splitGitStatus(stdout) {
  return String(stdout ?? "")
    .split("\n")
    .filter(Boolean);
}

function collectGitContext(gitRunner) {
  const branch = requireSuccessfulResult(gitRunner("branch"), "git branch");
  const commit = requireSuccessfulResult(gitRunner("commit"), "git commit");
  const status = requireSuccessfulResult(gitRunner("status"), "git status");
  const statusShort = splitGitStatus(status);
  const summary = parseGitStatusSummary(statusShort);

  return {
    branch: branch.trim(),
    commit: commit.trim(),
    ...summary,
    statusShort,
  };
}

function sanitizeTimestampForPath(createdAt) {
  return createdAt.toISOString().replace(/[:.]/g, "");
}

function buildSnapshotPath(outputDir, createdAt) {
  return path.join(
    outputDir,
    `release-handoff-${sanitizeTimestampForPath(createdAt)}.json`,
  );
}

function buildSummary({ snapshot, snapshotPath }) {
  const summary = {
    ok: snapshot.ok,
    command: RELEASE_HANDOFF_SNAPSHOT_COMMAND,
    snapshotPath,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
  };

  if (snapshot.ok && snapshot.releaseClaim) {
    summary.releaseClaim = snapshot.releaseClaim;
  }

  return summary;
}

export function writeReleaseHandoffSnapshot({
  now = () => new Date(),
  outputDir = DEFAULT_RELEASE_HANDOFF_SNAPSHOT_OUTPUT_DIR,
  handoffRunner = runReleaseHandoffCheck,
  gitRunner = runGitContextCommand,
  mkdir = (dir) => mkdirSync(dir, { recursive: true }),
  writeFile = (filePath, data) => writeFileSync(filePath, data, "utf8"),
} = {}) {
  const createdAt = now();
  const rawHandoffResult = handoffRunner();
  const parsedReport = parseHandoffReport(rawHandoffResult?.stdout ?? "");
  const handoffReport = {
    ...parsedReport,
    ok: parsedReport?.ok === true && rawHandoffResult?.status === 0,
  };
  const git = collectGitContext(gitRunner);
  const snapshot = buildReleaseHandoffEvidenceSnapshot({
    createdAt,
    handoffReport,
    git,
  });
  const snapshotPath = buildSnapshotPath(outputDir, createdAt);

  mkdir(outputDir);
  writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  return {
    exitCode: snapshot.ok ? 0 : 1,
    summary: buildSummary({ snapshot, snapshotPath }),
    snapshot,
  };
}

function main() {
  const result = writeReleaseHandoffSnapshot();
  process.stdout.write(`${JSON.stringify(result.summary, null, 2)}\n`);
  process.exitCode = result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
