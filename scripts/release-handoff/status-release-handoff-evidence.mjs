import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { doctorReleaseHandoffEvidence } from "./doctor-release-handoff-evidence.mjs";
import { buildReleaseHandoffSnapshotIndex } from "./index-release-handoff-snapshots.mjs";

export const RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND =
  "release:handoff:evidence:status";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";
const DEFAULT_STATUS_LIMIT = 5;

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

export function parseReleaseHandoffEvidenceStatusArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
    limit: DEFAULT_STATUS_LIMIT,
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
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function compactDoctor(result) {
  const report = result.report;
  return {
    exitCode: result.exitCode,
    ok: report.ok,
    status: report.status,
    severity: report.severity,
    snapshotPath: report.snapshotPath,
    snapshotCommit: report.snapshotCommit,
    snapshotCommitFull: report.snapshotCommitFull,
    currentCommit: report.currentCommit,
    currentCommitFull: report.currentCommitFull,
    nextCommand: report.nextCommand,
    nextAction: report.nextAction,
    validation: report.validation,
  };
}

function compactIndex(result) {
  const report = result.report;
  return {
    exitCode: result.exitCode,
    ok: report.ok,
    count: report.count,
    checked: report.checked,
    snapshots: report.snapshots,
  };
}

function buildIndexReviewCommand(limit) {
  return `npm run release:handoff:snapshot:index -- --check --limit ${limit}`;
}

export function buildReleaseHandoffEvidenceStatus({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  limit = DEFAULT_STATUS_LIMIT,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
  gitRunner,
} = {}) {
  const doctorResult = doctorReleaseHandoffEvidence({
    snapshotDir,
    listFiles,
    readFile,
    ...(gitRunner ? { gitRunner } : {}),
  });
  const indexResult = buildReleaseHandoffSnapshotIndex({
    snapshotDir,
    limit,
    check: true,
    listFiles,
    readFile,
  });

  const doctorReady =
    doctorResult.exitCode === 0 &&
    doctorResult.report.status === "fresh_evidence";
  const indexReady = indexResult.exitCode === 0 && indexResult.report.count > 0;
  const readyForLocalHandoffEvidence = doctorReady && indexReady;
  const indexReviewNeeded = doctorReady && !indexReady;

  const nextCommand = indexReviewNeeded
    ? buildIndexReviewCommand(limit)
    : doctorResult.report.nextCommand;
  const nextAction = indexReviewNeeded
    ? "Recent handoff evidence index validation failed; inspect the checked snapshot index before using local evidence for handoff."
    : doctorResult.report.nextAction;

  const report = {
    ok: readyForLocalHandoffEvidence,
    command: RELEASE_HANDOFF_EVIDENCE_STATUS_COMMAND,
    snapshotDir,
    limit,
    readyForLocalHandoffEvidence,
    nextCommand,
    nextAction,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    doctor: compactDoctor(doctorResult),
    index: compactIndex(indexResult),
  };

  return {
    exitCode: readyForLocalHandoffEvidence ? 0 : 1,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceStatusArgs(process.argv.slice(2));
  const result = buildReleaseHandoffEvidenceStatus(options);
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
