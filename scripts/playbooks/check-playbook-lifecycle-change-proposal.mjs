import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND,
  validatePlaybookLifecycleChangeProposal,
} from "@/lib/executor/playbooks/lifecycle-change-proposal";

export { PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND };

export function parsePlaybookLifecycleChangeProposalArgs(argv) {
  const options = {
    pretty: true,
    proposalPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--proposal") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--proposal requires a path value");
      }
      options.proposalPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!options.proposalPath) {
    throw new Error("--proposal <path> is required");
  }

  return options;
}

export function buildPlaybookLifecycleChangeProposalCliResult(options) {
  const cwd = options.cwd ?? process.cwd();
  const proposalPath = options.proposalPath;
  const absoluteProposalPath = resolve(cwd, proposalPath);
  let proposal;

  try {
    proposal = JSON.parse(readFileSync(absoluteProposalPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("proposal file is not valid JSON");
    }
    throw error;
  }

  const report = validatePlaybookLifecycleChangeProposal(proposal, {
    proposalPath,
    fileExists: (path) => existsSync(resolve(cwd, path)),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleChangeProposalArgs(process.argv.slice(2));
  const result = buildPlaybookLifecycleChangeProposalCliResult(options);
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
