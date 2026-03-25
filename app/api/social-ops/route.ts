import { NextResponse } from "next/server";
import {
  appendRun,
  readConfig,
  readRuns,
  writeConfig,
  type SocialOpsAspect,
  type SocialOpsLanguage,
  type SocialOpsPlatform,
  normalizeSocialOpsConfig,
} from "@/lib/socialOpsStore";

export const runtime = "nodejs";

function randId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function badRequest(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTopic(value: unknown) {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new Error("inputs.topic must be a string");

  const topic = value.trim();
  if (topic.length > 200) throw new Error("inputs.topic must be 200 chars or fewer");
  return topic;
}

function validatePlatforms(value: unknown, fallback: SocialOpsPlatform[]): SocialOpsPlatform[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || !value.length) {
    throw new Error("inputs.platforms must be a non-empty array");
  }

  const allowed = new Set<SocialOpsPlatform>(["TikTok", "YouTube Shorts"]);
  const platforms = Array.from(new Set(value));
  if (
    !platforms.every(
      (item): item is SocialOpsPlatform =>
        typeof item === "string" && allowed.has(item as SocialOpsPlatform),
    )
  ) {
    throw new Error("inputs.platforms must only contain: TikTok, YouTube Shorts");
  }

  return platforms;
}

function validateAspect(value: unknown, fallback: SocialOpsAspect): SocialOpsAspect {
  if (value === undefined) return fallback;
  if (value !== "9:16" && value !== "1:1" && value !== "16:9") {
    throw new Error("inputs.aspect must be one of: 9:16, 1:1, 16:9");
  }
  return value;
}

function validateLanguage(value: unknown, fallback: SocialOpsLanguage): SocialOpsLanguage {
  if (value === undefined) return fallback;
  if (value !== "en" && value !== "zh" && value !== "bilingual") {
    throw new Error("inputs.language must be one of: en, zh, bilingual");
  }
  return value;
}

export async function GET() {
  try {
    const [cfg, runs] = await Promise.all([readConfig(), readRuns(20)]);
    return NextResponse.json({ ok: true, cfg, runs });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = (await req.json()) as {
      action?: unknown;
      config?: unknown;
      inputs?: unknown;
    };

    if (!isObject(rawBody)) return badRequest("Body must be a JSON object");
    if (rawBody.action !== "saveConfig" && rawBody.action !== "mockRun") {
      return badRequest("action must be one of: saveConfig, mockRun", 422);
    }

    if (rawBody.action === "saveConfig") {
      const config = normalizeSocialOpsConfig(rawBody.config);
      await writeConfig(config);
      return NextResponse.json({ ok: true, cfg: config });
    }

    const start = Date.now();
    const cfg = await readConfig();
    if (rawBody.inputs !== undefined && !isObject(rawBody.inputs)) {
      return badRequest("inputs must be an object");
    }

    const inputs: Record<string, unknown> = rawBody.inputs && isObject(rawBody.inputs) ? rawBody.inputs : {};
    const topic = validateTopic(inputs.topic) || "(untitled)";
    const platforms = validatePlatforms(inputs.platforms, cfg.defaultPlatforms);
    const aspect = validateAspect(inputs.aspect, cfg.defaultAspect);
    const language = validateLanguage(inputs.language, cfg.defaultLanguage);

    const script = `VO (${language}):\n- Hook: ${topic}\n- 3 key points\n- CTA: DM for quote / details`;
    const shotlist = [
      `0-2s: Product macro close-up (no faces), on-screen title`,
      `2-7s: Detail shots + quick spec overlays`,
      `7-13s: Feature proof / angles / hardware details`,
      `13-15s: CTA + contact`,
    ].join("\n");
    const captions = [
      `Hook: ${topic}`,
      `Specs: customizable sizes / colors / hardware`,
      `Fast quote: send dimensions + quantity + destination`,
    ].join("\n");

    const run = {
      ts: start,
      id: randId(),
      ok: true,
      durationMs: Date.now() - start,
      mode: "mock" as const,
      inputs: { platforms, aspect, language, topic },
      outputs: { script, shotlist, captions },
    };
    await appendRun(run);

    return NextResponse.json({ ok: true, run, publishEnabled: cfg.safety.publishEnabled });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status =
      message.includes("must ") || message.includes("chars or fewer") || message.includes("Config")
        ? 422
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
