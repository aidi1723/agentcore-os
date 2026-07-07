import { describe, expect, it } from "vitest";

import {
  validatePlaybookLifecycleChangeProposal,
  type PlaybookLifecycleChangeProposal,
} from "@/lib/executor/playbooks/lifecycle-change-proposal";

const requiredCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];

function buildValidProposal(
  overrides: Partial<PlaybookLifecycleChangeProposal> = {},
): PlaybookLifecycleChangeProposal {
  return {
    proposalId: "proposal-sales-pipeline-v1-review",
    changeType: "version_update",
    playbookId: "sales-pipeline-v1",
    owner: "agentcore-runtime-maintainers",
    reason: "Refresh the sales pipeline playbook contract after lifecycle review.",
    specPath:
      "docs/superpowers/specs/2026-07-07-playbook-lifecycle-change-proposal-contract-design.md",
    planPath:
      "docs/superpowers/plans/2026-07-07-playbook-lifecycle-change-proposal-contract.md",
    requiredCommands,
    expectedFixtureIds: ["sales-pipeline-governed"],
    riskNotes: ["No fixture mutation is performed by the proposal checker."],
    ...overrides,
  };
}

describe("validatePlaybookLifecycleChangeProposal", () => {
  it("accepts a complete local version update proposal", () => {
    const report = validatePlaybookLifecycleChangeProposal(buildValidProposal(), {
      fileExists: () => true,
    });

    expect(report).toMatchObject({
      ok: true,
      command: "playbook:lifecycle:change:check",
      productionReady: false,
      publishingPerformed: false,
      proposalOnly: true,
      summary: {
        findings: 0,
        requiredCommands: 4,
        expectedFixtureIds: 1,
      },
      proposal: {
        proposalId: "proposal-sales-pipeline-v1-review",
        changeType: "version_update",
        playbookId: "sales-pipeline-v1",
        owner: "agentcore-runtime-maintainers",
      },
      findings: [],
    });
  });

  it("fails closed when required lifecycle commands are missing", () => {
    const report = validatePlaybookLifecycleChangeProposal(
      buildValidProposal({
        requiredCommands: ["npm run playbook:control:audit"],
      }),
      {
        fileExists: () => true,
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toContainEqual({
      code: "missing_required_command",
      severity: "error",
      message:
        "Proposal proposal-sales-pipeline-v1-review must include required command: npm run playbook:lifecycle:handoff.",
      command: "npm run playbook:lifecycle:handoff",
    });
    expect(report.findings).toContainEqual({
      code: "missing_required_command",
      severity: "error",
      message:
        "Proposal proposal-sales-pipeline-v1-review must include required command: npm run trace:fixtures --silent.",
      command: "npm run trace:fixtures --silent",
    });
    expect(report.nextCommand).toBe("npm run playbook:lifecycle:change:check");
  });

  it("requires replacement metadata for deprecation proposals", () => {
    const report = validatePlaybookLifecycleChangeProposal(
      buildValidProposal({
        changeType: "deprecation",
        expectedFixtureIds: [],
      }),
      {
        fileExists: () => true,
      },
    );

    expect(report.ok).toBe(false);
    expect(report.findings).toEqual(
      expect.arrayContaining([
        {
          code: "missing_deprecation_metadata",
          severity: "error",
          message:
            "Deprecation proposal proposal-sales-pipeline-v1-review must include replacementPlaybookId.",
          field: "replacementPlaybookId",
        },
        {
          code: "missing_deprecation_metadata",
          severity: "error",
          message:
            "Deprecation proposal proposal-sales-pipeline-v1-review must include deprecatedAt.",
          field: "deprecatedAt",
        },
      ]),
    );
  });
});
