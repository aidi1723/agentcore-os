import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  ARTIFACT_UPLOAD_GATE_CHECK_COMMAND,
  validateArtifactUploadExecutionGate,
} from "@/lib/executor/playbooks/artifact-upload-execution-gate";

import {
  buildTagCreationGateCheckCliResult,
} from "./check-tag-creation-gate.mjs";

export { ARTIFACT_UPLOAD_GATE_CHECK_COMMAND };

function readOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseArtifactUploadGateCheckArgs(argv) {
  const options = {
    gatePath: undefined,
    pretty: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--gate") {
      options.gatePath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.gatePath) {
    throw new Error("--gate <path> is required");
  }

  return options;
}

function readTextFile(path) {
  return readFileSync(path, "utf8");
}

function readJsonFile(path, invalidMessage) {
  try {
    return JSON.parse(readTextFile(path));
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

function parseCliJsonResult(result) {
  return JSON.parse(result.stdout);
}

export function buildArtifactUploadGateCheckCliResult(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const gatePath = options.gatePath;
  const gate = readJsonFile(
    resolve(cwd, gatePath),
    "artifact upload gate file is not valid JSON",
  );
  const tagCreationGatePath = getStringField(gate, "tagCreationGatePath");

  const tagCreationGateResult = tagCreationGatePath
    ? (options.buildTagCreationGateResult ??
        buildTagCreationGateCheckCliResult)({
        cwd,
        gatePath: tagCreationGatePath,
        pretty: false,
      })
    : {
        stdout: "{}",
      };

  const report = validateArtifactUploadExecutionGate(gate, {
    gatePath,
    tagCreationGateReport: parseCliJsonResult(tagCreationGateResult),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parseArtifactUploadGateCheckArgs(process.argv.slice(2));
  const result = buildArtifactUploadGateCheckCliResult(options);
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
