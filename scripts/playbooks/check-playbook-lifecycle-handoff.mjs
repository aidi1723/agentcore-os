import { pathToFileURL } from "node:url";

import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { auditControlledPlaybookCatalog } from "@/lib/executor/playbooks/control-audit";
import {
  PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND,
  buildPlaybookLifecycleHandoffChecklist,
} from "@/lib/executor/playbooks/lifecycle-handoff";
import { reviewControlledPlaybookLifecycle } from "@/lib/executor/playbooks/lifecycle-review";
import { listControlledPlaybooks } from "@/lib/executor/playbooks/catalog";

export { PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND };

export function parsePlaybookLifecycleHandoffArgs(argv) {
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

export function buildPlaybookLifecycleHandoffCliResult(options = {}) {
  const playbooks = listControlledPlaybooks();
  const controlAudit = auditControlledPlaybookCatalog({
    playbooks,
    fixtureCatalog: controlledTraceFixtureCatalog.map((entry) => ({
      id: entry.id,
      playbookId: entry.playbookId,
    })),
    fixtureCatalogReport: buildControlledTraceFixtureCatalogReport(),
  });
  const lifecycleReview = reviewControlledPlaybookLifecycle({
    playbooks,
    now: options.now,
  });
  const report = buildPlaybookLifecycleHandoffChecklist({
    controlAudit,
    lifecycleReview,
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookLifecycleHandoffArgs(process.argv.slice(2));
  const result = buildPlaybookLifecycleHandoffCliResult(options);
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
