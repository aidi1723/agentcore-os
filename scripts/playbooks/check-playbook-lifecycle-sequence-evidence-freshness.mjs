import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validatePlaybookLifecycleChangeProposal } from "@/lib/executor/playbooks/lifecycle-change-proposal";
import { validatePlaybookLifecycleMaintenanceSequence } from "@/lib/executor/playbooks/lifecycle-maintenance-sequence";
import { validatePlaybookLifecycleMigrationPlan } from "@/lib/executor/playbooks/lifecycle-migration-plan";
import { validatePlaybookLifecycleSequenceEvidence } from "@/lib/executor/playbooks/lifecycle-sequence-evidence";
import {
  PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND,
  validatePlaybookLifecycleSequenceEvidenceFreshness,
} from "@/lib/executor/playbooks/lifecycle-sequence-evidence-freshness";

export { PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_FRESHNESS_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a path value`);
  }
  return value;
}

export function parsePlaybookLifecycleSequenceEvidenceFreshnessArgs(argv) {
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

function readCurrentCommit(cwd) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? "").trim();
    throw new Error(stderr || "git rev-parse failed");
  }
  const commit = String(result.stdout ?? "").trim();
  if (!commit) {
    throw new Error("git rev-parse returned an empty commit");
  }
  return commit;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult(options) {
  const cwd = options.cwd ?? process.cwd();
  const evidencePath = options.evidencePath;
  const evidence = readJsonFile(
    resolve(cwd, evidencePath),
    "sequence evidence file is not valid JSON",
  );
  const sequencePath = getStringField(evidence, "sequencePath");
  const sequenceFile = sequencePath
    ? readFileSync(resolve(cwd, sequencePath), "utf8")
    : "{}";
  const sequence = sequencePath
    ? JSON.parse(sequenceFile)
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
  const evidenceReport = validatePlaybookLifecycleSequenceEvidence(evidence, {
    evidencePath,
    sequenceReport,
  });
  const report = validatePlaybookLifecycleSequenceEvidenceFreshness(evidence, {
    evidencePath,
    evidenceReport,
    currentCommitFull: options.currentCommit ?? readCurrentCommit(cwd),
    sequenceDigest: sha256(sequenceFile),
    now: options.now ?? new Date().toISOString(),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleSequenceEvidenceFreshnessArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleSequenceEvidenceFreshnessCliResult(options);
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
