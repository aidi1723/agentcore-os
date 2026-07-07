import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND,
  buildPlaybookLifecycleChangeProposalCliResult,
  parsePlaybookLifecycleChangeProposalArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-change-proposal.mjs";

const requiredCommands = [
  "npm run playbook:control:audit",
  "npm run playbook:lifecycle:handoff",
  "npm run trace:fixtures --silent",
  "npm run test:controlled-runtime",
];

function createProposalFixture(proposalOverrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-change-proposal-"));
  mkdirSync(join(cwd, "docs/superpowers/specs"), { recursive: true });
  mkdirSync(join(cwd, "docs/superpowers/plans"), { recursive: true });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-change-proposals"), {
    recursive: true,
  });
  writeFileSync(
    join(
      cwd,
      "docs/superpowers/specs/2026-07-07-playbook-lifecycle-change-proposal-contract-design.md",
    ),
    "# Spec\n",
  );
  writeFileSync(
    join(
      cwd,
      "docs/superpowers/plans/2026-07-07-playbook-lifecycle-change-proposal-contract.md",
    ),
    "# Plan\n",
  );

  const proposalPath =
    "docs/playbook-lifecycle-change-proposals/example-version-update-proposal.json";
  writeFileSync(
    join(cwd, proposalPath),
    `${JSON.stringify(
      {
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
        ...proposalOverrides,
      },
      null,
      2,
    )}\n`,
  );

  return {
    cwd,
    proposalPath,
  };
}

describe("playbook lifecycle change proposal script", () => {
  it("parses proposal and compact arguments", () => {
    expect(
      parsePlaybookLifecycleChangeProposalArgs([
        "--proposal",
        "proposal.json",
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      proposalPath: "proposal.json",
    });
  });

  it("requires a proposal path", () => {
    expect(() => parsePlaybookLifecycleChangeProposalArgs([])).toThrow(
      "--proposal <path> is required",
    );
  });

  it("builds a successful CLI result for a valid proposal file", () => {
    const { cwd, proposalPath } = createProposalFixture();
    const result = buildPlaybookLifecycleChangeProposalCliResult({
      cwd,
      proposalPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_CHANGE_PROPOSAL_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      proposalOnly: true,
      proposalPath,
      summary: {
        findings: 0,
        requiredCommands: 4,
        expectedFixtureIds: 1,
      },
    });
  });

  it("returns non-zero for an invalid proposal file", () => {
    const { cwd, proposalPath } = createProposalFixture({
      requiredCommands: ["npm run playbook:control:audit"],
    });
    const result = buildPlaybookLifecycleChangeProposalCliResult({
      cwd,
      proposalPath,
      pretty: false,
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      summary: {
        findings: 3,
      },
    });
  });

  it("rejects invalid JSON proposal files", () => {
    const { cwd, proposalPath } = createProposalFixture();
    writeFileSync(join(cwd, proposalPath), "not json");

    expect(() =>
      buildPlaybookLifecycleChangeProposalCliResult({
        cwd,
        proposalPath,
      }),
    ).toThrow("proposal file is not valid JSON");
  });
});
