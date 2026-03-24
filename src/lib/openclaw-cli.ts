import { spawn } from "node:child_process";

export type OpenClawAgentOk = {
  ok: true;
  text: string;
  raw: unknown;
};

export type OpenClawAgentErr = {
  ok: false;
  error: string;
  raw?: { stdout?: string; stderr?: string; code?: number | null };
};

export type OpenClawAgentResult = OpenClawAgentOk | OpenClawAgentErr;

export async function runOpenClawAgent(params: {
  message: string;
  sessionId: string;
  timeoutSeconds?: number;
}): Promise<OpenClawAgentResult> {
  const timeoutSeconds = Math.max(5, Math.min(600, params.timeoutSeconds ?? 60));
  const bin = (process.env.OPENCLAW_BIN ?? "openclaw").trim() || "openclaw";

  return await new Promise<OpenClawAgentResult>((resolve) => {
    const child = spawn(
      bin,
      [
        "agent",
        "--session-id",
        params.sessionId,
        "--message",
        params.message,
        "--json",
        "--timeout",
        String(timeoutSeconds),
        "--thinking",
        "off",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutSeconds * 1000 + 2_000);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 2_000_000) stdout = stdout.slice(-2_000_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      const combined = (stdout || "").trim();
      if (code !== 0) {
        const errText = (stderr || combined || "").trim();
        resolve({
          ok: false,
          error:
            errText ||
            "OpenClaw 执行失败。请确认已安装 openclaw 且本机 Gateway 正在运行（openclaw gateway status）。",
          raw: { stdout, stderr, code },
        });
        return;
      }

      let json: any = null;
      try {
        json = combined ? JSON.parse(combined) : null;
      } catch {
        // Sometimes CLI output might include logs; return raw text as fallback.
      }

      const text = json ? extractTextFromAgentJson(json) : combined;
      resolve({ ok: true, text: text.trim(), raw: json ?? combined });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        ok: false,
        error: err.message || "无法执行 openclaw 命令",
      });
    });
  });
}

export function extractTextFromAgentJson(json: any): string {
  const payloads = json?.result?.payloads;
  if (Array.isArray(payloads) && payloads.length > 0) {
    const text = payloads
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n\n");
    if (text) return text;
  }
  const fallback = json?.text ?? json?.result?.text;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return "";
}
