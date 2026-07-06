import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND =
  "release:handoff:snapshot:check";
export const CHECKED_RELEASE_HANDOFF_SNAPSHOT_RULES = [
  "top_level_shape",
  "git_context_shape",
  "handoff_report_shape",
  "release_boundary",
];

const RELEASE_HANDOFF_CLAIM = "local_release_handoff_ready";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pushIf(failures, condition, message) {
  if (condition) failures.push(message);
}

function validateTopLevelShape(snapshot, failures) {
  pushIf(failures, snapshot?.schemaVersion !== 1, "schemaVersion must be 1");
  pushIf(
    failures,
    snapshot?.kind !== "release_handoff_evidence_snapshot",
    "kind must be release_handoff_evidence_snapshot",
  );
  pushIf(
    failures,
    snapshot?.command !== "release:handoff:snapshot",
    "command must be release:handoff:snapshot",
  );
  pushIf(
    failures,
    snapshot?.sourceCommand !== "release:handoff:check",
    "sourceCommand must be release:handoff:check",
  );
  pushIf(failures, typeof snapshot?.createdAt !== "string" || !snapshot.createdAt, "createdAt must be a non-empty string");
  pushIf(failures, typeof snapshot?.ok !== "boolean", "ok must be boolean");
  pushIf(failures, snapshot?.productionReady !== false, "productionReady must be false");
  pushIf(
    failures,
    snapshot?.publishingPerformed !== false,
    "publishingPerformed must be false",
  );
  pushIf(failures, snapshot?.evidenceOnly !== true, "evidenceOnly must be true");
  pushIf(failures, !isObject(snapshot?.git), "git must be an object");
  pushIf(
    failures,
    !isObject(snapshot?.handoffReport),
    "handoffReport must be an object",
  );
}

function validateGitShape(git, failures) {
  if (!isObject(git)) return;
  pushIf(failures, typeof git.branch !== "string", "git.branch must be a string");
  pushIf(failures, typeof git.commit !== "string", "git.commit must be a string");
  pushIf(failures, typeof git.dirty !== "boolean", "git.dirty must be boolean");
  pushIf(
    failures,
    typeof git.hasTrackedChanges !== "boolean",
    "git.hasTrackedChanges must be boolean",
  );
  pushIf(
    failures,
    typeof git.hasUntrackedFiles !== "boolean",
    "git.hasUntrackedFiles must be boolean",
  );
  pushIf(
    failures,
    !Array.isArray(git.statusShort),
    "git.statusShort must be an array",
  );
}

function validateHandoffReportShape(handoffReport, failures) {
  if (!isObject(handoffReport)) return;
  pushIf(
    failures,
    handoffReport.command !== "release:handoff:check",
    "handoffReport.command must be release:handoff:check",
  );
  pushIf(
    failures,
    typeof handoffReport.ok !== "boolean",
    "handoffReport.ok must be boolean",
  );
  pushIf(
    failures,
    handoffReport.productionReady !== false,
    "handoffReport.productionReady must be false",
  );
  pushIf(
    failures,
    handoffReport.publishingPerformed !== false,
    "handoffReport.publishingPerformed must be false",
  );
  pushIf(
    failures,
    !Array.isArray(handoffReport.checks),
    "handoffReport.checks must be an array",
  );
}

function validateReleaseBoundary(snapshot, failures) {
  if (snapshot?.ok === true) {
    pushIf(
      failures,
      snapshot.releaseClaim !== RELEASE_HANDOFF_CLAIM,
      "successful snapshots must include local_release_handoff_ready releaseClaim",
    );
    pushIf(
      failures,
      snapshot.handoffReport?.ok !== true,
      "successful snapshots must embed a successful handoffReport",
    );
    pushIf(
      failures,
      snapshot.handoffReport?.releaseClaim !== RELEASE_HANDOFF_CLAIM,
      "successful snapshots must embed local_release_handoff_ready handoffReport releaseClaim",
    );
  }

  if (snapshot?.ok === false) {
    pushIf(
      failures,
      hasOwn(snapshot, "releaseClaim"),
      "failed snapshots must not include releaseClaim",
    );
    pushIf(
      failures,
      snapshot.handoffReport?.ok !== false,
      "failed snapshots must embed a failed handoffReport",
    );
  }
}

function buildBaseReport(snapshotPath) {
  return {
    ok: true,
    command: RELEASE_HANDOFF_SNAPSHOT_CHECK_COMMAND,
    snapshotPath,
    productionReady: false,
    publishingPerformed: false,
    evidenceOnly: true,
    checkedRules: CHECKED_RELEASE_HANDOFF_SNAPSHOT_RULES,
  };
}

export function validateReleaseHandoffSnapshot(snapshot, snapshotPath) {
  const failures = [];
  validateTopLevelShape(snapshot, failures);
  validateGitShape(snapshot?.git, failures);
  validateHandoffReportShape(snapshot?.handoffReport, failures);
  validateReleaseBoundary(snapshot, failures);

  const report = {
    ...buildBaseReport(snapshotPath),
    snapshotOk: snapshot?.ok === true,
  };

  if (snapshot?.ok === true && snapshot.releaseClaim) {
    report.releaseClaim = snapshot.releaseClaim;
  }

  if (failures.length > 0) {
    return {
      exitCode: 1,
      report: {
        ...report,
        ok: false,
        snapshotOk: false,
        failures,
      },
    };
  }

  return {
    exitCode: snapshot.ok ? 0 : 1,
    report,
  };
}

export function checkReleaseHandoffSnapshotFile({
  snapshotPath,
  readFile = (filePath) => readFileSync(filePath, "utf8"),
} = {}) {
  if (!snapshotPath) {
    throw new Error("snapshot path is required");
  }

  let snapshot;
  try {
    snapshot = JSON.parse(readFile(snapshotPath));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("snapshot file is not valid JSON");
    }
    throw error;
  }

  return validateReleaseHandoffSnapshot(snapshot, snapshotPath);
}

function main() {
  const snapshotPath = process.argv[2];
  const result = checkReleaseHandoffSnapshotFile({ snapshotPath });
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
