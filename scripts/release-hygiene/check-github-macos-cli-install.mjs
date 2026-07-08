import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const GITHUB_MACOS_CLI_INSTALL_COMMAND =
  "release:github-macos-cli:check";
export const GITHUB_MACOS_CLI_INSTALL_CLAIM =
  "github_macos_cli_install_path_defined";

export const CANONICAL_INSTALL_DOC =
  "docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md";

export const REQUIRED_INSTALL_DOCS = [
  "README.md",
  CANONICAL_INSTALL_DOC,
  "docs/COMMAND_LINE_INSTALL.zh-CN.md",
  "docs/PUBLIC_RELEASE.zh-CN.md",
  "docs/EARLY_ACCESS_RELEASE.zh-CN.md",
];

export const ENTRY_DOCS = [
  "README.md",
  "docs/COMMAND_LINE_INSTALL.zh-CN.md",
  "docs/PUBLIC_RELEASE.zh-CN.md",
  "docs/EARLY_ACCESS_RELEASE.zh-CN.md",
];

export const REQUIRED_CANONICAL_COMMANDS = [
  "git clone https://github.com/aidi1723/agentcore-os.git",
  "cd agentcore-os",
  "npm install",
  "npm run dev",
];

export const REQUIRED_CANONICAL_TERMS = [
  "macOS",
  "Git",
  "Node.js 22 LTS",
  "npm",
  "http://localhost:3000/",
];

export const BLOCKED_CANONICAL_SCOPE_TERMS = [
  "CNB",
  "Windows",
  "DMG",
  "EXE",
  "Docker",
  "GitHub Releases",
  "desktop:package",
  "desktop:smoke-test-sidecar",
  "desktop_light",
  "desktop_dify",
  "Tauri",
  "sidecar",
];

export function readRepositoryTextFile(path) {
  return readFileSync(path, "utf8");
}

export function buildRealRepositorySource() {
  return {
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
  const missing = REQUIRED_INSTALL_DOCS.filter(
    (path) => readOptional(repo, path) === undefined,
  );
  return {
    name: "required_docs",
    ok: missing.length === 0,
    required: REQUIRED_INSTALL_DOCS,
    ...(missing.length > 0 ? { missing } : {}),
  };
}

function evaluateCanonicalInstallCommands(repo) {
  const text = readOptional(repo, CANONICAL_INSTALL_DOC) ?? "";
  const missingCommands = REQUIRED_CANONICAL_COMMANDS.filter(
    (command) => !text.includes(command),
  );
  const missingTerms = REQUIRED_CANONICAL_TERMS.filter(
    (term) => !text.includes(term),
  );
  return {
    name: "canonical_install_commands",
    ok: missingCommands.length === 0 && missingTerms.length === 0,
    doc: CANONICAL_INSTALL_DOC,
    requiredCommands: REQUIRED_CANONICAL_COMMANDS,
    requiredTerms: REQUIRED_CANONICAL_TERMS,
    ...(missingCommands.length > 0 ? { missingCommands } : {}),
    ...(missingTerms.length > 0 ? { missingTerms } : {}),
  };
}

function findBlockedScopeTerms(text) {
  return BLOCKED_CANONICAL_SCOPE_TERMS.filter((term) =>
    String(text).toLowerCase().includes(term.toLowerCase()),
  );
}

function evaluateCanonicalScopeBoundary(repo) {
  const text = readOptional(repo, CANONICAL_INSTALL_DOC) ?? "";
  const blockedTerms = findBlockedScopeTerms(text);
  return {
    name: "canonical_scope_boundary",
    ok: blockedTerms.length === 0,
    doc: CANONICAL_INSTALL_DOC,
    blockedTerms: BLOCKED_CANONICAL_SCOPE_TERMS,
    ...(blockedTerms.length > 0 ? { foundBlockedTerms: blockedTerms } : {}),
  };
}

function evaluateEntryDocAlignment(repo) {
  const missingDocs = [];
  const missingCanonicalLinks = [];

  for (const path of ENTRY_DOCS) {
    const text = readOptional(repo, path);
    if (text === undefined) {
      missingDocs.push(path);
      continue;
    }
    if (!text.includes(CANONICAL_INSTALL_DOC)) {
      missingCanonicalLinks.push(path);
    }
  }

  return {
    name: "entry_doc_alignment",
    ok: missingDocs.length === 0 && missingCanonicalLinks.length === 0,
    docs: ENTRY_DOCS,
    canonicalDoc: CANONICAL_INSTALL_DOC,
    ...(missingDocs.length > 0 ? { missingDocs } : {}),
    ...(missingCanonicalLinks.length > 0 ? { missingCanonicalLinks } : {}),
  };
}

export function buildGitHubMacOSCliInstallReport(
  repo = buildRealRepositorySource(),
) {
  const checks = [
    evaluateRequiredDocs(repo),
    evaluateCanonicalInstallCommands(repo),
    evaluateCanonicalScopeBoundary(repo),
    evaluateEntryDocAlignment(repo),
  ];
  const failedChecks = checks
    .filter((check) => !check.ok)
    .map((check) => check.name);

  const report = {
    ok: failedChecks.length === 0,
    command: GITHUB_MACOS_CLI_INSTALL_COMMAND,
    platform: "macOS",
    source: "GitHub",
    installOnly: true,
    productionReady: false,
    publishingPerformed: false,
    checks,
    knownLimitations: [
      "this gate checks documentation contract only and does not clone, install, or start the app",
      "this gate covers only the GitHub macOS command-line install path",
      "no package build, tag, artifact upload, deployment, external write, credential use, or production verification is performed",
    ],
    ...(failedChecks.length > 0 ? { failedChecks } : {}),
  };

  if (failedChecks.length === 0) {
    report.installClaim = GITHUB_MACOS_CLI_INSTALL_CLAIM;
  }

  return {
    exitCode: failedChecks.length > 0 ? 1 : 0,
    report,
  };
}

function main() {
  const result = buildGitHubMacOSCliInstallReport();
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
