import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult,
} from "./check-playbook-lifecycle-sequence-evidence-freshness.mjs";

export const PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_DOCTOR_COMMAND =
  "playbook:lifecycle:sequence:evidence:doctor";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parsePlaybookLifecycleSequenceEvidenceDoctorArgs(argv) {
  const options = {
    pretty: true,
    evidencePath: undefined,
    now: undefined,
    currentCommit: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--evidence") {
      options.evidencePath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--now") {
      options.now = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--current-commit") {
      options.currentCommit = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.evidencePath) {
    throw new Error("--evidence <path> is required");
  }

  return options;
}

function buildBaseReport(evidencePath) {
  return {
    ok: false,
    command: PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_DOCTOR_COMMAND,
    evidencePath,
    productionReady: false,
    publishingPerformed: false,
    diagnosticOnly: true,
  };
}

function sequenceEvidenceCheckCommand(evidencePath) {
  return `npm run playbook:lifecycle:sequence:evidence:check -- --evidence ${evidencePath}`;
}

function freshnessCheckCommand(evidencePath) {
  return `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence ${evidencePath}`;
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

function summarizeFreshness(freshnessResult, report) {
  return {
    ok: report.ok,
    exitCode: freshnessResult.exitCode,
    checks: report.checks,
    findings: report.findings,
  };
}

const FINDING_STATUS_PRIORITY = [
  "invalid_evidence_report",
  "invalid_provenance",
  "sequence_digest_mismatch",
  "source_commit_mismatch",
  "future_recorded_at",
  "stale_evidence",
  "invalid_recorded_at",
];

function statusFromFreshnessFindings(findings) {
  const codes = new Set(
    Array.isArray(findings)
      ? findings.map((finding) => finding?.code).filter(Boolean)
      : [],
  );
  const code = FINDING_STATUS_PRIORITY.find((candidate) => codes.has(candidate));
  if (code === "invalid_evidence_report") return "invalid_evidence";
  return code ?? "invalid_evidence";
}

function actionForStatus(status) {
  if (status === "invalid_evidence") {
    return "Fix or regenerate lifecycle sequence evidence before using it for lifecycle maintenance.";
  }
  if (status === "invalid_provenance") {
    return "Add source commit, sequence digest, and max-age provenance before using this evidence.";
  }
  if (status === "sequence_digest_mismatch") {
    return "Refresh lifecycle sequence evidence for the current referenced sequence file digest.";
  }
  if (status === "source_commit_mismatch") {
    return "Refresh lifecycle sequence evidence for the current source commit.";
  }
  if (status === "future_recorded_at") {
    return "Fix the evidence timestamp source and rerun lifecycle sequence evidence review.";
  }
  if (status === "stale_evidence") {
    return "Refresh lifecycle sequence evidence because the max-age window has expired.";
  }
  if (status === "invalid_recorded_at") {
    return "Fix evidence recordedAt or review now timestamp before using this evidence.";
  }
  return "Review lifecycle sequence evidence findings before changing playbooks or fixtures.";
}

export function doctorPlaybookLifecycleSequenceEvidence({
  evidencePath,
  cwd = process.cwd(),
  now,
  currentCommit,
  fileExists = (path) => existsSync(resolve(cwd, path)),
  buildFreshnessResult = buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult,
} = {}) {
  const base = buildBaseReport(evidencePath);
  if (!fileExists(evidencePath)) {
    return {
      exitCode: 1,
      report: withStatus(
        base,
        "missing_evidence",
        "error",
        sequenceEvidenceCheckCommand(evidencePath),
        "No lifecycle sequence evidence file was found; create or restore the evidence file before lifecycle maintenance.",
      ),
    };
  }

  let freshnessResult;
  let freshnessReport;
  try {
    freshnessResult = buildFreshnessResult({
      cwd,
      evidencePath,
      now,
      currentCommit,
      pretty: false,
    });
    freshnessReport = JSON.parse(freshnessResult.stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      report: withStatus(
        {
          ...base,
          validation: {
            ok: false,
            error: message,
          },
        },
        "invalid_evidence",
        "error",
        sequenceEvidenceCheckCommand(evidencePath),
        "Lifecycle sequence evidence could not be parsed or validated; fix the evidence file before lifecycle maintenance.",
      ),
    };
  }

  if (freshnessReport.ok) {
    return {
      exitCode: 0,
      report: withStatus(
        {
          ...base,
          freshness: summarizeFreshness(freshnessResult, freshnessReport),
        },
        "fresh_evidence",
        "info",
        freshnessCheckCommand(evidencePath),
        "Lifecycle sequence evidence is fresh for the referenced commit and sequence digest.",
        true,
      ),
    };
  }

  const status = statusFromFreshnessFindings(freshnessReport.findings);
  return {
    exitCode: 1,
    report: withStatus(
      {
        ...base,
        freshness: summarizeFreshness(freshnessResult, freshnessReport),
      },
      status,
      "error",
      sequenceEvidenceCheckCommand(evidencePath),
      actionForStatus(status),
    ),
  };
}

function main() {
  const options = parsePlaybookLifecycleSequenceEvidenceDoctorArgs(
    process.argv.slice(2),
  );
  const result = doctorPlaybookLifecycleSequenceEvidence(options);
  process.stdout.write(
    `${JSON.stringify(result.report, null, options.pretty === false ? 0 : 2)}\n`,
  );
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
