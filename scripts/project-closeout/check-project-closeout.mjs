import { pathToFileURL } from "node:url";

import {
  PROJECT_CLOSEOUT_CHECK_COMMAND,
  buildProjectCloseoutReadinessReport,
} from "@/lib/executor/playbooks/project-closeout-readiness";

import {
  buildDeliveryReadyReport,
} from "../delivery-ready/check-delivery-ready.mjs";
import {
  buildPlaybookControlAuditCliResult,
} from "../playbooks/check-playbook-control.mjs";
import {
  buildPlaybookLifecycleMaintenanceReadyCliResult,
} from "../playbooks/check-playbook-lifecycle-maintenance-ready.mjs";
import {
  buildPlaybookLifecycleMutationDryRunCliResult,
} from "../playbooks/check-playbook-lifecycle-mutation-dry-run.mjs";

export { PROJECT_CLOSEOUT_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseProjectCloseoutCheckArgs(argv) {
  const options = {
    pretty: true,
    evidencePath: undefined,
    dryRunPath: undefined,
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
    if (arg === "--dry-run") {
      options.dryRunPath = readOptionValue(argv, index, arg);
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
  if (!options.dryRunPath) {
    throw new Error("--dry-run <path> is required");
  }

  return options;
}

function parseCliJsonResult(result) {
  return JSON.parse(result.stdout);
}

function buildDeliveryReadyCliResult(options = {}) {
  const result = buildDeliveryReadyReport(options.deliveryReadyOptions);
  return {
    exitCode: result.exitCode,
    stdout: `${JSON.stringify(result.report)}\n`,
  };
}

export function buildProjectCloseoutCheckCliResult(options = {}) {
  const controlAuditResult = (options.buildControlAuditResult ??
    buildPlaybookControlAuditCliResult)({
    pretty: false,
  });
  const maintenanceReadyResult = (options.buildMaintenanceReadyResult ??
    buildPlaybookLifecycleMaintenanceReadyCliResult)({
    evidencePath: options.evidencePath,
    now: options.now,
    currentCommit: options.currentCommit,
    pretty: false,
  });
  const mutationDryRunResult = (options.buildMutationDryRunResult ??
    buildPlaybookLifecycleMutationDryRunCliResult)({
    dryRunPath: options.dryRunPath,
    now: options.now,
    currentCommit: options.currentCommit,
    pretty: false,
  });
  const deliveryReadyResult = (options.buildDeliveryReadyResult ??
    buildDeliveryReadyCliResult)({
    pretty: false,
  });

  const report = buildProjectCloseoutReadinessReport({
    controlAuditReport: parseCliJsonResult(controlAuditResult),
    maintenanceReadyReport: parseCliJsonResult(maintenanceReadyResult),
    mutationDryRunReport: parseCliJsonResult(mutationDryRunResult),
    deliveryReadyReport: parseCliJsonResult(deliveryReadyResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseProjectCloseoutCheckArgs(process.argv.slice(2));
  const result = buildProjectCloseoutCheckCliResult(options);
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
