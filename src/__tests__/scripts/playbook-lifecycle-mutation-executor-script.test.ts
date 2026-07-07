import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND,
  buildPlaybookLifecycleMutationExecutorCliResult,
  parsePlaybookLifecycleMutationExecutorArgs,
} from "../../../scripts/playbooks/run-playbook-lifecycle-mutation-executor.mjs";

const fullCommit = "4e2b1e138987f7725f2d835c1ab738ec343d7027";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";
const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const manifestPath =
  "docs/playbook-lifecycle-mutation-manifests/example-version-update-manifest.json";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function preflightResult(ok = true) {
  const report = {
    ok,
    command: "playbook:lifecycle:mutation:preflight:check",
    status: ok
      ? "ready_for_mutation_executor_preflight"
      : "preflight_not_valid",
    readyForLifecycleMutationPreflight: ok,
    productionReady: false,
    publishingPerformed: false,
    preflightOnly: true,
    dryRunPath,
    evidencePath,
    checks: {
      closeoutOk: ok,
      dryRunOk: ok,
      approvalOk: ok,
      updateContractTargetPresent: ok,
      targetScopeOk: ok,
      executionBoundaryOk: ok,
    },
    findings: [],
  };

  return {
    exitCode: ok ? 0 : 1,
    stdout: `${JSON.stringify(report)}\n`,
  };
}

function writeWorkspaceFixture(overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-mutation-executor-cli-"));
  const targetPath = "src/lib/executor/playbooks/sales-pipeline.ts";
  const initialContent = "export const value = 'old';\n";
  const nextContent = "export const value = 'new';\n";
  mkdirSync(join(cwd, "src/lib/executor/playbooks"), { recursive: true });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-manifests"), {
    recursive: true,
  });
  mkdirSync(join(cwd, "docs/playbook-lifecycle-mutation-dry-runs"), {
    recursive: true,
  });
  writeFileSync(join(cwd, targetPath), initialContent);
  writeFileSync(
    join(cwd, dryRunPath),
    `${JSON.stringify(
      {
        dryRunId: "dry-run-sales-pipeline-v1-review",
        targetPlaybookId: "sales-pipeline-v1",
        plannedTargets: [
          {
            kind: "registered_playbook_contract",
            path: targetPath,
            operation: "update_contract",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(cwd, manifestPath),
    `${JSON.stringify(
      {
        manifestId: "mutation-manifest-sales-pipeline-v1-review",
        dryRunPath,
        targetPlaybookId: "sales-pipeline-v1",
        preflight: {
          command: "playbook:lifecycle:mutation:preflight:check",
          status: "ready_for_mutation_executor_preflight",
          readyForLifecycleMutationPreflight: true,
          productionReady: false,
          publishingPerformed: false,
          preflightOnly: true,
        },
        targets: [
          {
            kind: "registered_playbook_contract",
            path: targetPath,
            operation: "replace_file",
            expectedCurrentSha256: sha256(initialContent),
            nextContentSha256: sha256(nextContent),
            nextContent,
          },
        ],
        executionBoundary: {
          mutationExecutorOnly: true,
          requiresExplicitApplyConfirmation: true,
          fixtureRefreshPerformed: false,
          storeWritesPerformed: false,
          externalWritesPerformed: false,
          publishingPerformed: false,
          productionReady: false,
        },
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );

  return {
    cwd,
    targetPath,
    manifestPath,
    initialContent,
    nextContent,
  };
}

describe("playbook lifecycle mutation executor script", () => {
  it("parses preview/apply arguments and explicit apply confirmation", () => {
    expect(
      parsePlaybookLifecycleMutationExecutorArgs([
        "--mode",
        "apply",
        "--manifest",
        manifestPath,
        "--evidence",
        evidencePath,
        "--dry-run",
        dryRunPath,
        "--now",
        "2026-07-07T03:00:00Z",
        "--current-commit",
        fullCommit,
        "--confirm-apply",
        "--compact",
      ]),
    ).toEqual({
      pretty: false,
      mode: "apply",
      manifestPath,
      evidencePath,
      dryRunPath,
      now: "2026-07-07T03:00:00Z",
      currentCommit: fullCommit,
      confirmApply: true,
    });
  });

  it("requires manifest, evidence, and dry-run paths", () => {
    expect(() => parsePlaybookLifecycleMutationExecutorArgs([])).toThrow(
      "--manifest <path> is required",
    );
    expect(() =>
      parsePlaybookLifecycleMutationExecutorArgs([
        "--manifest",
        manifestPath,
      ]),
    ).toThrow("--evidence <path> is required");
    expect(() =>
      parsePlaybookLifecycleMutationExecutorArgs([
        "--manifest",
        manifestPath,
        "--evidence",
        evidencePath,
      ]),
    ).toThrow("--dry-run <path> is required");
  });

  it("builds a successful preview result without mutating the target", () => {
    const { cwd, targetPath, initialContent } = writeWorkspaceFixture();
    const result = buildPlaybookLifecycleMutationExecutorCliResult({
      cwd,
      mode: "preview",
      manifestPath,
      evidencePath,
      dryRunPath,
      buildPreflightResult: () => preflightResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND,
      mode: "preview",
      status: "mutation_preview_ready",
      productionReady: false,
      publishingPerformed: false,
    });
    expect(readFileSync(join(cwd, targetPath), "utf8")).toBe(initialContent);
  });

  it("fails closed when injected preflight is not green", () => {
    const { cwd } = writeWorkspaceFixture();
    const result = buildPlaybookLifecycleMutationExecutorCliResult({
      cwd,
      mode: "preview",
      manifestPath,
      evidencePath,
      dryRunPath,
      buildPreflightResult: () => preflightResult(false),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(report).toMatchObject({
      ok: false,
      status: "preflight_not_green",
      findings: [
        expect.objectContaining({
          code: "preflight_not_green",
        }),
      ],
    });
  });

  it("applies only when apply mode is explicitly confirmed", () => {
    const { cwd, targetPath, nextContent } = writeWorkspaceFixture();
    const result = buildPlaybookLifecycleMutationExecutorCliResult({
      cwd,
      mode: "apply",
      confirmApply: true,
      manifestPath,
      evidencePath,
      dryRunPath,
      buildPreflightResult: () => preflightResult(),
      pretty: false,
    });
    const report = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(report).toMatchObject({
      ok: true,
      mode: "apply",
      status: "mutation_apply_complete",
      executionBoundary: {
        mutationPerformed: true,
        externalWritesPerformed: false,
        publishingPerformed: false,
        productionReady: false,
      },
    });
    expect(readFileSync(join(cwd, targetPath), "utf8")).toBe(nextContent);
  });
});
