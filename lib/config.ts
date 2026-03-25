import path from "path";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export const OPENCLAW_HOME =
  readEnv("OPENCLAW_HOME") || path.join(process.env.HOME || "", ".openclaw");

export const OPENCLAW_WORKSPACE =
  readEnv("OPENCLAW_WORKSPACE") || path.join(OPENCLAW_HOME, "workspace");

export const OPENCLAW_OS_DATA_DIR =
  readEnv("OPENCLAW_OS_DATA_DIR") || path.join(OPENCLAW_WORKSPACE, "openclaw-os-data");

export const OPENCLAW_TASKBOARD_UI_URL =
  readEnv("OPENCLAW_TASKBOARD_UI_URL") || "http://127.0.0.1:5173/taskboard/index.html";
