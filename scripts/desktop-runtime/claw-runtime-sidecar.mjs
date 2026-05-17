#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 18789);
const STARTED_AT = new Date().toISOString();

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers":
      "content-type,authorization,x-agentcore-token,x-openclaw-token,x-openclaw-gateway-token",
  });
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = 512_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function clawCandidates(explicitPath) {
  return [
    explicitPath,
    process.env.AGENTCORE_CLAW_CODE_BIN,
    path.join(os.homedir(), ".cargo", "bin", process.platform === "win32" ? "claw.exe" : "claw"),
    process.platform === "win32" ? "claw.exe" : "claw",
  ].filter(Boolean);
}

function runClaw(args, options = {}) {
  const candidates = clawCandidates(options.binaryPath);
  return new Promise((resolve) => {
    let index = 0;
    const tryNext = () => {
      const bin = candidates[index] || "claw";
      const child = spawn(bin, args, {
        cwd: options.cwd || process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, Math.max(1, options.timeoutSeconds || 60) * 1000);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        if (index + 1 < candidates.length) {
          index += 1;
          tryNext();
          return;
        }
        resolve({
          ok: false,
          code: 127,
          stderr: error.message,
          stdout,
          timedOut,
          bin,
        });
      });
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({ ok: code === 0 && !timedOut, code, signal, stdout, stderr, timedOut, bin });
      });
    };
    tryNext();
  });
}

function buildPrompt(payload) {
  const context = payload?.workspaceContext && typeof payload.workspaceContext === "object"
    ? Object.entries(payload.workspaceContext)
        .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
        .map(([key, value]) => `${key}=${String(value).trim()}`)
        .filter((entry) => !entry.endsWith("="))
        .join(", ")
    : "";
  return [
    "You are running inside AgentCoreOS Runtime as the desktop execution base.",
    "First principles: stability, efficiency, precision.",
    payload?.systemPrompt ? `System prompt:\n${payload.systemPrompt}` : "",
    `Session: ${payload?.sessionId || "desktop:claw-runtime"}`,
    context ? `Workspace context: ${context}` : "",
    `User task:\n${String(payload?.message || "").trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function parseClawText(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed);
    for (const key of ["result", "text", "message", "content", "output"]) {
      if (typeof parsed?.[key] === "string" && parsed[key].trim()) return parsed[key].trim();
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

async function handleAgent(req, res) {
  const raw = await readBody(req);
  const payload = raw ? JSON.parse(raw) : {};
  if (!String(payload.message || "").trim()) {
    json(res, 400, { ok: false, error: "Missing message" });
    return;
  }
  const prompt = buildPrompt(payload);
  const args = [
    "--print",
    "--output-format",
    "json",
    "--permission-mode",
    payload.clawCodePermissionMode || process.env.AGENTCORE_CLAW_CODE_PERMISSION || "workspace-write",
    prompt,
  ];
  const startedAt = Date.now();
  const result = await runClaw(args, {
    binaryPath: payload.clawCodeBinaryPath,
    cwd: payload.clawCodeWorkspace || process.env.AGENTCORE_CLAW_CODE_CWD,
    timeoutSeconds: payload.timeoutSeconds,
  });
  const finishedAt = Date.now();
  if (!result.ok) {
    json(res, 502, {
      ok: false,
      error: result.timedOut
        ? "AgentCoreOS Runtime execution timed out."
        : "AgentCoreOS Runtime is unavailable or execution failed.",
      trace: {
        engine: "claw_code",
        provider: "agentcoreos-runtime",
        model: "agentcoreos-executor",
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        attempts: [
          {
            engine: "claw_code",
            candidateKind: "primary",
            provider: "agentcoreos-runtime",
            model: "agentcoreos-executor",
            attemptNumber: 1,
            startedAt,
            finishedAt,
            durationMs: finishedAt - startedAt,
            success: false,
            error: result.stderr || result.signal || `exit ${result.code}`,
          },
        ],
      },
      raw: { code: result.code, signal: result.signal, stderr: result.stderr, bin: result.bin },
    });
    return;
  }

  json(res, 200, {
    ok: true,
    text: parseClawText(result.stdout),
    engine: "claw_code",
    raw: { stdout: result.stdout, stderr: result.stderr, bin: result.bin },
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/health") {
      const probe = await runClaw(["--version"], { timeoutSeconds: 3 });
      json(res, probe.ok ? 200 : 503, {
        ok: probe.ok,
        service: "agentcore-claw-runtime",
        mode: "claw_code_http_sidecar",
        startedAt: STARTED_AT,
        claw: {
          ok: probe.ok,
          version: probe.stdout?.trim() || null,
          error: probe.ok ? null : probe.stderr || "AgentCoreOS Runtime binary unavailable",
          bin: probe.bin,
        },
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/_agentcore/heartbeat") {
      json(res, 200, { ok: true, service: "agentcore-claw-runtime", at: new Date().toISOString() });
      return;
    }
    if (
      req.method === "POST" &&
      (url.pathname === "/api/agent/run" || url.pathname === "/api/openclaw/agent")
    ) {
      await handleAgent(req, res);
      return;
    }
    json(res, 501, {
      ok: false,
      error: "This AgentCoreOS Runtime sidecar endpoint is not implemented yet.",
      path: url.pathname,
      service: "agentcore-claw-runtime",
    });
  } catch (error) {
    json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "claw runtime sidecar error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[AgentCore OS] claw runtime sidecar listening on http://${HOST}:${PORT}`);
});
