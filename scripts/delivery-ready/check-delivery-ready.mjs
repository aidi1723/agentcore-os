import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DELIVERY_READY_RELEASE_CLAIM = "local_delivery_demo_ready";

export const DEFAULT_DELIVERY_READY_CHECKS = [
  {
    name: "delivery_demo_check",
    command: "npm run delivery:demo:check",
    args: ["run", "delivery:demo:check", "--silent"],
    parseJson: true,
    requireOk: true,
  },
  {
    name: "trace_fixtures_report",
    command: "npm run trace:fixtures --silent",
    args: ["run", "trace:fixtures", "--silent"],
  },
  {
    name: "trace_fixtures_summary",
    command: "npm run trace:fixtures:summary --silent",
    args: ["run", "trace:fixtures:summary", "--silent"],
  },
  {
    name: "trace_retention_preview",
    command:
      "npm run trace:retention:preview -- --max-age-days 30 --min-terminal-runs 20",
    args: [
      "run",
      "trace:retention:preview",
      "--silent",
      "--",
      "--max-age-days",
      "30",
      "--min-terminal-runs",
      "20",
    ],
  },
];

export function runDeliveryReadySubprocess(check) {
  return spawnSync("npm", check.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function excerptText(value, maxLength = 600) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function parseJsonOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function evaluateCheck(check, rawResult, excerptLength) {
  const exitCode = typeof rawResult?.status === "number" ? rawResult.status : 1;
  const base = {
    name: check.name,
    command: check.command,
    ok: exitCode === 0,
    exitCode,
  };

  if (check.parseJson || check.requireOk) {
    const parsed = parseJsonOutput(rawResult?.stdout);
    if (!parsed) {
      return {
        ...base,
        ok: false,
        validationError: "check stdout was not valid JSON",
        stdoutExcerpt: excerptText(rawResult?.stdout, excerptLength),
        stderrExcerpt: excerptText(rawResult?.stderr, excerptLength),
      };
    }
    if (check.requireOk && parsed.ok !== true) {
      return {
        ...base,
        ok: false,
        validationError: "delivery demo check returned ok=false",
        diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
        stdoutExcerpt: excerptText(rawResult?.stdout, excerptLength),
        stderrExcerpt: excerptText(rawResult?.stderr, excerptLength),
      };
    }
  }

  if (exitCode !== 0) {
    return {
      ...base,
      ok: false,
      stdoutExcerpt: excerptText(rawResult?.stdout, excerptLength),
      stderrExcerpt: excerptText(rawResult?.stderr, excerptLength),
    };
  }

  return base;
}

export function buildDeliveryReadyReport({
  checks = DEFAULT_DELIVERY_READY_CHECKS,
  runner = runDeliveryReadySubprocess,
  excerptLength = 600,
} = {}) {
  const results = [];
  for (const check of checks) {
    const rawResult = runner(check);
    const result = evaluateCheck(check, rawResult, excerptLength);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.find((check) => !check.ok);
  const report = {
    ok: !failed,
    command: "delivery:ready:check",
    releaseClaim: DELIVERY_READY_RELEASE_CLAIM,
    productionReady: false,
    checks: results,
    knownWarnings: [
      "production readiness is not claimed by this gate",
      "browser smoke remains a manual evidence step",
      "full regression, lint, and build gates remain separate verification steps",
    ],
  };

  if (failed) {
    report.failedCheck = failed.name;
  }

  return {
    exitCode: failed ? 1 : 0,
    report,
  };
}

function main() {
  const result = buildDeliveryReadyReport();
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
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
