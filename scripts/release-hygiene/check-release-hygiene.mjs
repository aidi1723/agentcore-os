import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RELEASE_HYGIENE_COMMAND = "release:hygiene:check";

export const REQUIRED_PUBLIC_DOCS = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/PRIVACY.md",
  "docs/LICENSE_CHANGE_NOTICE.md",
];

export const BLOCKED_TRACKED_PATH_PREFIXES = [
  "node_modules/",
  ".next/",
  ".next-dev/",
  ".webhook-connector/",
  "dist/",
  "build/",
  ".openclaw-data/",
];

export const PUBLIC_RELEASE_DOCS = [
  "README.md",
  "docs/PUBLIC_RELEASE.md",
  "docs/PUBLIC_RELEASE.zh-CN.md",
  "docs/OPEN_SOURCE_CHECKLIST.md",
];

export const SECRET_REVIEW_PATTERNS = [
  "apiKey",
  "token",
  "Authorization",
  "Bearer",
  "secret",
  "password",
];

export function listTrackedFiles() {
  const result = spawnSync("git", ["ls-files"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || "git ls-files failed");
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function readRepositoryTextFile(path) {
  return readFileSync(path, "utf8");
}

export function buildRealRepositorySource() {
  return {
    trackedFiles: listTrackedFiles(),
    readTextFile: readRepositoryTextFile,
  };
}

function readOptional(repo, path) {
  try {
    const value = repo.readTextFile(path);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function evaluateRequiredDocs(repo) {
  const missing = REQUIRED_PUBLIC_DOCS.filter(
    (path) => readOptional(repo, path) === undefined,
  );
  return {
    name: "required_docs",
    ok: missing.length === 0,
    required: REQUIRED_PUBLIC_DOCS,
    ...(missing.length > 0 ? { missing } : {}),
  };
}

function evaluatePackageLicense(repo) {
  const raw = readOptional(repo, "package.json");
  if (raw === undefined) {
    return {
      name: "package_license",
      ok: false,
      error: "package.json is missing",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      name: "package_license",
      ok: parsed.license === "GPL-3.0-or-later",
      expected: "GPL-3.0-or-later",
      actual: parsed.license ?? null,
    };
  } catch {
    return {
      name: "package_license",
      ok: false,
      error: "package.json is not valid JSON",
    };
  }
}

function evaluateTrackedArtifacts(repo) {
  const blockedFiles = repo.trackedFiles.filter((file) =>
    BLOCKED_TRACKED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );

  return {
    name: "tracked_artifact_paths",
    ok: blockedFiles.length === 0,
    blockedPrefixes: BLOCKED_TRACKED_PATH_PREFIXES,
    ...(blockedFiles.length > 0 ? { blockedFiles } : {}),
  };
}

function splitSentences(text) {
  return String(text)
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasAllowedNegativeProductionBoundary(sentence) {
  const plain = sentence.replace(/[*_`]/g, "");
  const lower = plain.toLowerCase();
  return (
    lower.includes("not production ready") ||
    lower.includes("not production-ready") ||
    lower.includes("production readiness is not claimed") ||
    lower.includes("should not be described as production ready") ||
    lower.includes("must not be described as production ready") ||
    lower.includes("not claim production readiness") ||
    lower.includes("does not claim production readiness") ||
    lower.includes("should not claim") ||
    lower.includes("must not claim") ||
    lower.includes("avoid positive production-ready claims") ||
    lower.includes("avoiding positive production-ready claims") ||
    lower.includes("avoid positive production ready claims") ||
    lower.includes("avoiding positive production ready claims") ||
    lower.includes("outside the current release claim") ||
    lower.includes("outside the current release boundary") ||
    lower.includes("out of scope") ||
    plain.includes("尚未宣称 production ready") ||
    plain.includes("不应宣称") ||
    plain.includes("不宣称 production ready") ||
    plain.includes("不声明 production ready") ||
    plain.includes("避免正向 production ready 声明") ||
    plain.includes("不属于当前公开声明") ||
    plain.includes("不等于生产可用") ||
    plain.includes("不是生产可用")
  );
}

function isNegativeProductionClaimListItem(sentence, fullText) {
  const normalized = sentence
    .trim()
    .replace(/^[-*]\s*/, "")
    .replace(/[；;。.]$/u, "")
    .trim()
    .toLowerCase();
  return (
    normalized === "production ready" &&
    (fullText.includes("不应宣称") ||
      fullText.toLowerCase().includes("should not claim"))
  );
}

function hasPositiveProductionClaim(text) {
  const fullText = String(text);
  return splitSentences(text).some((sentence) => {
    const lower = sentence.toLowerCase();
    const hasClaim =
      lower.includes("production ready") ||
      lower.includes("production-ready") ||
      sentence.includes("生产可用") ||
      sentence.includes("生产就绪");
    return (
      hasClaim &&
      !hasAllowedNegativeProductionBoundary(sentence) &&
      !isNegativeProductionClaimListItem(sentence, fullText)
    );
  });
}

function evaluatePublicReleaseDocs(repo) {
  const missingDocs = [];
  const missingDeliveryReadyCheck = [];
  const positiveProductionClaims = [];

  for (const path of PUBLIC_RELEASE_DOCS) {
    const text = readOptional(repo, path);
    if (text === undefined) {
      missingDocs.push(path);
      continue;
    }
    if (!text.includes("delivery:ready:check")) {
      missingDeliveryReadyCheck.push(path);
    }
    if (hasPositiveProductionClaim(text)) {
      positiveProductionClaims.push(path);
    }
  }

  return {
    name: "public_release_docs",
    ok:
      missingDocs.length === 0 &&
      missingDeliveryReadyCheck.length === 0 &&
      positiveProductionClaims.length === 0,
    docs: PUBLIC_RELEASE_DOCS,
    ...(missingDocs.length > 0 ? { missingDocs } : {}),
    ...(missingDeliveryReadyCheck.length > 0 ? { missingDeliveryReadyCheck } : {}),
    ...(positiveProductionClaims.length > 0 ? { positiveProductionClaims } : {}),
  };
}

function countSecretPatternMatches(text) {
  let count = 0;
  for (const pattern of SECRET_REVIEW_PATTERNS) {
    const matcher = new RegExp(pattern, "gi");
    count += Array.from(String(text).matchAll(matcher)).length;
  }
  return count;
}

function evaluateSecretPatternReview(repo) {
  const files = [];
  const skipped = [];

  for (const path of repo.trackedFiles) {
    const text = readOptional(repo, path);
    if (text === undefined) {
      skipped.push(path);
      continue;
    }

    const matches = countSecretPatternMatches(text);
    if (matches > 0) {
      files.push({ path, matches });
    }
  }

  const matchCount = files.reduce((sum, file) => sum + file.matches, 0);
  return {
    name: "secret_pattern_review",
    ok: matchCount === 0,
    severity: "warning",
    matchCount,
    files,
    ...(skipped.length > 0 ? { skipped } : {}),
  };
}

export function buildReleaseHygieneReport(repo = buildRealRepositorySource()) {
  const checks = [
    evaluateRequiredDocs(repo),
    evaluatePackageLicense(repo),
    evaluateTrackedArtifacts(repo),
    evaluatePublicReleaseDocs(repo),
  ];
  const warnings = [evaluateSecretPatternReview(repo)];
  const failedChecks = checks
    .filter((check) => !check.ok)
    .map((check) => check.name);
  const report = {
    ok: failedChecks.length === 0,
    command: RELEASE_HYGIENE_COMMAND,
    productionReady: false,
    checks,
    warnings,
    knownLimitations: [
      "secret pattern review is warning-only and requires human review",
      "this gate checks tracked files only and does not scan git history",
      "this gate complements delivery:ready:check and does not claim production readiness",
    ],
    ...(failedChecks.length > 0 ? { failedChecks } : {}),
  };

  return {
    exitCode: failedChecks.length > 0 ? 1 : 0,
    report,
  };
}

function main() {
  const result = buildReleaseHygieneReport();
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
