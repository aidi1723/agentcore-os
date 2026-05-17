import { access } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

async function isExecutable(candidate) {
  if (!candidate) {
    return false;
  }
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findExisting(candidates) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if ((await isExecutable(candidate)) || !candidate.includes(path.sep)) {
      return candidate;
    }
  }
  return null;
}

function runIfAvailable(command, args) {
  if (!command) {
    return null;
  }
  return run(command, args);
}

async function main() {
  const projectRoot = process.cwd();
  const home = os.homedir();
  const cargo = await findExisting([
    process.env.CARGO_BIN,
    path.join(home, ".cargo", "bin", "cargo.exe"),
    path.join(home, ".cargo", "bin", "cargo"),
    process.platform === "win32" ? "cargo.exe" : "cargo",
    "cargo",
  ]);
  const rustc = await findExisting([
    process.env.RUSTC,
    path.join(home, ".cargo", "bin", "rustc.exe"),
    path.join(home, ".cargo", "bin", "rustc"),
    process.platform === "win32" ? "rustc.exe" : "rustc",
    "rustc",
  ]);
  const claw = await findExisting([
    process.env.AGENTCORE_CLAW_CODE_BIN,
    path.join(home, ".cargo", "bin", "claw.exe"),
    path.join(home, ".cargo", "bin", "claw"),
    process.platform === "win32" ? "claw.exe" : "claw",
    "claw",
  ]);

  const node = run(process.execPath, ["--version"]);
  const cargoVersion = cargo ? run(cargo, ["--version"]) : null;
  const rustcVersion = rustc ? run(rustc, ["--version"]) : null;
  const clawVersion = claw ? run(claw, ["--version"]) : null;
  const warnings = [];

  const output = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    ready: Boolean(
      node.ok
      && cargoVersion?.ok
      && rustcVersion?.ok
      && clawVersion?.ok,
    ),
    checks: {
      node: {
        ok: node.ok,
        command: process.execPath,
        version: node.stdout || null,
        error: node.stderr || node.error || null,
      },
      cargo: {
        ok: cargoVersion?.ok ?? false,
        command: cargo,
        version: cargoVersion?.stdout || null,
        error: cargoVersion && !cargoVersion.ok ? cargoVersion.stderr || cargoVersion.error || null : cargo ? null : "cargo not found",
      },
      rustc: {
        ok: rustcVersion?.ok ?? false,
        command: rustc,
        version: rustcVersion?.stdout || null,
        error: rustcVersion && !rustcVersion.ok ? rustcVersion.stderr || rustcVersion.error || null : rustc ? null : "rustc not found",
      },
      clawCode: {
        ok: clawVersion?.ok ?? false,
        command: claw,
        version: clawVersion?.stdout || clawVersion?.stderr || null,
        error: clawVersion && !clawVersion.ok ? clawVersion.stderr || clawVersion.error || null : claw ? null : "AgentCoreOS Runtime binary not found",
      },
    },
    warnings,
    nextAction:
      node.ok && cargoVersion?.ok && rustcVersion?.ok && clawVersion?.ok
        ? warnings.length > 0
          ? "This machine can build the desktop shell, but review warnings before producing release binaries."
          : "This machine can build the AgentCore OS desktop shell with AgentCoreOS Runtime as the execution base."
        : "Install the missing build tools before attempting desktop packaging.",
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Desktop build doctor failed.");
  process.exit(1);
});
