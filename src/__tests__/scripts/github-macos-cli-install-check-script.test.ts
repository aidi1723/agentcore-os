import { describe, expect, it } from "vitest";
import {
  GITHUB_MACOS_CLI_INSTALL_COMMAND,
  buildGitHubMacOSCliInstallReport,
} from "../../../scripts/release-hygiene/check-github-macos-cli-install.mjs";

const canonicalDoc = `
# GitHub macOS CLI Install

## Requirements

- macOS 13 or newer
- Git
- Node.js 22 LTS
- npm

## Install

\`\`\`bash
git clone https://github.com/aidi1723/agentcore-os.git
cd agentcore-os
npm install
npm run dev
\`\`\`

Open http://localhost:3000/.
`;

function buildFiles(overrides: Record<string, string | undefined> = {}) {
  const files: Record<string, string> = {
    "README.md":
      "Current install path: docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md with git clone https://github.com/aidi1723/agentcore-os.git",
    "docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md": canonicalDoc,
    "docs/COMMAND_LINE_INSTALL.zh-CN.md":
      "Use docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md as the canonical current install path.",
    "docs/PUBLIC_RELEASE.zh-CN.md":
      "Current install path: docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md",
    "docs/EARLY_ACCESS_RELEASE.zh-CN.md":
      "Current install path: docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md",
  };

  for (const [path, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete files[path];
    } else {
      files[path] = value;
    }
  }

  return files;
}

function buildRepo(overrides: Record<string, string | undefined> = {}) {
  const files = buildFiles(overrides);
  return {
    readTextFile: (path: string) => files[path],
  };
}

describe("GitHub macOS CLI install check script", () => {
  it("passes when the canonical GitHub macOS CLI install path is documented", () => {
    const result = buildGitHubMacOSCliInstallReport(buildRepo());

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: GITHUB_MACOS_CLI_INSTALL_COMMAND,
        installClaim: "github_macos_cli_install_path_defined",
        platform: "macOS",
        source: "GitHub",
        installOnly: true,
        productionReady: false,
        publishingPerformed: false,
      },
    });
  });

  it("fails when the canonical install doc is missing", () => {
    const result = buildGitHubMacOSCliInstallReport(
      buildRepo({ "docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md": undefined }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("required_docs");
  });

  it("fails when the canonical doc omits the GitHub clone command", () => {
    const result = buildGitHubMacOSCliInstallReport(
      buildRepo({
        "docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md": canonicalDoc.replace(
          "git clone https://github.com/aidi1723/agentcore-os.git",
          "git clone https://example.com/agentcore-os.git",
        ),
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("canonical_install_commands");
  });

  it("fails when the canonical doc includes non-scope install alternatives", () => {
    const result = buildGitHubMacOSCliInstallReport(
      buildRepo({
        "docs/GITHUB_MACOS_CLI_INSTALL.zh-CN.md": `${canonicalDoc}\nCNB mirror and Windows EXE are also available.`,
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("canonical_scope_boundary");
  });

  it("fails when entry docs do not link to the canonical install path", () => {
    const result = buildGitHubMacOSCliInstallReport(
      buildRepo({
        "docs/PUBLIC_RELEASE.zh-CN.md": "Use command-line install.",
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("entry_doc_alignment");
  });
});
