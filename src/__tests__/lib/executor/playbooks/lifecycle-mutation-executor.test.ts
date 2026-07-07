import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND,
  runPlaybookLifecycleMutationExecutor,
} from "@/lib/executor/playbooks/lifecycle-mutation-executor";

const dryRunPath =
  "docs/playbook-lifecycle-mutation-dry-runs/example-version-update-dry-run.json";
const evidencePath =
  "docs/playbook-lifecycle-sequence-evidence/example-version-update-evidence.json";

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function preflightReport(overrides = {}) {
  return {
    ok: true,
    command: "playbook:lifecycle:mutation:preflight:check",
    status: "ready_for_mutation_executor_preflight",
    readyForLifecycleMutationPreflight: true,
    productionReady: false,
    publishingPerformed: false,
    preflightOnly: true,
    dryRunPath,
    evidencePath,
    checks: {
      closeoutOk: true,
      dryRunOk: true,
      approvalOk: true,
      updateContractTargetPresent: true,
      targetScopeOk: true,
      executionBoundaryOk: true,
    },
    findings: [],
    ...overrides,
  };
}

function writeTargetFixture(initialContent = "export const value = 'old';\n") {
  const cwd = mkdtempSync(join(tmpdir(), "playbook-mutation-executor-"));
  const targetPath = "src/lib/executor/playbooks/sales-pipeline.ts";
  mkdirSync(join(cwd, "src/lib/executor/playbooks"), { recursive: true });
  writeFileSync(join(cwd, targetPath), initialContent);
  return {
    cwd,
    targetPath,
    initialContent,
  };
}

function manifest({
  currentContent = "export const value = 'old';\n",
  nextContent = "export const value = 'new';\n",
  path = "src/lib/executor/playbooks/sales-pipeline.ts",
  expectedCurrentSha256 = sha256(currentContent),
  nextContentSha256 = sha256(nextContent),
  executionBoundary = {},
} = {}) {
  return {
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
        path,
        operation: "replace_file",
        expectedCurrentSha256,
        nextContentSha256,
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
      ...executionBoundary,
    },
  };
}

describe("runPlaybookLifecycleMutationExecutor", () => {
  it("previews a green manifest without changing the target file", () => {
    const { cwd, targetPath, initialContent } = writeTargetFixture();
    const nextContent = "export const value = 'new';\n";

    const report = runPlaybookLifecycleMutationExecutor(
      manifest({ currentContent: initialContent, nextContent }),
      {
        cwd,
        mode: "preview",
        dryRunPath,
        evidencePath,
        preflightReport: preflightReport(),
        allowedTargetPaths: ["src/lib/executor/playbooks/sales-pipeline.ts"],
      },
    );

    expect(report).toMatchObject({
      ok: true,
      command: PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND,
      mode: "preview",
      status: "mutation_preview_ready",
      productionReady: false,
      publishingPerformed: false,
      readyForLifecycleMutationExecutor: true,
      executionBoundary: {
        mutationExecutorOnly: true,
        previewOnly: true,
        mutationPerformed: false,
        fixtureRefreshPerformed: false,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: false,
        productionReady: false,
      },
      findings: [],
    });
    expect(readFileSync(join(cwd, targetPath), "utf8")).toBe(initialContent);
  });

  it("rejects stale target hashes before preview or apply", () => {
    const { cwd, initialContent } = writeTargetFixture();

    const report = runPlaybookLifecycleMutationExecutor(
      manifest({
        currentContent: initialContent,
        expectedCurrentSha256: sha256("stale content\n"),
      }),
      {
        cwd,
        mode: "preview",
        dryRunPath,
        evidencePath,
        preflightReport: preflightReport(),
        allowedTargetPaths: ["src/lib/executor/playbooks/sales-pipeline.ts"],
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "mutation_executor_not_valid",
      readyForLifecycleMutationExecutor: false,
      findings: [
        expect.objectContaining({
          code: "current_hash_mismatch",
          path: "src/lib/executor/playbooks/sales-pipeline.ts",
        }),
      ],
    });
  });

  it("rejects target paths outside the registered playbook directory", () => {
    const { cwd, initialContent } = writeTargetFixture();

    const report = runPlaybookLifecycleMutationExecutor(
      manifest({
        currentContent: initialContent,
        path: "src/lib/server/controlled-execution-store.ts",
      }),
      {
        cwd,
        mode: "preview",
        dryRunPath,
        evidencePath,
        preflightReport: preflightReport(),
        allowedTargetPaths: ["src/lib/executor/playbooks/sales-pipeline.ts"],
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "mutation_executor_not_valid",
      findings: [
        expect.objectContaining({
          code: "invalid_target_scope",
          path: "src/lib/server/controlled-execution-store.ts",
        }),
      ],
    });
  });

  it("refuses apply mode without explicit confirmation", () => {
    const { cwd, targetPath, initialContent } = writeTargetFixture();
    const nextContent = "export const value = 'new';\n";

    const report = runPlaybookLifecycleMutationExecutor(
      manifest({ currentContent: initialContent, nextContent }),
      {
        cwd,
        mode: "apply",
        dryRunPath,
        evidencePath,
        preflightReport: preflightReport(),
        allowedTargetPaths: ["src/lib/executor/playbooks/sales-pipeline.ts"],
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "apply_confirmation_missing",
      executionBoundary: {
        mutationPerformed: false,
      },
      findings: [
        expect.objectContaining({
          code: "apply_confirmation_missing",
        }),
      ],
    });
    expect(readFileSync(join(cwd, targetPath), "utf8")).toBe(initialContent);
  });

  it("applies confirmed replacement writes only inside the scoped workspace target", () => {
    const { cwd, targetPath, initialContent } = writeTargetFixture();
    const nextContent = "export const value = 'new';\n";

    const report = runPlaybookLifecycleMutationExecutor(
      manifest({ currentContent: initialContent, nextContent }),
      {
        cwd,
        mode: "apply",
        confirmApply: true,
        dryRunPath,
        evidencePath,
        preflightReport: preflightReport(),
        allowedTargetPaths: ["src/lib/executor/playbooks/sales-pipeline.ts"],
      },
    );

    expect(report).toMatchObject({
      ok: true,
      mode: "apply",
      status: "mutation_apply_complete",
      productionReady: false,
      publishingPerformed: false,
      executionBoundary: {
        mutationPerformed: true,
        fixtureRefreshPerformed: false,
        storeWritesPerformed: false,
        externalWritesPerformed: false,
        publishingPerformed: false,
        productionReady: false,
      },
      summary: {
        targets: 1,
        mutatedTargets: 1,
      },
      findings: [],
    });
    expect(readFileSync(join(cwd, targetPath), "utf8")).toBe(nextContent);
  });

  it("rejects scoped targets that were not declared by the dry-run target set", () => {
    const { cwd, initialContent } = writeTargetFixture();

    const report = runPlaybookLifecycleMutationExecutor(
      manifest({
        currentContent: initialContent,
        path: "src/lib/executor/playbooks/support-resolution.ts",
      }),
      {
        cwd,
        mode: "preview",
        dryRunPath,
        evidencePath,
        preflightReport: preflightReport(),
        allowedTargetPaths: ["src/lib/executor/playbooks/sales-pipeline.ts"],
      },
    );

    expect(report).toMatchObject({
      ok: false,
      status: "mutation_executor_not_valid",
      findings: [
        expect.objectContaining({
          code: "target_not_declared_by_dry_run",
          path: "src/lib/executor/playbooks/support-resolution.ts",
        }),
      ],
    });
  });
});
