import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AgentCoreTaskRequest } from "@/lib/executor/contracts";
import type { AgentCoreTaskTraceAttempt } from "@/lib/executor/contracts";

export type ClawCodePermissionMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

export type ClawCodeAdapterOptions = {
  binaryPath?: string;
  cwd?: string;
  permissionMode?: ClawCodePermissionMode;
  timeoutSeconds?: number;
};

export type ClawCodeFailureInput = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  timedOut: boolean;
};

export type ClawCodeFailure = {
  code:
    | "CLAW_CODE_TIMEOUT"
    | "CLAW_CODE_UNAVAILABLE"
    | "CLAW_CODE_FAILED";
  message: string;
  detail?: string;
};

export type AgentCoreExecutorBackend = "claw_code" | "direct_model";

export type ClawCodeParsedOutput =
  | {
      ok: true;
      text: string;
      raw: unknown;
    }
  | {
      ok: false;
      text: string;
      raw: unknown;
      error: string;
    };

function stringifyWorkspaceContext(context?: Record<string, unknown> | null) {
  if (!context) return "";
  return Object.entries(context)
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value),
    )
    .map(([key, value]) => `${key}=${String(value).trim()}`)
    .filter((entry) => !entry.endsWith("="))
    .join(", ");
}

export function buildClawCodePrompt(request: AgentCoreTaskRequest) {
  const parts = [
    "You are running inside AgentCoreOS Runtime as the execution base.",
    "First principles: stability, efficiency, precision.",
    "Return concrete, reviewable output. Do not invent unavailable workflow state.",
  ];
  const systemPrompt = String(request.context.systemPrompt ?? "").trim();
  if (systemPrompt) {
    parts.push("## System Prompt", systemPrompt);
  }

  const workspaceContext = stringifyWorkspaceContext(request.context.workspace);
  const metadata = [
    `sessionId=${request.session.id}`,
    `requestId=${request.metadata.requestId}`,
    request.metadata.source ? `source=${request.metadata.source}` : "",
    request.skillPolicy.taskLabel ? `taskLabel=${request.skillPolicy.taskLabel}` : "",
    request.skillPolicy.memoryScope ? `memoryScope=${request.skillPolicy.memoryScope}` : "",
    workspaceContext,
  ]
    .filter(Boolean)
    .join(", ");

  if (metadata) {
    parts.push("## AgentCore Context", metadata);
  }

  parts.push("## User Task", request.taskInput.userMessage.trim());
  return parts.join("\n\n").trim();
}

export function buildClawCodeArgs(input: {
  prompt: string;
  cwd?: string;
  permissionMode?: ClawCodePermissionMode;
}) {
  const args = [
    "--print",
    "--output-format",
    "json",
    "--permission-mode",
    input.permissionMode ?? "read-only",
  ];

  if (input.cwd) {
    args.push("--cwd", input.cwd);
  }

  args.push(input.prompt);
  return args;
}

function extractTextFromJson(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["result", "text", "message", "content", "output"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
}

export function parseClawCodeOutput(stdout: string): ClawCodeParsedOutput {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return {
      ok: false,
      text: "",
      raw: null,
      error: "AgentCoreOS Runtime returned empty output",
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const text = extractTextFromJson(parsed);
    if (text) {
      return { ok: true, text, raw: parsed };
    }
    return {
      ok: false,
      text: "",
      raw: parsed,
      error: "AgentCoreOS Runtime JSON output did not include text content",
    };
  } catch {
    return {
      ok: true,
      text: trimmed,
      raw: trimmed,
    };
  }
}

export function mapClawCodeFailure(input: ClawCodeFailureInput): ClawCodeFailure {
  const detail = input.stderr.trim();
  if (input.timedOut) {
    return {
      code: "CLAW_CODE_TIMEOUT",
      message: "AgentCoreOS Runtime execution timed out.",
      detail,
    };
  }

  if (input.code === 127 || /command not found|not recognized|no such file/i.test(detail)) {
    return {
      code: "CLAW_CODE_UNAVAILABLE",
      message:
        "AgentCoreOS Runtime is unavailable. Configure or package the AgentCoreOS runtime binary.",
      detail,
    };
  }

  return {
    code: "CLAW_CODE_FAILED",
    message: "AgentCoreOS Runtime execution failed.",
    detail,
  };
}

export function buildClawCodeTraceAttempt(input: {
  candidateKind: "primary" | "fallback" | "legacy";
  attemptNumber: number;
  startedAt: number;
  finishedAt: number;
  success: boolean;
  error?: string;
}): AgentCoreTaskTraceAttempt {
  return {
    engine: "claw_code",
    candidateKind: input.candidateKind,
    provider: "agentcoreos-runtime",
    model: "agentcoreos-executor",
    attemptNumber: input.attemptNumber,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: Math.max(0, input.finishedAt - input.startedAt),
    success: input.success,
    error: input.error,
  };
}

export function selectExecutorBackend(input: {
  envValue?: string | null;
  hasModelCandidates: boolean;
}): AgentCoreExecutorBackend {
  const normalized = String(input.envValue ?? "").trim().toLowerCase();
  if (normalized === "direct_model" || normalized === "agentcore_executor") {
    return "direct_model";
  }
  if (normalized === "claw_code" || normalized === "claw-code" || normalized === "claw") {
    return "claw_code";
  }
  return "claw_code";
}

async function isExecutable(candidate: string) {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveClawCodeBinary(explicitPath?: string) {
  const home = os.homedir();
  const candidates = [
    explicitPath,
    process.env.AGENTCORE_CLAW_CODE_BIN,
    path.join(home, ".cargo", "bin", process.platform === "win32" ? "claw.exe" : "claw"),
    process.platform === "win32" ? "claw.exe" : "claw",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (candidate === "claw" || candidate === "claw.exe") {
      return candidate;
    }
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1] ?? "claw";
}

export async function runClawCodeTask(
  request: AgentCoreTaskRequest,
  options: ClawCodeAdapterOptions = {},
) {
  const prompt = buildClawCodePrompt(request);
  const binary = await resolveClawCodeBinary(options.binaryPath);
  const args = buildClawCodeArgs({
    prompt,
    cwd: options.cwd,
    permissionMode: options.permissionMode,
  });
  const timeoutSeconds =
    options.timeoutSeconds ?? request.executionPolicy.timeoutSeconds;

  return await new Promise<ClawCodeParsedOutput>((resolve) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutSeconds * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        text: "",
        raw: null,
        error: mapClawCodeFailure({
          code: 127,
          signal: null,
          stderr: error.message,
          timedOut,
        }).message,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0 && !timedOut) {
        resolve(parseClawCodeOutput(stdout));
        return;
      }
      const failure = mapClawCodeFailure({
        code,
        signal,
        stderr,
        timedOut,
      });
      resolve({
        ok: false,
        text: "",
        raw: { code, signal, stderr },
        error: failure.message,
      });
    });
  });
}
