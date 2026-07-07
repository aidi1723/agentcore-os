import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validatePlaybookLifecycleChangeProposal } from "@/lib/executor/playbooks/lifecycle-change-proposal";
import { validatePlaybookLifecycleMaintenanceSequence } from "@/lib/executor/playbooks/lifecycle-maintenance-sequence";
import { validatePlaybookLifecycleMigrationPlan } from "@/lib/executor/playbooks/lifecycle-migration-plan";
import {
  PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND,
  validatePlaybookLifecycleSequenceEvidence,
} from "@/lib/executor/playbooks/lifecycle-sequence-evidence";

export { PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_COMMAND };

export function parsePlaybookLifecycleSequenceEvidenceArgs(argv) {
  const options = {
    pretty: true,
    evidencePath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--evidence") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--evidence requires a path value");
      }
      options.evidencePath = value;
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

function readJsonFile(path, invalidMessage) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(invalidMessage);
    }
    throw error;
  }
}

function getStringField(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return typeof value[field] === "string" ? value[field] : "";
}

export function buildPlaybookLifecycleSequenceEvidenceCliResult(options) {
  const cwd = options.cwd ?? process.cwd();
  const evidencePath = options.evidencePath;
  const evidence = readJsonFile(
    resolve(cwd, evidencePath),
    "sequence evidence file is not valid JSON",
  );
  const sequencePath = getStringField(evidence, "sequencePath");
  const sequence = sequencePath
    ? readJsonFile(resolve(cwd, sequencePath), "maintenance sequence file is not valid JSON")
    : {};
  const proposalPath = getStringField(sequence, "proposalPath");
  const migrationPlanPath = getStringField(sequence, "migrationPlanPath");
  const proposal = proposalPath
    ? readJsonFile(resolve(cwd, proposalPath), "proposal file is not valid JSON")
    : {};
  const migrationPlan = migrationPlanPath
    ? readJsonFile(resolve(cwd, migrationPlanPath), "migration plan file is not valid JSON")
    : {};
  const proposalReport = validatePlaybookLifecycleChangeProposal(proposal, {
    proposalPath,
    fileExists: (path) => existsSync(resolve(cwd, path)),
  });
  const migrationPlanReport = validatePlaybookLifecycleMigrationPlan(migrationPlan, {
    planPath: migrationPlanPath,
    proposalReport,
  });
  const sequenceReport = validatePlaybookLifecycleMaintenanceSequence(sequence, {
    sequencePath,
    proposalReport,
    migrationPlanReport,
  });
  const report = validatePlaybookLifecycleSequenceEvidence(evidence, {
    evidencePath,
    sequenceReport,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleSequenceEvidenceArgs(process.argv.slice(2));
  const result = buildPlaybookLifecycleSequenceEvidenceCliResult(options);
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
