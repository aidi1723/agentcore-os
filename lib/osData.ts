import fs from "fs";
import { OPENCLAW_OS_DATA_DIR } from "@/lib/config";

export const OS_DATA_DIR = OPENCLAW_OS_DATA_DIR;

export function ensureOsDataDir() {
  if (!fs.existsSync(OS_DATA_DIR)) fs.mkdirSync(OS_DATA_DIR, { recursive: true });
}
