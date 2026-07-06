import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const RELEASE_HANDOFF_COMMAND = "release:handoff:check";
export const RELEASE_HANDOFF_CLAIM = "local_release_handoff_ready";

export const DEFAULT_RELEASE_HANDOFF_CHECKS = [
  {
    name: "release_hygiene_check",
    command: "npm run release:hygiene:check",
    bin: "npm",
    args: ["run", "release:hygiene:check", "--silent"],
  },
  {
    name: "delivery_ready_check",
    command: "npm run delivery:ready:check",
    bin: "npm",
    args: ["run", "delivery:ready:check", "--silent"],
  },
  {
    name: "controlled_runtime_tests",
    command: "npm run test:controlled-runtime",
    bin: "npm",
    args: ["run", "test:controlled-runtime", "--silent"],
  },
  {
    name: "core_workflow_tests",
    command: "npm run test:core-workflows",
    bin: "npm",
    args: ["run", "test:core-workflows", "--silent"],
  },
  {
    name: "lint",
    command: "npm run lint",
    bin: "npm",
    args: ["run", "lint", "--silent"],
  },
  {
    name: "build",
    command: "npm run build",
    bin: "npm",
    args: ["run", "build", "--silent"],
  },
  {
    name: "diff_check",
    command: "git diff --check",
    bin: "git",
    args: ["diff", "--check"],
  },
];

export function runReleaseHandoffSubprocess(check) {
  return spawnSync(check.bin, check.args, {
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

function evaluateCheck(check, rawResult, durationMs, excerptLength) {
  const exitCode =
    typeof rawResult?.status === "number" ? rawResult.status : 1;
  const base = {
    name: check.name,
    command: check.command,
    ok: exitCode === 0,
    exitCode,
    durationMs,
  };

  if (exitCode !== 0) {
    return {
      ...base,
      stdoutExcerpt: excerptText(rawResult?.stdout, excerptLength),
      stderrExcerpt: excerptText(rawResult?.stderr, excerptLength),
    };
  }

  return base;
}

export function buildReleaseHandoffReport({
  checks = DEFAULT_RELEASE_HANDOFF_CHECKS,
  runner = runReleaseHandoffSubprocess,
  now = () => Date.now(),
  excerptLength = 600,
} = {}) {
  const results = [];
  for (const check of checks) {
    const startedAt = now();
    const rawResult = runner(check);
    const durationMs = Math.max(0, now() - startedAt);
    const result = evaluateCheck(check, rawResult, durationMs, excerptLength);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.find((check) => !check.ok);
  const report = {
    ok: !failed,
    command: RELEASE_HANDOFF_COMMAND,
    productionReady: false,
    publishingPerformed: false,
    checks: results,
    knownWarnings: [
      "production readiness is not claimed by this gate",
      "no publishing, tagging, uploading, or installer packaging is performed",
      "release:hygiene:check owns warning-only secret pattern review details",
      "lint/build may report the existing <img> warning in ShellUI.test.tsx",
    ],
  };

  if (!failed) {
    report.releaseClaim = RELEASE_HANDOFF_CLAIM;
  } else {
    report.failedCheck = failed.name;
  }

  return {
    exitCode: failed ? 1 : 0,
    report,
  };
}

function main() {
  const result = buildReleaseHandoffReport();
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
