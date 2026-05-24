import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";

const EXECUTE_BODY_LIMIT = 200_000;
const MAX_TIMEOUT_SECONDS = 60;

type RuntimeExecuteBody = {
  code?: string;
  language?: string;
  timeout?: number;
};

function normalizeLanguage(value: unknown) {
  const language = String(value ?? "python").trim().toLowerCase();
  if (language === "python" || language === "py") return "python";
  if (language === "javascript" || language === "js" || language === "node") return "javascript";
  return null;
}

function normalizeTimeout(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(MAX_TIMEOUT_SECONDS, Math.floor(value)))
    : 30;
}

function commandFor(language: "python" | "javascript") {
  if (language === "javascript") return { command: "node", args: ["-e"] };
  return { command: "python3", args: ["-c"] };
}

function runCode(input: {
  code: string;
  language: "python" | "javascript";
  timeoutSeconds: number;
}) {
  return new Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
  }>((resolve) => {
    const { command, args } = commandFor(input.language);
    const child = spawn(command, [...args, input.code], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, input.timeoutSeconds * 1000);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 100_000) stdout = stdout.slice(-100_000);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 100_000) stderr = stderr.slice(-100_000);
    });
    child.on("error", (error) => {
      stderr = error.message;
      finish(null);
    });
    child.on("close", (code) => {
      finish(code);
    });
  });
}

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const body = (await readJsonBodyWithLimit(req, EXECUTE_BODY_LIMIT)) as
      | RuntimeExecuteBody
      | null;
    const code = String(body?.code ?? "");
    const language = normalizeLanguage(body?.language);
    if (!code.trim()) {
      return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
    }
    if (!language) {
      return NextResponse.json(
        { ok: false, error: "Unsupported language" },
        { status: 400 },
      );
    }

    const output = await runCode({
      code,
      language,
      timeoutSeconds: normalizeTimeout(body?.timeout),
    });

    const ok = output.exitCode === 0 && !output.timedOut;
    return NextResponse.json(
      {
        ok,
        output: {
          language,
          stdout: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode,
          timedOut: output.timedOut,
        },
        error: ok ? null : output.timedOut ? "Execution timed out" : output.stderr || "Execution failed",
      },
      {
        status: ok ? 200 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute code.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
