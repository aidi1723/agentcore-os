import { access, chmod, copyFile, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const projectRoot = process.cwd();
  const source = path.join(projectRoot, "scripts", "desktop-runtime", "claw-runtime-sidecar.mjs");
  const distDir = path.join(projectRoot, "dist", "desktop-runtime");
  const distScript = path.join(distDir, "agentcore_claw_runtime.mjs");
  const launcherPath = path.join(
    distDir,
    `agentcore_claw_runtime${process.platform === "win32" ? ".cmd" : ""}`,
  );

  if (!(await exists(source))) {
    fail(`Missing Claw runtime sidecar source: ${source}`);
  }

  await mkdir(distDir, { recursive: true });
  await copyFile(source, distScript);

  if (process.platform === "win32") {
    await writeFile(launcherPath, `@echo off\r\nnode "%~dp0agentcore_claw_runtime.mjs" %*\r\n`, "utf8");
  } else {
    await writeFile(
      launcherPath,
      "#!/usr/bin/env sh\nexec node \"$(dirname \"$0\")/agentcore_claw_runtime.mjs\" \"$@\"\n",
      "utf8",
    );
    await chmod(launcherPath, 0o755);
  }

  console.log(`Built Claw runtime launcher: ${launcherPath}`);
  console.log("Note: final packaging/distribution validation is intentionally deferred.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Failed to build Claw runtime launcher.");
});
