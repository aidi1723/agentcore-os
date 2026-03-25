import fs from "fs/promises";
import path from "path";
import { ensureOsDataDir, OS_DATA_DIR } from "./osData";

export const SOCIAL_OPS_PLATFORMS = ["TikTok", "YouTube Shorts"] as const;
export const SOCIAL_OPS_ASPECTS = ["9:16", "1:1", "16:9"] as const;
export const SOCIAL_OPS_LANGUAGES = ["en", "zh", "bilingual"] as const;

export type SocialOpsPlatform = (typeof SOCIAL_OPS_PLATFORMS)[number];
export type SocialOpsAspect = (typeof SOCIAL_OPS_ASPECTS)[number];
export type SocialOpsLanguage = (typeof SOCIAL_OPS_LANGUAGES)[number];

export type SocialOpsConfig = {
  defaultPlatforms: SocialOpsPlatform[];
  defaultAspect: SocialOpsAspect;
  defaultLanguage: SocialOpsLanguage;
  safety: {
    publishEnabled: boolean;
  };
};

export type SocialOpsRun = {
  ts: number;
  id: string;
  ok: boolean;
  durationMs: number;
  mode: "mock";
  inputs: {
    platforms: SocialOpsPlatform[];
    aspect: SocialOpsAspect;
    language: SocialOpsLanguage;
    topic: string;
  };
  outputs: {
    script: string;
    shotlist: string;
    captions: string;
  };
  error?: string;
};

const CONFIG_PATH = path.join(OS_DATA_DIR, "social_ops_config.json");
const RUNS_PATH = path.join(OS_DATA_DIR, "social_ops_runs.jsonl");
const DEFAULT_CONFIG: SocialOpsConfig = {
  defaultPlatforms: ["TikTok", "YouTube Shorts"],
  defaultAspect: "9:16",
  defaultLanguage: "en",
  safety: { publishEnabled: false },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlatform(value: unknown): value is SocialOpsPlatform {
  return typeof value === "string" && SOCIAL_OPS_PLATFORMS.includes(value as SocialOpsPlatform);
}

function isAspect(value: unknown): value is SocialOpsAspect {
  return typeof value === "string" && SOCIAL_OPS_ASPECTS.includes(value as SocialOpsAspect);
}

function isLanguage(value: unknown): value is SocialOpsLanguage {
  return typeof value === "string" && SOCIAL_OPS_LANGUAGES.includes(value as SocialOpsLanguage);
}

export function getDefaultSocialOpsConfig(): SocialOpsConfig {
  return {
    defaultPlatforms: [...DEFAULT_CONFIG.defaultPlatforms],
    defaultAspect: DEFAULT_CONFIG.defaultAspect,
    defaultLanguage: DEFAULT_CONFIG.defaultLanguage,
    safety: { publishEnabled: DEFAULT_CONFIG.safety.publishEnabled },
  };
}

export function normalizeSocialOpsConfig(value: unknown): SocialOpsConfig {
  if (!isObject(value)) throw new Error("Config must be an object");

  const { defaultPlatforms, defaultAspect, defaultLanguage, safety } = value;

  if (!Array.isArray(defaultPlatforms) || !defaultPlatforms.length) {
    throw new Error("defaultPlatforms must be a non-empty array");
  }

  const normalizedPlatforms = Array.from(new Set(defaultPlatforms));
  if (!normalizedPlatforms.every(isPlatform)) {
    throw new Error(`defaultPlatforms must only contain: ${SOCIAL_OPS_PLATFORMS.join(", ")}`);
  }

  if (!isAspect(defaultAspect)) {
    throw new Error(`defaultAspect must be one of: ${SOCIAL_OPS_ASPECTS.join(", ")}`);
  }

  if (!isLanguage(defaultLanguage)) {
    throw new Error(`defaultLanguage must be one of: ${SOCIAL_OPS_LANGUAGES.join(", ")}`);
  }

  if (!isObject(safety) || typeof safety.publishEnabled !== "boolean") {
    throw new Error("safety.publishEnabled must be a boolean");
  }

  return {
    defaultPlatforms: normalizedPlatforms,
    defaultAspect,
    defaultLanguage,
    safety: { publishEnabled: safety.publishEnabled },
  };
}

export async function readConfig(): Promise<SocialOpsConfig> {
  ensureOsDataDir();

  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return normalizeSocialOpsConfig(JSON.parse(raw));
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      const def = getDefaultSocialOpsConfig();
      await fs.writeFile(CONFIG_PATH, JSON.stringify(def, null, 2) + "\n", "utf8");
      return def;
    }
    throw error;
  }
}

export async function writeConfig(cfg: SocialOpsConfig) {
  ensureOsDataDir();
  const normalized = normalizeSocialOpsConfig(cfg);
  await fs.writeFile(CONFIG_PATH, JSON.stringify(normalized, null, 2) + "\n", "utf8");
}

export async function appendRun(run: SocialOpsRun) {
  ensureOsDataDir();
  await fs.appendFile(RUNS_PATH, JSON.stringify(run) + "\n", "utf8");
}

export async function readRuns(limit = 50): Promise<SocialOpsRun[]> {
  ensureOsDataDir();

  try {
    const lines = (await fs.readFile(RUNS_PATH, "utf8"))
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const tail = lines.slice(-Math.max(1, limit));
    const out: SocialOpsRun[] = [];
    for (const l of tail) {
      try {
        out.push(JSON.parse(l) as SocialOpsRun);
      } catch {
        // ignore invalid JSONL lines
      }
    }
    return out.reverse();
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw error;
  }
}
