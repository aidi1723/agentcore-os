import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildReleaseHandoffSnapshotIndex } from "./index-release-handoff-snapshots.mjs";

export const RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND =
  "release:handoff:evidence:audit";
const DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR = "output/release-handoff";
const DEFAULT_AUDIT_LIMIT = 10;

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

export function parseReleaseHandoffEvidenceAuditArgs(argv) {
  const options = {
    snapshotDir: DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
    limit: DEFAULT_AUDIT_LIMIT,
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

function parseSnapshot(raw) {
  try {
    return { snapshot: JSON.parse(raw) };
  } catch {
    return { error: "snapshot file is not valid JSON" };
  }
}

function hasFullCommitEvidence(snapshot) {
  return (
    typeof snapshot?.git?.commitFull === "string" &&
    snapshot.git.commitFull.length > 0
  );
}

function classifyEntry(entry) {
  if (entry.validation?.error === "snapshot file is not valid JSON") {
    return "invalid_json";
  }
  if (entry.validation?.ok === true && entry.validation?.snapshotOk === false) {
    return "failed_evidence";
  }
  if (entry.validation?.exitCode !== 0) {
    return "invalid_evidence";
  }
  if (entry.ok === true) return "success";
  return "invalid_evidence";
}

function auditEntry(entry, readFile) {
  const parsed = entry.error
    ? { error: entry.error }
    : parseSnapshot(readFile(entry.path));
  const classification = classifyEntry(entry);
  const hasFullCommit =
    classification === "success" && hasFullCommitEvidence(parsed.snapshot);
  const audited = {
    path: entry.path,
    createdAt: entry.createdAt,
    ok: entry.ok,
    classification,
    hasFullCommit,
    validation: entry.validation,
  };

  if (entry.releaseClaim) {
    audited.releaseClaim = entry.releaseClaim;
  }

  if (entry.error || parsed.error) {
    audited.error = entry.error ?? parsed.error;
  }

  return audited;
}

function buildSummary(entries) {
  const successfulEntries = entries.filter((entry) => entry.classification === "success");
  return {
    total: entries.length,
    successful: successfulEntries.length,
    failedEvidence: entries.filter(
      (entry) => entry.classification === "failed_evidence",
    ).length,
    invalidEvidence: entries.filter(
      (entry) => entry.classification === "invalid_evidence",
    ).length,
    invalidJson: entries.filter((entry) => entry.classification === "invalid_json")
      .length,
    withFullCommit: successfulEntries.filter((entry) => entry.hasFullCommit)
      .length,
    missingFullCommit: successfulEntries.filter((entry) => !entry.hasFullCommit)
      .length,
  };
}

function finding(code, count, paths = [], severity = "error") {
  return {
    code,
    severity,
    count,
    ...(paths.length > 0 ? { paths } : {}),
  };
}

function pathsFor(entries, predicate) {
  return entries.filter(predicate).map((entry) => entry.path);
}

function buildFindings({ entries, indexResult, summary, latestSnapshot }) {
  const findings = [];
  if (summary.total === 0) {
    findings.push(finding("no_snapshots", 0));
  }

  if (latestSnapshot && latestSnapshot.classification !== "success") {
    findings.push(
      finding("latest_snapshot_not_successful", 1, [latestSnapshot.path]),
    );
  }

  if (indexResult.exitCode !== 0) {
    findings.push(
      finding(
        "checked_index_failed",
        entries.filter((entry) => entry.validation?.exitCode !== 0).length,
        pathsFor(entries, (entry) => entry.validation?.exitCode !== 0),
      ),
    );
  }

  if (summary.failedEvidence > 0) {
    findings.push(
      finding(
        "failed_evidence",
        summary.failedEvidence,
        pathsFor(entries, (entry) => entry.classification === "failed_evidence"),
      ),
    );
  }

  if (summary.invalidEvidence > 0) {
    findings.push(
      finding(
        "invalid_evidence",
        summary.invalidEvidence,
        pathsFor(entries, (entry) => entry.classification === "invalid_evidence"),
      ),
    );
  }

  if (summary.invalidJson > 0) {
    findings.push(
      finding(
        "invalid_json",
        summary.invalidJson,
        pathsFor(entries, (entry) => entry.classification === "invalid_json"),
      ),
    );
  }

  if (summary.missingFullCommit > 0) {
    findings.push(
      finding(
        "missing_full_commit_evidence",
        summary.missingFullCommit,
        pathsFor(
          entries,
          (entry) => entry.classification === "success" && !entry.hasFullCommit,
        ),
      ),
    );
  }

  return findings;
}

function buildLatestSnapshot(entries) {
  const latest = entries[0];
  if (!latest) return undefined;
  return {
    path: latest.path,
    createdAt: latest.createdAt,
    ok: latest.ok,
    classification: latest.classification,
    hasFullCommit: latest.hasFullCommit,
    validation: latest.validation,
    ...(latest.releaseClaim ? { releaseClaim: latest.releaseClaim } : {}),
  };
}

function chooseNextCommand({
  ok,
  count,
  indexOk,
  latestSuccessful,
  missingFullCommit,
  limit,
}) {
  if (ok) return "npm run release:handoff:evidence:status";
  if (count === 0 || !latestSuccessful || missingFullCommit > 0) {
    return "npm run release:handoff:snapshot";
  }
  if (!indexOk) {
    return `npm run release:handoff:snapshot:index -- --check --limit ${limit}`;
  }
  return "npm run release:handoff:snapshot";
}

function chooseNextAction({ ok, count, indexOk, latestSuccessful, missingFullCommit }) {
  if (ok) {
    return "Audited local evidence is clean; run the evidence status command for the current handoff summary.";
  }
  if (count === 0) {
    return "No local handoff evidence was found; run the handoff snapshot command after the local handoff gate passes.";
  }
  if (!latestSuccessful) {
    return "Latest audited evidence is not successful; regenerate local handoff evidence after the handoff gate passes.";
  }
  if (missingFullCommit > 0) {
    return "Some successful audited snapshots are missing full commit evidence; regenerate local handoff evidence for a full-SHA audited window.";
  }
  if (!indexOk) {
    return "Checked snapshot index found invalid or failed evidence; inspect the checked snapshot index before handoff review.";
  }
  return "Audit failed; regenerate local handoff evidence after the handoff gate passes.";
}

function buildBaseReport({ snapshotDir, limit }) {
  return {
    ok: false,
    command: RELEASE_HANDOFF_EVIDENCE_AUDIT_COMMAND,
    snapshotDir,
    limit,
    count: 0,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
  };
}

export function auditReleaseHandoffEvidence({
  snapshotDir = DEFAULT_RELEASE_HANDOFF_EVIDENCE_DIR,
  limit = DEFAULT_AUDIT_LIMIT,
  listFiles = (dir) => readdirSync(dir),
  readFile = (filePath) => readFileSync(filePath, "utf8"),
} = {}) {
  const indexResult = buildReleaseHandoffSnapshotIndex({
    snapshotDir,
    limit,
    check: true,
    listFiles,
    readFile,
  });
  const entries = indexResult.report.snapshots.map((entry) =>
    auditEntry(entry, readFile),
  );
  const summary = buildSummary(entries);
  const latestSnapshot = buildLatestSnapshot(entries);
  const indexOk = indexResult.exitCode === 0;
  const latestSuccessful = latestSnapshot?.classification === "success";
  const ok =
    summary.total > 0 &&
    indexOk &&
    latestSuccessful &&
    summary.missingFullCommit === 0;
  const findings = buildFindings({
    entries,
    indexResult,
    summary,
    latestSnapshot,
  });
  const nextCommand = chooseNextCommand({
    ok,
    count: summary.total,
    indexOk,
    latestSuccessful,
    missingFullCommit: summary.missingFullCommit,
    limit,
  });
  const nextAction = chooseNextAction({
    ok,
    count: summary.total,
    indexOk,
    latestSuccessful,
    missingFullCommit: summary.missingFullCommit,
  });

  const report = {
    ...buildBaseReport({ snapshotDir, limit }),
    ok,
    count: summary.total,
    summary,
    latestSnapshot,
    findings,
    nextCommand,
    nextAction,
  };

  return {
    exitCode: ok ? 0 : 1,
    report,
  };
}

function main() {
  const options = parseReleaseHandoffEvidenceAuditArgs(process.argv.slice(2));
  const result = auditReleaseHandoffEvidence(options);
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
