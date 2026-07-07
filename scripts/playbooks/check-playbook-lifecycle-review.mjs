import { pathToFileURL } from "node:url";

import {
  PLAYBOOK_LIFECYCLE_REVIEW_COMMAND,
  reviewControlledPlaybookLifecycle,
} from "@/lib/executor/playbooks/lifecycle-review";
import { listControlledPlaybooks } from "@/lib/executor/playbooks/catalog";

export { PLAYBOOK_LIFECYCLE_REVIEW_COMMAND };

export function parsePlaybookLifecycleReviewArgs(argv) {
  const options = {
    pretty: true,
    now: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    if (arg === "--now") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--now requires a YYYY-MM-DD value");
      }
      options.now = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function buildPlaybookLifecycleReviewCliResult(options = {}) {
  const report = reviewControlledPlaybookLifecycle({
    playbooks: listControlledPlaybooks(),
    now: options.now,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleReviewArgs(process.argv.slice(2));
  const result = buildPlaybookLifecycleReviewCliResult(options);
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
