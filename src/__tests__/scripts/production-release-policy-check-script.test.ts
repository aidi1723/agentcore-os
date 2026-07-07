import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildProductionReleasePolicyCheckCliResult,
  parseProductionReleasePolicyCheckArgs,
} from "../../../scripts/release-policy/check-production-release-policy.mjs";

const deliveryCandidatePath =
  "docs/delivery-candidates/example-local-delivery-candidate.json";

function writePolicyFile(policy: Record<string, unknown> | string) {
  const cwd = mkdtempSync(join(tmpdir(), "agentcore-release-policy-"));
  const policyPath = "policy.json";
  writeFileSync(
    join(cwd, policyPath),
    typeof policy === "string" ? policy : JSON.stringify(policy),
    "utf8",
  );
  return { cwd, policyPath };
}

function section(overrides = {}) {
  return {
    owner: "agentcore-release-maintainers",
    approvalRequired: true,
    approved: false,
    executed: false,
    policyDocumented: true,
    ...overrides,
  };
}

function validPolicy() {
  return {
    policyId: "production-release-policy-2026-07-07",
    deliveryCandidatePath,
    owner: "agentcore-release-maintainers",
    recordedAt: "2026-07-07T11:30:00Z",
    productionReleasePolicy: {
      targetVersion: "v1.3.0-local-candidate",
      targetEnvironment: "production",
      releaseType: "source_distribution",
      sourceDeliveryCandidateClaim: "local_delivery_candidate_ready",
      releaseDecision: "blocked_until_explicit_production_approval",
      nextBoundary: "production_release_approval_packet",
    },
    commandEvidence: [
      {
        command: `npm run delivery:candidate:check -- --candidate ${deliveryCandidatePath}`,
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:01Z",
        gate: "delivery_candidate_green",
      },
      {
        command: "npm run release:hygiene:check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:02Z",
        gate: "release_hygiene_green",
      },
      {
        command: "npm run test:controlled-runtime",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:03Z",
        testFiles: 101,
        tests: 523,
      },
      {
        command: "npm run test:core-workflows",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:04Z",
        gate: "core_workflows_green",
      },
      {
        command: "npm run lint",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:05Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "npm run build",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:06Z",
        warningCount: 1,
        knownWarnings: ["existing <img> warning in ShellUI.test.tsx"],
      },
      {
        command: "git diff --check",
        ok: true,
        exitCode: 0,
        recordedAt: "2026-07-07T11:30:07Z",
        gate: "git_diff_check_green",
      },
    ],
    policySections: {
      packaging: section(),
      tagCreation: section(),
      artifactUpload: section(),
      deployment: section(),
      externalWrites: section(),
      monitoring: section({
        approvalRequired: false,
        readinessDocumented: true,
      }),
      rollback: section({
        approvalRequired: false,
        rollbackDocumented: true,
        rollbackNotes: ["Restore previous release candidate."],
      }),
    },
    riskSummary: {
      productionReady: false,
      publishingApproved: false,
      tagApproved: false,
      packageApproved: false,
      uploadApproved: false,
      deploymentApproved: false,
      externalWritesApproved: false,
      credentialUseApproved: false,
      deferredItems: ["explicit production release approval packet"],
    },
    rollbackSummary: {
      rollbackAvailable: true,
      rollbackNotes: ["No production action has been executed."],
    },
    deliveryCandidateResult: {
      ok: true,
      candidateOnly: true,
      deliveryClaim: "local_delivery_candidate_ready",
      productionReady: false,
      publishingPerformed: false,
    },
    releaseBoundary: {
      policyOnly: true,
      commandsExecutedByChecker: false,
      publishingPerformed: false,
      tagCreated: false,
      packageBuilt: false,
      uploadPerformed: false,
      deploymentPerformed: false,
      storeWritesPerformed: false,
      externalWritesPerformed: false,
      credentialsUsed: false,
      productionReady: false,
      productionReadinessClaimed: false,
    },
    approvalStatus: "production_release_policy_review",
    notes: ["Policy definition only; release execution remains blocked."],
  };
}

function okDeliveryCandidateResult() {
  return {
    stdout: JSON.stringify({
      ok: true,
      readyForLocalDeliveryCandidate: true,
      deliveryClaim: "local_delivery_candidate_ready",
      candidateOnly: true,
      productionReady: false,
      publishingPerformed: false,
    }),
  };
}

describe("production release policy check script", () => {
  it("parses policy and compact flags", () => {
    expect(
      parseProductionReleasePolicyCheckArgs([
        "--policy",
        "docs/release-policies/example-production-release-policy.json",
        "--compact",
      ]),
    ).toEqual({
      policyPath: "docs/release-policies/example-production-release-policy.json",
      pretty: false,
    });
  });

  it("requires a policy path", () => {
    expect(() => parseProductionReleasePolicyCheckArgs([])).toThrow(
      "--policy <path> is required",
    );
  });

  it("builds a green policy result from a valid policy file", () => {
    const { cwd, policyPath } = writePolicyFile(validPolicy());
    const result = buildProductionReleasePolicyCheckCliResult({
      cwd,
      policyPath,
      pretty: false,
      buildDeliveryCandidateResult: okDeliveryCandidateResult,
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: "release:production-policy:check",
      policyClaim: "production_release_policy_defined",
      readyForProductionReleasePolicyReview: true,
      productionReady: false,
      publishingPerformed: false,
      policyOnly: true,
    });
  });

  it("fails when the reused delivery candidate report is not green", () => {
    const { cwd, policyPath } = writePolicyFile(validPolicy());
    const result = buildProductionReleasePolicyCheckCliResult({
      cwd,
      policyPath,
      pretty: false,
      buildDeliveryCandidateResult: () => ({
        stdout: JSON.stringify({
          ok: false,
          readyForLocalDeliveryCandidate: false,
          candidateOnly: true,
          productionReady: false,
          publishingPerformed: false,
        }),
      }),
    });

    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(1);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_delivery_candidate" }),
      ]),
    );
  });

  it("rejects invalid policy JSON", () => {
    const { cwd, policyPath } = writePolicyFile("{not-json");

    expect(() =>
      buildProductionReleasePolicyCheckCliResult({
        cwd,
        policyPath,
        buildDeliveryCandidateResult: okDeliveryCandidateResult,
      }),
    ).toThrow("production release policy file is not valid JSON");
  });
});
