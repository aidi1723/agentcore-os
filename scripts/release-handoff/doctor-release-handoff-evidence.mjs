import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkReleaseHandoffSnapshotFile } from "./check-release-handoff-snapshot.mjs";

export const RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND =
  "release:handoff:evidence:doctor";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

export function parseReleaseHandoffEvidenceDoctorArgs(argv) {
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
  return spawnSync("git", ["rev-parse", "--short", "HEAD"], {
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

function buildBaseReport(snapshotDir) {
  return {
    ok: false,
    command: RELEASE_HANDOFF_EVIDENCE_DOCTOR_COMMAND,
    snapshotDir,
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

function withStatus(report, status, severity, nextCommand, nextAction, ok = false) {
  return {
    ...report,
    ok,
    status,
    severity,
    nextCommand,
    nextAction,
  };
}

export function doctorReleaseHandoffEvidence({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
  gitRunner = runGitCommit,
} = {}) {
  const base = buildBaseReport(snapshotDir);
  const snapshotPath = findNewestSnapshotPath({ snapshotDir, listFiles, readFile });

  if (!snapshotPath) {
    return {
      exitCode: 1,
      report: withStatus(
        base,
        "missing_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "No local handoff evidence was found; run the handoff snapshot command after the local handoff gate passes.",
      ),
    };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(readFile(snapshotPath));
  } catch {
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...base,
          snapshotPath,
          validation: {
            ok: false,
            exitCode: 1,
            error: "snapshot file is not valid JSON",
          },
        },
        "invalid_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "Latest evidence is not valid JSON; regenerate local handoff evidence after the handoff gate passes.",
      ),
    };
  }

  let validation;
  try {
    validation = checkReleaseHandoffSnapshotFile({ snapshotPath, readFile });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...base,
          snapshotPath,
          snapshotCommit: snapshot?.git?.commit,
          validation: {
            ok: false,
            exitCode: 1,
            error: message,
          },
        },
        "invalid_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "Latest evidence could not be validated; regenerate local handoff evidence after the handoff gate passes.",
      ),
    };
  }

  const reportWithSnapshot = {
    ...base,
    snapshotPath,
    snapshotCommit: snapshot?.git?.commit,
    validation: validationSummary(validation),
  };

  if (validation.exitCode !== 0) {
    if (validation.report.ok === false) {
      return {
        exitCode: 1,
        report: withStatus(
          reportWithSnapshot,
          "invalid_evidence",
          "error",
          "npm run release:handoff:snapshot",
          "Latest evidence failed schema or release-boundary validation; regenerate local handoff evidence after the handoff gate passes.",
        ),
      };
    }

    return {
      exitCode: 1,
      report: withStatus(
        reportWithSnapshot,
        "failed_evidence",
        "error",
        "npm run release:handoff:check",
        "Latest evidence records a failed handoff gate; rerun the local handoff gate and fix the first failing check.",
      ),
    };
  }

  let currentCommit;
  try {
    currentCommit = readCurrentCommit(gitRunner);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...reportWithSnapshot,
          failure: message,
        },
        "git_unavailable",
        "error",
        "git rev-parse --short HEAD",
        "Current git commit could not be read; fix git access before checking evidence freshness.",
      ),
    };
  }

  const fresh = snapshot?.git?.commit === currentCommit;
  if (!fresh) {
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...reportWithSnapshot,
          currentCommit,
        },
        "stale_evidence",
        "error",
        "npm run release:handoff:snapshot",
        "Latest evidence is stale for the current commit; rerun the handoff snapshot after the local handoff gate passes.",
      ),
    };
  }

  const report = withStatus(
    {
      ...reportWithSnapshot,
      currentCommit,
    },
    "fresh_evidence",
    "info",
    "npm run release:handoff:evidence:check",
    "Fresh local handoff evidence is available; run the freshness gate when a hard pass/fail check is needed.",
    true,
  );

  if (snapshot.releaseClaim) {
    report.releaseClaim = snapshot.releaseClaim;
  }

  return {
    exitCode: 0,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceDoctorArgs(process.argv.slice(2));
  const result = doctorReleaseHandoffEvidence(options);
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
