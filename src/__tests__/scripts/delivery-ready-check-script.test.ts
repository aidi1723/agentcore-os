import { describe, expect, it } from "vitest";
import {
  buildDeliveryReadyReport,
  DELIVERY_READY_RELEASE_CLAIM,
} from "../../../scripts/delivery-ready/check-delivery-ready.mjs";

describe("delivery ready check script", () => {
  it("returns local delivery demo ready when all checks pass", () => {
    const result = buildDeliveryReadyReport({
      runner: (check) => ({
        status: 0,
        stdout:
          check.name === "delivery_demo_check"
            ? JSON.stringify({ ok: true, diagnostics: [] })
            : "ok",
        stderr: "",
      }),
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: "delivery:ready:check",
        releaseClaim: DELIVERY_READY_RELEASE_CLAIM,
        productionReady: false,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "delivery_demo_check", ok: true }),
          expect.objectContaining({ name: "trace_fixtures_report", ok: true }),
          expect.objectContaining({ name: "trace_fixtures_summary", ok: true }),
          expect.objectContaining({ name: "trace_retention_preview", ok: true }),
        ]),
      },
    });
  });

  it("fails closed when a check exits non-zero", () => {
    const result = buildDeliveryReadyReport({
      runner: (check) =>
        check.name === "trace_fixtures_report"
          ? { status: 1, stdout: "fixture failure", stderr: "bad fixture" }
          : { status: 0, stdout: "{\"ok\":true}", stderr: "" },
    });

    expect(result.exitCode).toBe(1);
    expect(result.report).toMatchObject({
      ok: false,
      productionReady: false,
      failedCheck: "trace_fixtures_report",
    });
    expect(result.report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "trace_fixtures_report",
          ok: false,
          exitCode: 1,
          stdoutExcerpt: "fixture failure",
          stderrExcerpt: "bad fixture",
        }),
      ]),
    );
  });

  it("rejects delivery demo JSON with ok false even when the process exits zero", () => {
    const result = buildDeliveryReadyReport({
      runner: (check) => ({
        status: 0,
        stdout:
          check.name === "delivery_demo_check"
            ? JSON.stringify({ ok: false, diagnostics: ["missing draft"] })
            : "ok",
        stderr: "",
      }),
    });

    expect(result.exitCode).toBe(1);
    expect(result.report.failedCheck).toBe("delivery_demo_check");
    expect(result.report.checks[0]).toMatchObject({
      ok: false,
      validationError: "delivery demo check returned ok=false",
    });
  });

  it("truncates failed check stdout and stderr excerpts", () => {
    const longText = "x".repeat(700);
    const result = buildDeliveryReadyReport({
      excerptLength: 80,
      runner: () => ({ status: 1, stdout: longText, stderr: longText }),
    });

    const failed = result.report.checks[0];
    expect(failed.stdoutExcerpt.length).toBeLessThanOrEqual(80);
    expect(failed.stderrExcerpt.length).toBeLessThanOrEqual(80);
    expect(failed.stdoutExcerpt.endsWith("...")).toBe(true);
  });
});
