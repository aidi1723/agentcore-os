import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

function runOpenClaw(args: string[], timeoutMs: number) {
  const bin = (process.env.OPENCLAW_BIN ?? "openclaw").trim() || "openclaw";
  return new Promise<{ ok: boolean; code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout.on("data", (c) => (stdout += String(c)));
      child.stderr.on("data", (c) => (stderr += String(c)));
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ ok: code === 0, code, stdout, stderr });
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolve({ ok: false, code: 127, stdout, stderr });
      });
    },
  );
}

export async function GET() {
  const r = await runOpenClaw(["gateway", "call", "health", "--json"], 10_000);
  if (!r.ok) {
    const err = (r.stderr || r.stdout || "").trim();
    return NextResponse.json(
      {
        ok: false,
        error:
          err ||
          "无法获取 Gateway health。请确认 OpenClaw 已安装且 Gateway 正在运行（openclaw gateway status）。",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  let json: unknown = null;
  try {
    json = JSON.parse((r.stdout || "").trim());
  } catch {
    json = r.stdout.trim();
  }

  return NextResponse.json(
    { ok: true, health: json },
    { headers: { "Cache-Control": "no-store" } },
  );
}

