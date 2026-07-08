import { describe, expect, it } from "vitest";
import {
  DEFAULT_RELEASE_HANDOFF_CHECKS,
  RELEASE_HANDOFF_CLAIM,
  RELEASE_HANDOFF_COMMAND,
  buildReleaseHandoffReport,
} from "../../../scripts/release-handoff/check-release-handoff.mjs";

describe("release handoff check script", () => {
  it("returns local handoff ready when all checks pass", () => {
    const seen: string[] = [];
    const result = buildReleaseHandoffReport({
      runner: (check) => {
        seen.push(check.name);
        return { status: 0, stdout: `${check.name} ok`, stderr: "" };
      },
    });

    expect(seen).toEqual(DEFAULT_RELEASE_HANDOFF_CHECKS.map((check) => check.name));
    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: RELEASE_HANDOFF_COMMAND,
        releaseClaim: RELEASE_HANDOFF_CLAIM,
        productionReady: false,
        publishingPerformed: false,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "release_hygiene_check", ok: true }),
          expect.objectContaining({
            name: "github_macos_cli_install_check",
            ok: true,
          }),
          expect.objectContaining({ name: "delivery_ready_check", ok: true }),
          expect.objectContaining({ name: "controlled_runtime_tests", ok: true }),
          expect.objectContaining({ name: "core_workflow_tests", ok: true }),
          expect.objectContaining({ name: "lint", ok: true }),
          expect.objectContaining({ name: "build", ok: true }),
          expect.objectContaining({ name: "diff_check", ok: true }),
        ]),
      },
    });
  });

  it("fails closed and stops after the first failing check", () => {
    const seen: string[] = [];
    const result = buildReleaseHandoffReport({
      runner: (check) => {
        seen.push(check.name);
        if (check.name === "controlled_runtime_tests") {
          return { status: 1, stdout: "test failure", stderr: "bad test" };
        }
        return { status: 0, stdout: "ok", stderr: "" };
      },
    });

    expect(seen).toEqual([
      "release_hygiene_check",
      "github_macos_cli_install_check",
      "delivery_ready_check",
      "controlled_runtime_tests",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      ok: false,
      productionReady: false,
      publishingPerformed: false,
      failedCheck: "controlled_runtime_tests",
    });
    expect(result.report).not.toHaveProperty("releaseClaim");
    expect(result.report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "controlled_runtime_tests",
          ok: false,
          exitCode: 1,
          stdoutExcerpt: "test failure",
          stderrExcerpt: "bad test",
        }),
      ]),
    );
  });

  it("records command strings and durations", () => {
    let now = 1_000;
    const result = buildReleaseHandoffReport({
      now: () => {
        now += 25;
        return now;
      },
      runner: () => ({ status: 0, stdout: "", stderr: "" }),
    });

    expect(result.report.checks[0]).toMatchObject({
      name: "release_hygiene_check",
      command: "npm run release:hygiene:check",
      durationMs: 25,
    });
    expect(result.report.checks.at(-1)).toMatchObject({
      name: "diff_check",
      command: "git diff --check",
    });
  });

  it("treats a missing numeric process status as failure", () => {
    const result = buildReleaseHandoffReport({
      runner: () => ({ status: null, stdout: "no status", stderr: "" }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.failedCheck).toBe("release_hygiene_check");
    expect(result.report.checks[0]).toMatchObject({
      ok: false,
      exitCode: 1,
    });
  });

  it("truncates failed stdout and stderr excerpts", () => {
    const longText = "x".repeat(700);
    const result = buildReleaseHandoffReport({
      excerptLength: 80,
      runner: () => ({ status: 1, stdout: longText, stderr: longText }),
    });

    const failed = result.report.checks[0];
    expect(failed.stdoutExcerpt.length).toBeLessThanOrEqual(80);
    expect(failed.stderrExcerpt.length).toBeLessThanOrEqual(80);
    expect(failed.stdoutExcerpt.endsWith("...")).toBe(true);
  });
});
