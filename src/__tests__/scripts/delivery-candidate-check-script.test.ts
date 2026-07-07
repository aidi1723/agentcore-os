import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildDeliveryCandidateCheckCliResult,
  parseDeliveryCandidateCheckArgs,
} from "../../../scripts/delivery-candidate/check-delivery-candidate.mjs";

const handoffSummaryPath =
  "docs/playbook-lifecycle-mutation-handoff-summaries/example-version-update-handoff-summary.json";

function writeCandidateFile(candidate: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-delivery-candidate-"));
  const candidatePath = "candidate.json";
  writeFileSync(
    join(cwd, candidatePath),
    typeof candidate === "string" ? candidate : JSON.stringify(candidate),
    "utf8",
  );
  return { cwd, candidatePath };
}

function validCandidate() {
  return {
    candidateId: "local-delivery-candidate-2026-07-07",
    handoffSummaryPath,
    owner: "agentcore-runtime-maintainers",
    recordedAt: "2026-07-07T11:10:00Z",
    deliveryCandidate: {
      targetMilestone: "controlled-runtime-local-delivery-candidate",
      deliveryClaim: "local_delivery_candidate_ready",
      sourceHandoffClaim: "local_release_handoff_ready",
      nextBoundary: "production_release_policy_hardening",
    },
    commandEvidence: [
      {
        command: `npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary ${handoffSummaryPath}`,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:01Z",
        gate: "handoff_summary_green",
      },
      {
        command: "npm run delivery:ready:check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:02Z",
        releaseClaim: "local_delivery_demo_ready",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:03Z",
        testFiles: 95,
        tests: 493,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:04Z",
        gate: "core_workflows_green",
      },
      {
        command: "npm run lint",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:05Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "npm run build",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:06Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:10:07Z",
        gate: "git_diff_check_green",
      },
    ],
    documentationSummary: {
      updatedFiles: [
        "README.md",
        "CHANGELOG.md",
        "docs/NEXT_STEPS.md",
        "docs/PROJECT_FRAMEWORK.zh-CN.md",
        "docs/DESIGN_GOAL_COMPLETION_STATUS.zh-CN.md",
        "docs/CONTROLLED_AGENT_RUNTIME_DEVELOPMENT_MANUAL.zh-CN.md",
        "docs/DOCUMENTATION_INDEX.zh-CN.md",
      ],
      status: "delivery_candidate_docs_aligned",
    },
    riskSummary: {
      productionReady: false,
      publishingApproved: false,
      externalWritesApproved: false,
      tagApproved: false,
      packageApproved: false,
      uploadApproved: false,
      deferredItems: [
        "production release policy",
        "deployment environment validation",
      ],
    },
    rollbackSummary: {
      rollbackAvailable: true,
      rollbackNotes: [
        "Revert the delivery candidate gate commit and rerun local checks.",
      ],
    },
    handoffSummaryResult: {
      ok: true,
      summaryOnly: true,
      productionReady: false,
      publishingPerformed: false,
    },
    deliveryReadyResult: {
      ok: true,
      releaseClaim: "local_delivery_demo_ready",
      productionReady: false,
    },
    deliveryCandidateBoundary: {
      candidateOnly: true,
      commandsExecutedByChecker: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      publishingPerformed: false,
      tagCreated: false,
      packageBuilt: false,
      uploadPerformed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "delivery_candidate_review",
    notes: ["Local delivery candidate only; production release remains separate."],
  };
}

function okHandoffSummaryResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForMaintainerHandoffSummary: true,
      summaryOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

function okDeliveryReadyResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      command: "delivery:ready:check",
      releaseClaim: "local_delivery_demo_ready",
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("delivery candidate check script", () => {
  it("parses candidate and compact flags", () => {
    expect(
      parseDeliveryCandidateCheckArgs([
        "--candidate",
        "docs/delivery-candidates/example-local-delivery-candidate.json",
        "--compact",
      ]),
    ).toEqual({
      candidatePath: "docs/delivery-candidates/example-local-delivery-candidate.json",
      pretty: false,
    });
  });

  it("requires a candidate path", () => {
    expect(() => parseDeliveryCandidateCheckArgs([])).toThrow(
      "--candidate <path> is required",
    );
  });

  it("builds a green delivery candidate result from a valid candidate file", () => {
    const { cwd, candidatePath } = writeCandidateFile(validCandidate());
    const result = buildDeliveryCandidateCheckCliResult({
      cwd,
      candidatePath,
      pretty: false,
      buildHandoffSummaryResult: okHandoffSummaryResult,
      buildDeliveryReadyResult: okDeliveryReadyResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "delivery:candidate:check",
      deliveryClaim: "local_delivery_candidate_ready",
      readyForLocalDeliveryCandidate: true,
      productionReady: false,
      publishingPerformed: false,
      candidateOnly: true,
    });
  });

  it("fails when the reused handoff summary report is not green", () => {
    const { cwd, candidatePath } = writeCandidateFile(validCandidate());
    const result = buildDeliveryCandidateCheckCliResult({
      cwd,
      candidatePath,
      pretty: false,
      buildHandoffSummaryResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForMaintainerHandoffSummary: false,
          summaryOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
      buildDeliveryReadyResult: okDeliveryReadyResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_handoff_summary" }),
      ]),
    );
  });

  it("rejects invalid candidate JSON", () => {
    const { cwd, candidatePath } = writeCandidateFile("{not-json");

    expect(() =>
      buildDeliveryCandidateCheckCliResult({
        cwd,
        candidatePath,
        buildHandoffSummaryResult: okHandoffSummaryResult,
        buildDeliveryReadyResult: okDeliveryReadyResult,
      }),
    ).toThrow("delivery candidate file is not valid JSON");
  });
});
