import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

import type { DesktopRuntimeProfile } from "@/lib/settings";

export type RuntimeDoctorCheck = {
  ok: boolean;
  version: string | null;
  error: string | null;
};

export type RuntimeDoctorReport = {
  runtimeMode: "api_only";
  checkedAt: string;
  recommendedProfile: DesktopRuntimeProfile;
  checks: {
    node: RuntimeDoctorCheck;
    clawCode: RuntimeDoctorCheck;
    ffmpeg: RuntimeDoctorCheck;
    docker: RuntimeDoctorCheck;
    dockerCompose: RuntimeDoctorCheck;
    runtimeTemplate: RuntimeDoctorCheck;
    localStore: RuntimeDoctorCheck;
  };
  readiness: {
    desktopLightReady: boolean;
    desktopDifyReady: boolean;
    creativeStudioReady: boolean;
  };
  nextAction: string;
};

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

function parseNodeMajor(version: string) {
  const match = version.match(/^v?(\d+)/);
  return match ? Number(match[1]) : null;
}

function probeClawCode(): RuntimeDoctorCheck {
  const candidates = [
    process.env.AGENTCORE_CLAW_CODE_BIN,
    path.join(process.env.HOME ?? "", ".cargo", "bin", process.platform === "win32" ? "claw.exe" : "claw"),
    process.platform === "win32" ? "claw.exe" : "claw",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const probe = run(candidate, ["--version"]);
    if (probe.ok) {
      return {
        ok: true,
        version: probe.stdout || candidate,
        error: null,
      };
    }
  }

  return {
    ok: false,
    version: null,
    error:
      "AgentCoreOS Runtime binary not found. Install or package AgentCoreOS Runtime and set AGENTCORE_CLAW_CODE_BIN, or add the runtime binary to PATH.",
  };
}

function probeRuntimeTemplate(): RuntimeDoctorCheck {
  const templatePath = path.join(
    process.cwd(),
    "deploy",
    "desktop-runtime",
    "docker-compose.agentcore-runtime.example.yml",
  );
  return existsSync(templatePath)
    ? { ok: true, version: templatePath, error: null }
    : { ok: false, version: null, error: `Missing runtime template: ${templatePath}` };
}

function probeLocalStore(): RuntimeDoctorCheck {
  const targetDir = path.join(process.cwd(), ".openclaw-data");
  const probeFile = path.join(targetDir, ".doctor-write-test");
  try {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(probeFile, "ok", "utf8");
    rmSync(probeFile, { force: true });
    return { ok: true, version: targetDir, error: null };
  } catch (error) {
    return {
      ok: false,
      version: null,
      error: error instanceof Error ? error.message : "Local store is not writable.",
    };
  }
}

export function getRuntimeDoctorReport(): RuntimeDoctorReport {
  const docker = run("docker", ["--version"]);
  const dockerCompose = docker.ok
    ? run("docker", ["compose", "version"])
    : { ok: false, stdout: "", stderr: "", error: "" };
  const node = run(process.execPath, ["--version"]);
  const nodeMajor = parseNodeMajor(node.stdout);
  const nodeSupported = node.ok && nodeMajor !== null && nodeMajor >= 20 && nodeMajor < 25;
  const clawCode = probeClawCode();
  const ffmpeg = run("ffmpeg", ["-version"]);
  const runtimeTemplate = probeRuntimeTemplate();
  const localStore = probeLocalStore();
  const desktopLightReady = localStore.ok && clawCode.ok;
  const desktopDifyReady =
    localStore.ok && runtimeTemplate.ok && docker.ok && dockerCompose.ok;
  const creativeStudioReady = ffmpeg.ok;

  return {
    runtimeMode: "api_only",
    checkedAt: new Date().toISOString(),
    recommendedProfile: desktopDifyReady ? "desktop_dify" : "desktop_light",
    checks: {
      node: {
        ok: nodeSupported,
        version: node.stdout || null,
        error: nodeSupported
          ? null
          : node.stderr || node.error || "Node.js must be >=20 and <25.",
      },
      clawCode,
      ffmpeg: {
        ok: ffmpeg.ok,
        version: ffmpeg.stdout.split("\n")[0]?.trim() || null,
        error: ffmpeg.stderr || ffmpeg.error || null,
      },
      docker: {
        ok: docker.ok,
        version: docker.stdout || null,
        error: docker.stderr || docker.error || null,
      },
      dockerCompose: {
        ok: dockerCompose.ok,
        version: dockerCompose.stdout || null,
        error: dockerCompose.stderr || dockerCompose.error || null,
      },
      runtimeTemplate,
      localStore,
    },
    readiness: {
      desktopLightReady,
      desktopDifyReady,
      creativeStudioReady,
    },
    nextAction: !desktopLightReady
      ? !localStore.ok
        ? "Fix local storage permissions first. The desktop app needs a writable local data directory before first-run testing."
        : "Install or configure AgentCoreOS Runtime before running task execution. Set AGENTCORE_CLAW_CODE_BIN or add the runtime binary to PATH."
      : desktopDifyReady
        ? creativeStudioReady
          ? "This machine is ready for full desktop testing with AgentCoreOS Runtime execution, Desktop + Dify Runtime, and Creative Studio local video processing."
          : "This machine can run the full desktop stack with AgentCoreOS Runtime execution. Install ffmpeg only if you need Creative Studio local video processing."
        : creativeStudioReady
          ? "This machine can run Desktop Light mode with AgentCoreOS Runtime execution. Install Docker Desktop only if you need local Dify orchestration."
          : "This machine can run most workflows in Desktop Light mode with AgentCoreOS Runtime execution. Install ffmpeg for Creative Studio, and Docker Desktop only if you need local Dify orchestration.",
  };
}
