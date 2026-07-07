import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND,
  validatePlaybookLifecycleMutationPostApplyEvidence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-evidence";
import {
  validatePlaybookLifecycleMutationPostApplySequence,
} from "@/lib/executor/playbooks/lifecycle-mutation-post-apply-sequence";

export { PLAYBOOK_LIFECYCLE_MUTATION_POST_APPLY_EVIDENCE_COMMAND };

export function parsePlaybookLifecycleMutationPostApplyEvidenceArgs(argv) {
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

export function buildPlaybookLifecycleMutationPostApplyEvidenceCliResult(options) {
  const cwd = options.cwd ?? process.cwd();
  const evidencePath = options.evidencePath;
  const evidence = readJsonFile(
    resolve(cwd, evidencePath),
    "post-apply evidence file is not valid JSON",
  );
  const sequencePath = getStringField(evidence, "sequencePath");
  const sequence = sequencePath
    ? readJsonFile(resolve(cwd, sequencePath), "post-apply sequence file is not valid JSON")
    : {};
  const applyReportPath = getStringField(sequence, "applyReportPath");
  const applyReport = applyReportPath
    ? readJsonFile(resolve(cwd, applyReportPath), "apply report file is not valid JSON")
    : {};
  const sequenceReport = validatePlaybookLifecycleMutationPostApplySequence(sequence, {
    sequencePath,
    applyReport,
  });
  const report = validatePlaybookLifecycleMutationPostApplyEvidence(evidence, {
    evidencePath,
    sequenceReport,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMutationPostApplyEvidenceArgs(
    process.argv.slice(2),
  );
  const result = buildPlaybookLifecycleMutationPostApplyEvidenceCliResult(options);
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
