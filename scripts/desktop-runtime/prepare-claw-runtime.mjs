import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const PROJECT_ROOT = process.cwd();

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(scriptPath)} terminated by signal: ${signal}`));
        return;
      }
      if ((code ?? 0) !== 0) {
        reject(new Error(`${path.basename(scriptPath)} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function ensureExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    fail(`Expected Claw runtime artifact was not produced: ${filePath}`);
  }
}

async function main() {
  const buildScript = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "build-claw-runtime.mjs");
  const stageScript = path.join(PROJECT_ROOT, "scripts", "desktop-runtime", "stage-claw-runtime.mjs");
  const runtimeDistPath = path.join(
    PROJECT_ROOT,
    "dist",
    "desktop-runtime",
    `agentcore_claw_runtime${process.platform === "win32" ? ".cmd" : ""}`,
  );

  await runNodeScript(buildScript);
  await ensureExists(runtimeDistPath);
  await runNodeScript(stageScript, [runtimeDistPath]);

  console.log(`Prepared Claw runtime for desktop packaging: ${runtimeDistPath}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to prepare Claw runtime.");
});
