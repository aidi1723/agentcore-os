import { describe, expect, it } from "vitest";
import {
  RELEASE_HYGIENE_COMMAND,
  buildReleaseHygieneReport,
} from "../../../scripts/release-hygiene/check-release-hygiene.mjs";

const requiredDocs = [
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "docs/PRIVACY.md",
  "docs/LICENSE_CHANGE_NOTICE.md",
];

function buildFiles(overrides: Record<string, string | undefined> = {}) {
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ license: "GPL-3.0-or-later" }),
    "README.md":
      "Use npm run delivery:ready:check. Production readiness is not claimed.",
    "docs/PUBLIC_RELEASE.md":
      "Use npm run delivery:ready:check. The project is not production ready.",
    "docs/PUBLIC_RELEASE.zh-CN.md":
      "Use npm run delivery:ready:check。当前尚未宣称 production ready。",
    "docs/OPEN_SOURCE_CHECKLIST.md":
      "Use npm run delivery:ready:check before handoff.",
  };

  for (const path of requiredDocs) {
    files[path] ??= "present";
  }

  for (const [path, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete files[path];
    } else {
      files[path] = value;
    }
  }

  return files;
}

function buildRepo(
  overrides: {
    files?: Record<string, string | undefined>;
    trackedFiles?: string[];
  } = {},
) {
  const files = buildFiles(overrides.files);
  return {
    trackedFiles: overrides.trackedFiles ?? Object.keys(files),
    readTextFile: (path: string) => files[path],
  };
}

describe("release hygiene check script", () => {
  it("returns success when repository hygiene checks pass", () => {
    const result = buildReleaseHygieneReport(buildRepo());

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HYGIENE_COMMAND,
        productionReady: false,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "required_docs", ok: true }),
          expect.objectContaining({ name: "package_license", ok: true }),
          expect.objectContaining({ name: "tracked_artifact_paths", ok: true }),
          expect.objectContaining({ name: "public_release_docs", ok: true }),
        ]),
      },
    });
  });

  it("fails when a required public document is missing", () => {
    const result = buildReleaseHygieneReport(
      buildRepo({ files: { "SECURITY.md": undefined } }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("required_docs");
    expect(result.report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "required_docs",
          ok: false,
          missing: ["SECURITY.md"],
        }),
      ]),
    );
  });

  it("fails when package license is not GPL-3.0-or-later", () => {
    const result = buildReleaseHygieneReport(
      buildRepo({ files: { "package.json": JSON.stringify({ license: "MIT" }) } }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("package_license");
  });

  it("fails when blocked artifact paths are tracked", () => {
    const result = buildReleaseHygieneReport(
      buildRepo({ trackedFiles: ["README.md", "dist/app.js"] }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "tracked_artifact_paths",
          ok: false,
          blockedFiles: ["dist/app.js"],
        }),
      ]),
    );
  });

  it("fails when public release docs omit delivery:ready:check", () => {
    const result = buildReleaseHygieneReport(
      buildRepo({
        files: {
          "docs/PUBLIC_RELEASE.md":
            "The public release guide describes local demo readiness.",
        },
      }),
    );

    expect(result.exitCode).toBe(1);
    expect(result.report.failedChecks).toContain("public_release_docs");
    expect(result.report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "public_release_docs",
          ok: false,
          missingDeliveryReadyCheck: ["docs/PUBLIC_RELEASE.md"],
        }),
      ]),
    );
  });

  it("allows negative production-ready boundary wording but rejects positive claims", () => {
    const negative = buildReleaseHygieneReport(buildRepo());
    expect(negative.exitCode).toBe(0);

    const realPublicBoundaryPhrases = buildReleaseHygieneReport(
      buildRepo({
        files: {
          "docs/PUBLIC_RELEASE.md":
            "Use npm run delivery:ready:check. The current branch should not be described as production ready. The gate checks docs are avoiding positive production-ready claims.",
          "docs/PUBLIC_RELEASE.zh-CN.md":
            "Use npm run delivery:ready:check。该门禁检查公开发布文档是否避免正向 production ready 声明。- 不声明 **production ready**；\n\n公开仓库不应宣称：\n\n- production ready；\n\nproduction ready、真实 replay 和安装包默认分发仍不属于当前公开声明。",
        },
      }),
    );
    expect(realPublicBoundaryPhrases.exitCode).toBe(0);

    const positive = buildReleaseHygieneReport(
      buildRepo({
        files: {
          "docs/PUBLIC_RELEASE.md":
            "Use npm run delivery:ready:check. AgentCore OS is production ready.",
        },
      }),
    );

    expect(positive.exitCode).toBe(1);
    expect(positive.report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "public_release_docs",
          ok: false,
          positiveProductionClaims: ["docs/PUBLIC_RELEASE.md"],
        }),
      ]),
    );
  });

  it("reports secret pattern matches as warnings without failing the gate", () => {
    const result = buildReleaseHygieneReport(
      buildRepo({
        files: {
          "src/example.ts": "const token = process.env.EXAMPLE_TOKEN;",
        },
        trackedFiles: [...Object.keys(buildFiles()), "src/example.ts"],
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "secret_pattern_review",
          ok: false,
          matchCount: 2,
          files: [expect.objectContaining({ path: "src/example.ts" })],
        }),
      ]),
    );
  });
});
