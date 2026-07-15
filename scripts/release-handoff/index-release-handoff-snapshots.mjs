import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkReleaseHandoffSnapshotFile } from "./check-release-handoff-snapshot.mjs";

export const RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND =
  "release:handoff:snapshot:index";
export const DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR =
  "output/release-handoff";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${option} must be an integer.`);
  }
  if (parsed <= 0) {
    throw new Error(`${option} must be greater than 0.`);
  }
  return parsed;
}

export function parseReleaseHandoffSnapshotIndexArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR,
    limit: undefined,
    check: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      options.snapshotDir = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      index += 1;
      continue;
    }
    if (arg === "--check") {
      options.check = true;
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

function parseSnapshotJson(raw) {
  try {
    return { snapshot: JSON.parse(raw) };
  } catch {
    return { error: "snapshot file is not valid JSON" };
  }
}

function getSortTime(entry) {
  const parsed = Date.parse(entry.createdAt ?? "");
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

function buildSnapshotEntry(filePath, readFile) {
  const raw = readFile(filePath);
  const parsed = parseSnapshotJson(raw);
  if (parsed.error) {
    return {
      path: filePath,
      ok: false,
      error: parsed.error,
    };
  }

  const snapshot = parsed.snapshot;
  const entry = {
    path: filePath,
    createdAt: snapshot?.createdAt,
    ok: snapshot?.ok === true,
    productionReady:
      snapshot?.productionReady === false ? false : snapshot?.productionReady,
    publishingPerformed:
      snapshot?.publishingPerformed === false ? false : snapshot?.publishingPerformed,
    evidenceOnly: snapshot?.evidenceOnly === true,
  };

  if (snapshot?.ok === true && snapshot.releaseClaim) {
    entry.releaseClaim = snapshot.releaseClaim;
  }

  return entry;
}

function attachValidation(entry, readFile) {
  try {
    const result = checkReleaseHandoffSnapshotFile({
      snapshotPath: entry.path,
      readFile,
    });
    return {
      ...entry,
      validation: {
        ok: result.report.ok,
        exitCode: result.exitCode,
        snapshotOk: result.report.snapshotOk,
        failures: result.report.failures,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...entry,
      ok: false,
      error: message,
      validation: {
        ok: false,
        exitCode: 1,
        error: message,
      },
    };
  }
}

function buildBaseReport({ snapshotDir, checked }) {
  return {
    ok: true,
    command: RELEASE_HANDOFF_SNAPSHOT_INDEX_COMMAND,
    snapshotDir,
    count: 0,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    checked,
    snapshots: [],
  };
}

/**
 * @param {{
 *   snapshotDir?: string,
 *   limit?: number,
 *   check?: boolean,
 *   listFiles?: (dir: string) => string[],
 *   readFile?: (filePath: string) => string,
 * }} [options]
 */
export function buildReleaseHandoffSnapshotIndex({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_SNAPSHOT_INDEX_DIR,
  limit,
  check = false,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
} = {}) {
  const filePaths = listJsonSnapshotFiles(snapshotDir, listFiles);
  const entries = filePaths
    .map((filePath) => buildSnapshotEntry(filePath, readFile))
    .sort((a, b) => {
      const byCreatedAt = getSortTime(b) - getSortTime(a);
      if (byCreatedAt !== 0) return byCreatedAt;
      return b.path.localeCompare(a.path);
    })
    .slice(0, limit ?? filePaths.length)
    .map((entry) => (check ? attachValidation(entry, readFile) : entry));

  const failedCheckedEntry = check
    ? entries.find((entry) => entry.validation?.exitCode !== 0)
    : undefined;
  const report = {
    ...buildBaseReport({ snapshotDir, checked: check }),
    ok: !failedCheckedEntry,
    count: entries.length,
    snapshots: entries,
  };

  return {
    exitCode: failedCheckedEntry ? 1 : 0,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffSnapshotIndexArgs(process.argv.slice(2));
  const result = buildReleaseHandoffSnapshotIndex(options);
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
