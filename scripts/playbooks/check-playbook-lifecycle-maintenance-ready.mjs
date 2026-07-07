import { pathToFileURL } from "node:url";

import {
  buildPlaybookLifecycleHandoffCliResult,
} from "./check-playbook-lifecycle-handoff.mjs";
import {
  doctorPlaybookLifecycleSequenceEvidence,
} from "./doctor-playbook-lifecycle-sequence-evidence.mjs";

export const PLAYBOOK_LIFECYCLE_MAINTENANCE_READY_COMMAND =
  "playbook:lifecycle:maintenance:ready";

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parsePlaybookLifecycleMaintenanceReadyArgs(argv) {
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

function handoffDateFromNow(now) {
  if (!now) return undefined;
  const datePart = String(now).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error(`--now must start with YYYY-MM-DD, got: ${now}`);
  }
  return datePart;
}

function buildBaseReport(evidencePath) {
  return {
    ok: false,
    command: PLAYBOOK_LIFECYCLE_MAINTENANCE_READY_COMMAND,
    evidencePath,
    readyForLifecycleMaintenance: false,
    productionReady: false,
    publishingPerformed: false,
    readinessOnly: true,
  };
}

function summarizeHandoff(handoffResult, handoffReport) {
  return {
    ok: handoffReport.ok,
    exitCode: handoffResult.exitCode,
    command: handoffReport.command,
    readyForLifecycleHandoff: handoffReport.readyForLifecycleHandoff,
    findings: handoffReport.findings?.length ?? 0,
    nextCommand: handoffReport.nextCommand,
  };
}

function summarizeDoctor(doctorResult) {
  return {
    ok: doctorResult.report.ok,
    exitCode: doctorResult.exitCode,
    command: doctorResult.report.command,
    status: doctorResult.report.status,
    severity: doctorResult.report.severity,
    nextCommand: doctorResult.report.nextCommand,
  };
}

function buildFindings(handoffReport, doctorReport) {
  const findings = [];
  if (!handoffReport.ok) {
    findings.push({
      code: "lifecycle_handoff_not_ready",
      severity: "error",
      message: "Playbook lifecycle handoff is not green.",
      nextCommand: "npm run playbook:lifecycle:handoff",
    });
  }
  if (doctorReport.status !== "fresh_evidence") {
    findings.push({
      code: "sequence_evidence_not_ready",
      severity: "error",
      status: doctorReport.status,
      message: "Playbook lifecycle sequence evidence is not fresh and ready.",
      nextCommand:
        `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence ${doctorReport.evidencePath}`,
    });
  }
  return findings;
}

function chooseStatus(handoffOk, evidenceOk) {
  if (handoffOk && evidenceOk) return "ready_for_lifecycle_maintenance";
  if (!handoffOk && !evidenceOk) return "maintenance_not_ready";
  if (!handoffOk) return "handoff_not_ready";
  return "evidence_not_ready";
}

function chooseNextCommand({ handoffOk, evidenceOk, evidencePath, handoffReport }) {
  if (!handoffOk) return "npm run playbook:lifecycle:handoff";
  if (!evidenceOk) {
    return `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence ${evidencePath}`;
  }
  return handoffReport.nextCommand;
}

function chooseNextAction(status) {
  if (status === "ready_for_lifecycle_maintenance") {
    return "Lifecycle handoff and sequence evidence are ready for the next governed maintenance review.";
  }
  if (status === "handoff_not_ready") {
    return "Fix lifecycle handoff findings before using sequence evidence for maintenance.";
  }
  if (status === "evidence_not_ready") {
    return "Refresh or repair lifecycle sequence evidence before maintenance.";
  }
  return "Fix lifecycle handoff and sequence evidence findings before maintenance.";
}

export function buildPlaybookLifecycleMaintenanceReadyCliResult(options = {}) {
  const handoffResult = (options.buildHandoffResult ?? buildPlaybookLifecycleHandoffCliResult)({
    now: handoffDateFromNow(options.now),
    pretty: false,
  });
  const handoffReport = JSON.parse(handoffResult.stdout);
  const doctorResult = (options.buildDoctorResult ?? doctorPlaybookLifecycleSequenceEvidence)({
    evidencePath: options.evidencePath,
    now: options.now,
    currentCommit: options.currentCommit,
  });
  const doctorReport = doctorResult.report;
  const handoffOk = Boolean(handoffReport.ok);
  const evidenceOk = doctorReport.status === "fresh_evidence";
  const ready = handoffOk && evidenceOk;
  const status = chooseStatus(handoffOk, evidenceOk);
  const findings = buildFindings(handoffReport, doctorReport);
  const report = {
    ...buildBaseReport(options.evidencePath),
    ok: ready,
    readyForLifecycleMaintenance: ready,
    status,
    summary: {
      findings: findings.length,
    },
    checks: {
      lifecycleHandoff: summarizeHandoff(handoffResult, handoffReport),
      sequenceEvidenceDoctor: summarizeDoctor(doctorResult),
    },
    findings,
    nextCommand: chooseNextCommand({
      handoffOk,
      evidenceOk,
      evidencePath: options.evidencePath,
      handoffReport,
    }),
    nextAction: chooseNextAction(status),
  };

  return {
    exitCode: ready ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMaintenanceReadyArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMaintenanceReadyCliResult(options);
  process.stdout.write(result.stdout);
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
