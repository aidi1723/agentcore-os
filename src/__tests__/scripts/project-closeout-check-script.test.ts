import { describe, expect, it } from "vitest";

import {
  PROJECT_CLOSEOUT_CHECK_COMMAND,
  buildProjectCloseoutCheckCliResult,
  parseProjectCloseoutCheckArgs,
} from "../../../scripts/project-closeout/check-project-closeout.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";

function cliResult(report, exitCode = report.ok ? 0 : 1) {
  return {
    exitCode,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function okGate(command, extra = {}) {
  return {
    ok: true,
    command,
    productionReady: false,
    publishingPerformed: false,
    findings: [],
    nextCommand: "npm run test:controlled-runtime",
    ...extra,
  };
}

describe("project closeout check script", () => {
  it("parses evidence, dry-run, now, current commit, and compact arguments", () => {
    expect(
      parseProjectCloseoutCheckArgs([
        "--evidence",
        evidencePath,
        "--dry-run",
        dryRunPath,
        "--now",
        "2026-07-07T03:00:00Z",
        "--current-commit",
        fullCommit,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      evidencePath,
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });
  });

  it("requires the evidence path", () => {
    expect(() =>
      parseProjectCloseoutCheckArgs(["--dry-run", dryRunPath]),
    ).toThrow("--evidence <path> is required");
  });

  it("requires the mutation dry-run path", () => {
    expect(() =>
      parseProjectCloseoutCheckArgs(["--evidence", evidencePath]),
    ).toThrow("--dry-run <path> is required");
  });

  it("builds a successful closeout report from injected green gates", () => {
    const result = buildProjectCloseoutCheckCliResult({
      evidencePath,
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
      buildControlAuditResult: () =>
        cliResult(okGate("playbook:control:audit", { auditOnly: true })),
      buildMaintenanceReadyResult: () =>
        cliResult(
          okGate("playbook:lifecycle:maintenance:ready", {
            readinessOnly: true,
            readyForLifecycleMaintenance: true,
          }),
        ),
      buildMutationDryRunResult: () =>
        cliResult(
          okGate("playbook:lifecycle:mutation:dry-run:check", {
            dryRunOnly: true,
            readyForLifecycleMutationDryRun: true,
          }),
        ),
      buildDeliveryReadyResult: () =>
        cliResult(
          okGate("delivery:ready:check", {
            releaseClaim: "local_delivery_demo_ready",
          }),
        ),
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PROJECT_CLOSEOUT_CHECK_COMMAND,
      status: "current_milestone_closeout_ready",
      productionReady: false,
      publishingPerformed: false,
      closeoutOnly: true,
      summary: {
        requiredGates: 4,
        greenGates: 4,
        deferredNextPhase: 6,
      },
    });
  });

  it("fails closed when an injected local gate fails", () => {
    const result = buildProjectCloseoutCheckCliResult({
      evidencePath,
      dryRunPath,
      pretty: false,
      buildControlAuditResult: () =>
        cliResult(okGate("playbook:control:audit", { auditOnly: true })),
      buildMaintenanceReadyResult: () =>
        cliResult(
          okGate("playbook:lifecycle:maintenance:ready", {
            ok: false,
            nextCommand: "npm run playbook:lifecycle:handoff",
          }),
          1,
        ),
      buildMutationDryRunResult: () =>
        cliResult(
          okGate("playbook:lifecycle:mutation:dry-run:check", {
            dryRunOnly: true,
            readyForLifecycleMutationDryRun: true,
          }),
        ),
      buildDeliveryReadyResult: () =>
        cliResult(
          okGate("delivery:ready:check", {
            releaseClaim: "local_delivery_demo_ready",
          }),
        ),
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "closeout_not_ready",
      findings: [
        expect.objectContaining({
          code: "local_gate_not_green",
          gate: "lifecycleMaintenanceReady",
        }),
      ],
      nextCommand: "npm run playbook:lifecycle:handoff",
    });
  });
});
