import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";

export const PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND =
  "playbook:lifecycle:mutation:executor";

export type PlaybookLifecycleMutationExecutorMode = "preview" | "apply";

export type PlaybookLifecycleMutationExecutorFinding = {
  code:
    | "invalid_manifest_contract"
    | "preflight_not_green"
    | "dry_run_path_mismatch"
    | "invalid_execution_boundary"
    | "invalid_target_scope"
    | "target_not_declared_by_dry_run"
    | "unsupported_target_operation"
    | "target_read_failed"
    | "current_hash_mismatch"
    | "next_content_hash_mismatch"
    | "apply_confirmation_missing"
    | "target_write_failed";
  severity: "error";
  message: string;
  field?: string;
  path?: string;
};

type GateReport = Record<string, unknown>;

type MutationExecutorTargetReport = {
  kind: string;
  path: string;
  operation: string;
  expectedCurrentSha256: string;
  actualCurrentSha256: string;
  nextContentSha256: string;
  currentHashMatches: boolean;
  nextContentHashMatches: boolean;
  declaredByDryRun: boolean;
  mutationApplied: boolean;
};

type RunPlaybookLifecycleMutationExecutorOptions = {
  cwd?: string;
  mode: PlaybookLifecycleMutationExecutorMode;
  confirmApply?: boolean;
  dryRunPath: string;
  evidencePath: string;
  preflightReport: GateReport;
  allowedTargetPaths: string[];
  readFile?: (path: string) => string;
  writeFile?: (path: string, content: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asTargets(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
}

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function isSha256(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}

function scopedPlaybookPath(path: string) {
  return (
    path.startsWith("src/lib/executor/playbooks/") &&
    path.endsWith(".ts") &&
    !path.startsWith("/") &&
    !path.includes("..")
  );
}

function resolveScopedPath(cwd: string, path: string) {
  if (!scopedPlaybookPath(path) || isAbsolute(path)) return undefined;
  const root = resolve(cwd);
  const absolutePath = resolve(root, path);
  if (absolutePath !== root && absolutePath.startsWith(`${root}${sep}`)) {
    return absolutePath;
  }
  return undefined;
}

function preflightOk(report: GateReport) {
  return (
    report.ok === true &&
    report.command === "playbook:lifecycle:mutation:preflight:check" &&
    report.status === "ready_for_mutation_executor_preflight" &&
    report.readyForLifecycleMutationPreflight === true &&
    report.productionReady === false &&
    report.publishingPerformed === false &&
    report.preflightOnly === true
  );
}

function embeddedPreflightOk(value: unknown) {
  const preflight = isRecord(value) ? value : {};
  return (
    preflight.command === "playbook:lifecycle:mutation:preflight:check" &&
    preflight.status === "ready_for_mutation_executor_preflight" &&
    preflight.readyForLifecycleMutationPreflight === true &&
    preflight.productionReady === false &&
    preflight.publishingPerformed === false &&
    preflight.preflightOnly === true
  );
}

function boundaryOk(boundary: Record<string, unknown>) {
  const requiredFalseFields = [
    "fixtureRefreshPerformed",
    "storeWritesPerformed",
    "externalWritesPerformed",
    "publishingPerformed",
    "productionReady",
  ] as const;
  const breachedField = requiredFalseFields.find((field) => boundary[field] !== false);
  return {
    ok:
      boundary.mutationExecutorOnly === true &&
      boundary.requiresExplicitApplyConfirmation === true &&
      breachedField === undefined,
    breachedField,
  };
}

function statusFromFindings(
  findings: PlaybookLifecycleMutationExecutorFinding[],
  mode: PlaybookLifecycleMutationExecutorMode,
) {
  const codes = new Set(findings.map((finding) => finding.code));
  if (codes.has("preflight_not_green")) return "preflight_not_green";
  if (codes.has("apply_confirmation_missing")) {
    return "apply_confirmation_missing";
  }
  if (findings.length > 0) return "mutation_executor_not_valid";
  return mode === "apply" ? "mutation_apply_complete" : "mutation_preview_ready";
}

function nextCommandForStatus(status: string, manifestPath?: string) {
  if (status === "mutation_preview_ready") {
    return `npm run playbook:lifecycle:mutation:executor:apply -- --manifest ${
      manifestPath ?? "<path>"
    } --evidence <path> --dry-run <path> --confirm-apply`;
  }
  if (status === "mutation_apply_complete") {
    return "npm run playbook:control:audit";
  }
  if (status === "preflight_not_green") {
    return "npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>";
  }
  return "Fix lifecycle mutation manifest findings before running apply mode.";
}

export function runPlaybookLifecycleMutationExecutor(
  manifest: unknown,
  options: RunPlaybookLifecycleMutationExecutorOptions,
) {
  const cwd = options.cwd ?? process.cwd();
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const writeFile =
    options.writeFile ?? ((path: string, content: string) => writeFileSync(path, content));
  const record = isRecord(manifest) ? manifest : {};
  const manifestId = asString(record.manifestId);
  const manifestDryRunPath = asString(record.dryRunPath);
  const targetPlaybookId = asString(record.targetPlaybookId);
  const targets = asTargets(record.targets);
  const allowedTargetPaths = new Set(options.allowedTargetPaths);
  const executionBoundary = isRecord(record.executionBoundary)
    ? record.executionBoundary
    : {};
  const findings: PlaybookLifecycleMutationExecutorFinding[] = [];
  const targetReports: MutationExecutorTargetReport[] = [];

  for (const field of ["manifestId", "dryRunPath", "targetPlaybookId"] as const) {
    if (!asString(record[field])) {
      findings.push({
        code: "invalid_manifest_contract",
        severity: "error",
        field,
        message: `Lifecycle mutation manifest must include non-empty ${field}.`,
      });
    }
  }

  if (targets.length === 0) {
    findings.push({
      code: "invalid_manifest_contract",
      severity: "error",
      field: "targets",
      message: "Lifecycle mutation manifest must include at least one target.",
    });
  }

  const freshPreflightOk = preflightOk(options.preflightReport);
  const manifestPreflightOk = embeddedPreflightOk(record.preflight);
  if (!freshPreflightOk || !manifestPreflightOk) {
    findings.push({
      code: "preflight_not_green",
      severity: "error",
      field: !freshPreflightOk ? "preflightReport" : "preflight",
      message:
        "Lifecycle mutation executor requires a green fresh preflight report and matching embedded manifest preflight.",
    });
  }

  if (manifestDryRunPath && manifestDryRunPath !== options.dryRunPath) {
    findings.push({
      code: "dry_run_path_mismatch",
      severity: "error",
      field: "dryRunPath",
      message: "Lifecycle mutation manifest dry-run path must match the executor input dry-run path.",
    });
  }

  const boundaryCheck = boundaryOk(executionBoundary);
  if (!boundaryCheck.ok) {
    findings.push({
      code: "invalid_execution_boundary",
      severity: "error",
      field: boundaryCheck.breachedField
        ? `executionBoundary.${boundaryCheck.breachedField}`
        : "executionBoundary",
      message:
        "Lifecycle mutation executor requires an executor-only boundary with no fixture, store, external, publishing, or production side effects.",
    });
  }

  for (const target of targets) {
    const kind = asString(target.kind);
    const path = asString(target.path);
    const operation = asString(target.operation);
    const expectedCurrentSha256 = asString(target.expectedCurrentSha256);
    const nextContentSha256 = asString(target.nextContentSha256);
    const nextContent = asString(target.nextContent);
    const scopedPath = resolveScopedPath(cwd, path);
    const declaredByDryRun = allowedTargetPaths.has(path);
    let actualCurrentSha256 = "";
    let currentHashMatches = false;
    let nextContentHashMatches = false;

    if (
      kind !== "registered_playbook_contract" ||
      !path ||
      !expectedCurrentSha256 ||
      !nextContentSha256 ||
      typeof target.nextContent !== "string"
    ) {
      findings.push({
        code: "invalid_manifest_contract",
        severity: "error",
        path,
        field: "targets",
        message:
          "Each lifecycle mutation target must include kind, path, expected current hash, next content hash, and next content.",
      });
    }

    if (operation !== "replace_file") {
      findings.push({
        code: "unsupported_target_operation",
        severity: "error",
        path,
        field: "targets.operation",
        message: "Lifecycle mutation executor currently supports only replace_file targets.",
      });
    }

    if (!scopedPath) {
      findings.push({
        code: "invalid_target_scope",
        severity: "error",
        path,
        field: "targets.path",
        message:
          "Lifecycle mutation executor target paths must stay under src/lib/executor/playbooks/.",
      });
    } else if (!declaredByDryRun) {
      findings.push({
        code: "target_not_declared_by_dry_run",
        severity: "error",
        path,
        field: "targets.path",
        message:
          "Lifecycle mutation executor target path must be declared by the approved mutation dry-run target set.",
      });
    } else {
      try {
        actualCurrentSha256 = sha256(readFile(scopedPath));
        currentHashMatches =
          isSha256(expectedCurrentSha256) &&
          actualCurrentSha256 === expectedCurrentSha256;
        if (!currentHashMatches) {
          findings.push({
            code: "current_hash_mismatch",
            severity: "error",
            path,
            field: "targets.expectedCurrentSha256",
            message:
              "Lifecycle mutation target current file hash does not match the manifest expectation.",
          });
        }
      } catch {
        findings.push({
          code: "target_read_failed",
          severity: "error",
          path,
          field: "targets.path",
          message: "Lifecycle mutation executor could not read the target file.",
        });
      }
    }

    nextContentHashMatches =
      isSha256(nextContentSha256) && sha256(nextContent) === nextContentSha256;
    if (!nextContentHashMatches) {
      findings.push({
        code: "next_content_hash_mismatch",
        severity: "error",
        path,
        field: "targets.nextContentSha256",
        message:
          "Lifecycle mutation target next content hash does not match the manifest expectation.",
      });
    }

    targetReports.push({
      kind,
      path,
      operation,
      expectedCurrentSha256,
      actualCurrentSha256,
      nextContentSha256,
      currentHashMatches,
      nextContentHashMatches,
      declaredByDryRun,
      mutationApplied: false,
    });
  }

  if (options.mode === "apply" && options.confirmApply !== true) {
    findings.push({
      code: "apply_confirmation_missing",
      severity: "error",
      field: "confirmApply",
      message: "Apply mode requires explicit --confirm-apply confirmation.",
    });
  }

  let mutationPerformed = false;
  if (findings.length === 0 && options.mode === "apply" && options.confirmApply === true) {
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      const path = asString(target.path);
      const scopedPath = resolveScopedPath(cwd, path);
      if (!scopedPath) continue;
      try {
        writeFile(scopedPath, asString(target.nextContent));
        targetReports[index].mutationApplied = true;
        mutationPerformed = true;
      } catch {
        findings.push({
          code: "target_write_failed",
          severity: "error",
          path,
          field: "targets.path",
          message: "Lifecycle mutation executor could not write the target file.",
        });
      }
    }
  }

  const status = statusFromFindings(findings, options.mode);
  const ok = findings.length === 0;

  return {
    ok,
    command: PLAYBOOK_LIFECYCLE_MUTATION_EXECUTOR_COMMAND,
    mode: options.mode,
    productionReady: false as const,
    publishingPerformed: false as const,
    mutationExecutorOnly: true as const,
    readyForLifecycleMutationExecutor: ok,
    status,
    manifest: {
      manifestId,
      dryRunPath: manifestDryRunPath,
      targetPlaybookId,
    },
    dryRunPath: options.dryRunPath,
    evidencePath: options.evidencePath,
    summary: {
      findings: findings.length,
      targets: targetReports.length,
      mutatedTargets: targetReports.filter((target) => target.mutationApplied).length,
    },
    checks: {
      preflightOk: freshPreflightOk && manifestPreflightOk,
      dryRunPathAligned:
        Boolean(manifestDryRunPath) && manifestDryRunPath === options.dryRunPath,
      executionBoundaryOk: boundaryCheck.ok,
      targetScopeOk:
        targetReports.length > 0 &&
        targetReports.every((target) => Boolean(resolveScopedPath(cwd, target.path))),
      targetsDeclaredByDryRun:
        targetReports.length > 0 &&
        targetReports.every((target) => target.declaredByDryRun),
      currentHashesOk:
        targetReports.length > 0 &&
        targetReports.every((target) => target.currentHashMatches),
      nextContentHashesOk:
        targetReports.length > 0 &&
        targetReports.every((target) => target.nextContentHashMatches),
      applyConfirmationOk: options.mode === "preview" || options.confirmApply === true,
    },
    targets: targetReports,
    executionBoundary: {
      mutationExecutorOnly: true as const,
      previewOnly: options.mode === "preview",
      applyConfirmationRequired: true as const,
      applyConfirmed: options.confirmApply === true,
      mutationPerformed,
      fixtureRefreshPerformed: false as const,
      storeWritesPerformed: false as const,
      externalWritesPerformed: false as const,
      publishingPerformed: false as const,
      productionReady: false as const,
    },
    findings,
    nextCommand: nextCommandForStatus(status),
    nextAction: ok
      ? options.mode === "apply"
        ? "Lifecycle mutation executor applied local file replacements only; rerun control audit and lifecycle gates before any further claim."
        : "Lifecycle mutation executor preview is green; apply still requires explicit --confirm-apply and remains local-only."
      : "Fix lifecycle mutation executor findings before running apply mode.",
  };
}
