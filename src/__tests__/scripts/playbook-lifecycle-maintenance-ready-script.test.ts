import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MAINTENANCE_READY_COMMAND,
  buildPlaybookLifecycleMaintenanceReadyCliResult,
  parsePlaybookLifecycleMaintenanceReadyArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-maintenance-ready.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";

function handoffResult(ok = true) {
  const report = {
    ok,
    command: "playbook:lifecycle:handoff",
    readyForLifecycleHandoff: ok,
    productionReady: false,
    publishingPerformed: false,
    handoffOnly: true,
    summary: {
      findings: ok ? 0 : 1,
    },
    findings: ok
      ? []
      : [
          {
            code: "lifecycle_review_not_green",
            severity: "error",
            message: "Lifecycle review is not green.",
          },
        ],
    nextCommand: ok
      ? "npm run trace:fixtures --silent"
      : "npm run playbook:lifecycle:review",
  };

  return {
    exitCode: ok ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function doctorResult(status = "fresh_evidence") {
  const ok = status === "fresh_evidence";
  const report = {
    ok,
    command: "playbook:lifecycle:sequence:evidence:doctor",
    evidencePath,
    productionReady: false,
    publishingPerformed: false,
    diagnosticOnly: true,
    status,
    severity: ok ? "info" : "error",
    nextCommand: ok
      ? `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence ${evidencePath}`
      : `npm run playbook:lifecycle:sequence:evidence:check -- --evidence ${evidencePath}`,
  };

  return {
    exitCode: ok ? 0 : 1,
    report,
  };
}

describe("playbook lifecycle maintenance ready script", () => {
  it("parses evidence, compact, now, and current commit arguments", () => {
    expect(
      parsePlaybookLifecycleMaintenanceReadyArgs([
        "--evidence",
        evidencePath,
        "--now",
        "2026-07-07T03:00:00Z",
        "--current-commit",
        fullCommit,
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });
  });

  it("requires an evidence path", () => {
    expect(() => parsePlaybookLifecycleMaintenanceReadyArgs([])).toThrow(
      "--evidence <path> is required",
    );
  });

  it("builds a successful readiness result for the current catalog and example evidence", () => {
    const result = buildPlaybookLifecycleMaintenanceReadyCliResult({
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MAINTENANCE_READY_COMMAND,
      readyForLifecycleMaintenance: true,
      status: "ready_for_lifecycle_maintenance",
      productionReady: false,
      publishingPerformed: false,
      readinessOnly: true,
      checks: {
        lifecycleHandoff: {
          ok: true,
        },
        sequenceEvidenceDoctor: {
          ok: true,
          status: "fresh_evidence",
        },
      },
      findings: [],
      nextCommand: "npm run trace:fixtures --silent",
    });
  });

  it("fails closed when lifecycle handoff is not ready", () => {
    const result = buildPlaybookLifecycleMaintenanceReadyCliResult({
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      buildHandoffResult: () => handoffResult(false),
      buildDoctorResult: () => doctorResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      readyForLifecycleMaintenance: false,
      status: "handoff_not_ready",
      findings: [
        {
          code: "lifecycle_handoff_not_ready",
          severity: "error",
        },
      ],
      nextCommand: "npm run playbook:lifecycle:handoff",
    });
  });

  it("fails closed when sequence evidence doctor is not fresh", () => {
    const result = buildPlaybookLifecycleMaintenanceReadyCliResult({
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      buildHandoffResult: () => handoffResult(),
      buildDoctorResult: () => doctorResult("stale_evidence"),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      readyForLifecycleMaintenance: false,
      status: "evidence_not_ready",
      findings: [
        {
          code: "sequence_evidence_not_ready",
          severity: "error",
          status: "stale_evidence",
        },
      ],
      nextCommand:
        `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence ${evidencePath}`,
    });
  });

  it("fails closed when both handoff and sequence evidence are not ready", () => {
    const result = buildPlaybookLifecycleMaintenanceReadyCliResult({
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      buildHandoffResult: () => handoffResult(false),
      buildDoctorResult: () => doctorResult("source_commit_mismatch"),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      readyForLifecycleMaintenance: false,
      status: "maintenance_not_ready",
      summary: {
        findings: 2,
      },
    });
  });
});
