import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validatePlaybookLifecycleChangeProposal } from "@/lib/executor/playbooks/lifecycle-change-proposal";
import {
  PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND,
  validatePlaybookLifecycleMigrationPlan,
} from "@/lib/executor/playbooks/lifecycle-migration-plan";

export { PLAYBOOK_LIFECYCLE_MIGRATION_PLAN_COMMAND };

export function parsePlaybookLifecycleMigrationPlanArgs(argv) {
  const options = {
    pretty: true,
    planPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--plan") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--plan requires a path value");
      }
      options.planPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.planPath) {
    throw new Error("--plan <path> is required");
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

function getProposalPath(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return "";
  return typeof plan.proposalPath === "string" ? plan.proposalPath : "";
}

export function buildPlaybookLifecycleMigrationPlanCliResult(options) {
  const cwd = options.cwd ?? process.cwd();
  const planPath = options.planPath;
  const plan = readJsonFile(
    resolve(cwd, planPath),
    "migration plan file is not valid JSON",
  );
  const proposalPath = getProposalPath(plan);
  const proposal = proposalPath
    ? readJsonFile(resolve(cwd, proposalPath), "proposal file is not valid JSON")
    : {};
  const proposalReport = validatePlaybookLifecycleChangeProposal(proposal, {
    proposalPath,
    fileExists: (path) => existsSync(resolve(cwd, path)),
  });
  const report = validatePlaybookLifecycleMigrationPlan(plan, {
    planPath,
    proposalReport,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleMigrationPlanArgs(process.argv.slice(2));
  const result = buildPlaybookLifecycleMigrationPlanCliResult(options);
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
