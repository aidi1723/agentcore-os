import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkReleaseHandoffSnapshotFile } from "./check-release-handoff-snapshot.mjs";

export const RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND =
  "release:handoff:evidence:check";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseReleaseHandoffEvidenceCheckArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      options.snapshotDir = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function listJsonSnapshotFiles(snapshotDir, listFiles) {
  try {
    return listFiles(snapshotDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => path.join(snapshotDir, fileName));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function parseSnapshot(filePath, readFile) {
  try {
    return JSON.parse(readFile(filePath));
  } catch {
    return undefined;
  }
}

function getSortTime(filePath, readFile) {
  const snapshot = parseSnapshot(filePath, readFile);
  const parsed = Date.parse(snapshot?.createdAt ?? "");
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

function findNewestSnapshotPath({ snapshotDir, listFiles, readFile }) {
  const paths = listJsonSnapshotFiles(snapshotDir, listFiles);
  return paths.sort((a, b) => {
    const byCreatedAt = getSortTime(b, readFile) - getSortTime(a, readFile);
    if (byCreatedAt !== 0) return byCreatedAt;
    return b.localeCompare(a);
  })[0];
}

function runGitCommit() {
  return spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readCurrentCommit(gitRunner) {
  const result = gitRunner();
  if (result?.status !== 0) {
    const stderr = String(result?.stderr ?? "").trim();
    throw new Error(stderr || "git rev-parse failed");
  }
  const commit = String(result.stdout ?? "").trim();
  if (!commit) {
    throw new Error("git rev-parse returned an empty commit");
  }
  return commit;
}

function shortCommit(commit, length = 7) {
  const normalizedLength = Number.isInteger(length) && length > 0 ? length : 7;
  return String(commit ?? "").slice(0, normalizedLength);
}

function buildCommitComparison({ snapshot, currentCommitFull }) {
  const snapshotCommit = snapshot?.git?.commit;
  const snapshotCommitFull = snapshot?.git?.commitFull;
  const currentCommit = shortCommit(
    currentCommitFull,
    String(snapshotCommit ?? "").length || 7,
  );
  const usesFullCommit =
    typeof snapshotCommitFull === "string" && snapshotCommitFull.length > 0;
  const fresh = usesFullCommit
    ? snapshotCommitFull === currentCommitFull
    : snapshotCommit === currentCommit;
  const comparison = {
    fresh,
    snapshotCommit,
    currentCommit,
    currentCommitFull,
  };

  if (usesFullCommit) {
    comparison.snapshotCommitFull = snapshotCommitFull;
  }

  return comparison;
}

function buildBaseReport(snapshotDir) {
  return {
    ok: false,
    command: RELEASE_HANDOFF_EVIDENCE_CHECK_COMMAND,
    snapshotDir,
    fresh: false,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
  };
}

function validationSummary(result) {
  return {
    ok: result.report.ok,
    exitCode: result.exitCode,
    snapshotOk: result.report.snapshotOk,
    failures: result.report.failures,
  };
}

export function checkReleaseHandoffEvidence({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
  gitRunner = runGitCommit,
} = {}) {
  const snapshotPath = findNewestSnapshotPath({ snapshotDir, listFiles, readFile });
  const base = buildBaseReport(snapshotDir);
  if (!snapshotPath) {
    return {
      exitCode: 1,
      report: {
        ...base,
        failure: "no release handoff snapshots found",
      },
    };
  }

  let validation;
  try {
    validation = checkReleaseHandoffSnapshotFile({ snapshotPath, readFile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: {
        ...base,
        snapshotPath,
        failure: "latest snapshot validation failed",
        validation: {
          ok: false,
          exitCode: 1,
          error: message,
        },
      },
    };
  }

  const snapshot = JSON.parse(readFile(snapshotPath));
  const snapshotCommit = snapshot?.git?.commit;
  const snapshotCommitFull = snapshot?.git?.commitFull;
  const reportWithSnapshot = {
    ...base,
    snapshotPath,
    snapshotCommit,
    ...(typeof snapshotCommitFull === "string" && snapshotCommitFull.length > 0
      ? { snapshotCommitFull }
      : {}),
    validation: validationSummary(validation),
  };

  if (validation.exitCode !== 0) {
    return {
      exitCode: 1,
      report: {
        ...reportWithSnapshot,
        failure: "latest snapshot validation failed",
      },
    };
  }

  let currentCommitFull;
  try {
    currentCommitFull = readCurrentCommit(gitRunner);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: {
        ...reportWithSnapshot,
        failure: message,
      },
    };
  }

  const comparison = buildCommitComparison({ snapshot, currentCommitFull });
  const { fresh } = comparison;
  const report = {
    ...reportWithSnapshot,
    ...comparison,
    ok: fresh,
    fresh,
  };

  if (fresh && snapshot.releaseClaim) {
    report.releaseClaim = snapshot.releaseClaim;
  }

  if (!fresh) {
    report.failure = "snapshot commit does not match current commit";
  }

  return {
    exitCode: fresh ? 0 : 1,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceCheckArgs(process.argv.slice(2));
  const result = checkReleaseHandoffEvidence(options);
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
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
