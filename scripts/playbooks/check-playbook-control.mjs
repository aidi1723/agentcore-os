import { pathToFileURL } from "node:url";

import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { buildControlledTraceFixtureCatalogReport } from "@/__tests__/fixtures/controlled-traces/catalog-report";
import { auditControlledPlaybookCatalog } from "@/lib/executor/playbooks/control-audit";
import { listControlledPlaybooks } from "@/lib/executor/playbooks/catalog";

export const PLAYBOOK_CONTROL_AUDIT_COMMAND = "playbook:control:audit";

export function parsePlaybookControlAuditArgs(argv) {
  const options = {
    pretty: true,
  };

  for (const arg of argv) {
    if (arg === "--compact") {
      options.pretty = false;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function buildPlaybookControlAuditCliResult(options = {}) {
  const report = auditControlledPlaybookCatalog({
    playbooks: listControlledPlaybooks(),
    fixtureCatalog: controlledTraceFixtureCatalog.map((entry) => ({
      id: entry.id,
      playbookId: entry.playbookId,
    })),
    fixtureCatalogReport: buildControlledTraceFixtureCatalogReport(),
  });

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report, null, options.pretty === false ? 0 : 2)}\n`,
  };
}

function main() {
  const options = parsePlaybookControlAuditArgs(process.argv.slice(2));
  const result = buildPlaybookControlAuditCliResult(options);
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
