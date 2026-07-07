import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_DOCTOR_COMMAND,
  doctorPlaybookLifecycleSequenceEvidence,
  parsePlaybookLifecycleSequenceEvidenceDoctorArgs,
} from "../../../scripts/playbooks/doctor-playbook-lifecycle-sequence-evidence.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";

function buildFreshnessResult(findingCode?: string) {
  const report = {
    ok: !findingCode,
    command: "playbook:lifecycle:sequence:evidence:freshness:check",
    productionReady: false,
    publishingPerformed: false,
    freshnessOnly: true,
    evidencePath,
    evidence: {
      evidenceId: "example-sales-pipeline-v1-review-evidence",
      owner: "agentcore-runtime-maintainers",
      sequencePath:
        "docs/playbook-lifecycle-maintenance-sequences/example-version-update-sequence.json",
    },
    checks: {
      evidenceOk: !findingCode,
      provenanceShapeOk: findingCode !== "invalid_provenance",
      sequenceDigestOk: findingCode !== "sequence_digest_mismatch",
      sourceCommitOk: findingCode !== "source_commit_mismatch",
      recordedAtOk: findingCode !== "invalid_recorded_at",
      evidenceFresh:
        !findingCode ||
        !["stale_evidence", "future_recorded_at"].includes(findingCode),
    },
    findings: findingCode
      ? [
          {
            code: findingCode,
            severity: "error",
            message: `${findingCode} finding`,
          },
        ]
      : [],
  };

  return {
    exitCode: report.ok ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

describe("playbook lifecycle sequence evidence doctor script", () => {
  it("parses evidence, compact, now, and current commit arguments", () => {
    expect(
      parsePlaybookLifecycleSequenceEvidenceDoctorArgs([
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
    expect(() => parsePlaybookLifecycleSequenceEvidenceDoctorArgs([])).toThrow(
      "--evidence <path> is required",
    );
  });

  it("reports fresh evidence using the tracked example", () => {
    const result = doctorPlaybookLifecycleSequenceEvidence({
      evidencePath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
    });

    expect(result).toMatchObject({
      exitCode: 0,
      report: {
        ok: true,
        command: PLAYBOOK_LIFECYCLE_SEQUENCE_EVIDENCE_DOCTOR_COMMAND,
        status: "fresh_evidence",
        severity: "info",
        evidencePath,
        productionReady: false,
        publishingPerformed: false,
        diagnosticOnly: true,
        nextCommand:
          `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence ${evidencePath}`,
      },
    });
  });

  it("reports missing evidence before running freshness validation", () => {
    const result = doctorPlaybookLifecycleSequenceEvidence({
      evidencePath: "missing-evidence.json",
      fileExists: () => false,
      buildFreshnessResult: () => buildFreshnessResult(),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "missing_evidence",
        severity: "error",
        evidencePath: "missing-evidence.json",
        nextCommand:
          "npm run playbook:lifecycle:sequence:evidence:check -- --evidence missing-evidence.json",
      },
    });
  });

  it("reports invalid evidence when freshness validation cannot parse JSON", () => {
    const result = doctorPlaybookLifecycleSequenceEvidence({
      evidencePath,
      fileExists: () => true,
      buildFreshnessResult: () => {
        throw new Error("sequence evidence file is not valid JSON");
      },
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "invalid_evidence",
        severity: "error",
        validation: {
          ok: false,
          error: "sequence evidence file is not valid JSON",
        },
      },
    });
  });

  it("reports source commit mismatch from freshness findings", () => {
    const result = doctorPlaybookLifecycleSequenceEvidence({
      evidencePath,
      fileExists: () => true,
      buildFreshnessResult: () => buildFreshnessResult("source_commit_mismatch"),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "source_commit_mismatch",
        severity: "error",
        nextCommand:
          `npm run playbook:lifecycle:sequence:evidence:check -- --evidence ${evidencePath}`,
        freshness: {
          ok: false,
          findings: [
            expect.objectContaining({
              code: "source_commit_mismatch",
            }),
          ],
        },
      },
    });
  });

  it("reports future recordedAt before stale evidence", () => {
    const result = doctorPlaybookLifecycleSequenceEvidence({
      evidencePath,
      fileExists: () => true,
      buildFreshnessResult: () => buildFreshnessResult("future_recorded_at"),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "future_recorded_at",
        severity: "error",
      },
    });
  });

  it("reports stale evidence from freshness findings", () => {
    const result = doctorPlaybookLifecycleSequenceEvidence({
      evidencePath,
      fileExists: () => true,
      buildFreshnessResult: () => buildFreshnessResult("stale_evidence"),
    });

    expect(result).toMatchObject({
      exitCode: 1,
      report: {
        ok: false,
        status: "stale_evidence",
        severity: "error",
      },
    });
  });
});
