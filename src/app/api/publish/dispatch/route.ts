import { NextResponse } from "next/server";
import { runOpenClawAgent } from "@/lib/openclaw-cli";

export const runtime = "nodejs";

type Platform =
  | "xiaohongshu"
  | "douyin"
  | "wechat"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "storefront";

function uniqPlatforms(input: unknown): Platform[] {
  const supported = new Set<Platform>([
    "xiaohongshu",
    "douyin",
    "wechat",
    "tiktok",
    "instagram",
    "twitter",
    "linkedin",
    "storefront",
  ]);
  if (!Array.isArray(input)) return [];
  const out: Platform[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const id = v.trim() as Platform;
    if (!supported.has(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function platformHint(id: Platform) {
  switch (id) {
    case "xiaohongshu":
      return "小红书：标题 15–25 字；正文多分段；3–8 个 #话题；可加 Emoji。";
    case "douyin":
      return "抖音：前三秒钩子；口播短句；字幕要点；结尾引导关注/评论。";
    case "wechat":
      return "公众号：结构化小标题；引用数据/观点；结尾行动建议。";
    case "tiktok":
      return "TikTok：强钩子 + 快节奏；口语化；单屏字幕；CTA。";
    case "instagram":
      return "Instagram：短段落/列表；封面标题；3–10 个 hashtag。";
    case "twitter":
      return "X(Twitter)：一句结论 + 1–3 条要点；可拆 thread。";
    case "linkedin":
      return "LinkedIn：专业语气；案例/方法论；结尾提问互动。";
    case "storefront":
      return "独立站：产品利益点；FAQ；CTA（下单/咨询）；SEO 关键词。";
  }
}

function extractHashtags(text: string, max = 10) {
  const tags = new Set<string>();
  const re = /#([A-Za-z0-9_\u4e00-\u9fff]{1,40})/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec(text))) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    tags.add(`#${raw}`);
    if (tags.size >= max) break;
  }
  return Array.from(tags);
}

function truncate(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(1, n - 1))}…`;
}

function fallbackVariants(params: { title: string; body: string; platforms: Platform[] }) {
  const baseTags = extractHashtags(`${params.title}\n${params.body}`, 8);
  const v: Record<string, { title: string; body: string; hashtags: string[]; checklist: string[] }> = {};
  for (const p of params.platforms) {
    const checklist = [platformHint(p), "合规：避免夸大/虚假承诺；如涉及对比/功效加证据。", "排版：适当空行、表情、要点列表；首段尽量短。"];
    if (p === "douyin" || p === "tiktok") {
      v[p] = {
        title: truncate(params.title, 18),
        body:
          "【开场钩子】\n" +
          truncate(params.body, 60) +
          "\n\n【口播要点】\n- 要点 1\n- 要点 2\n- 要点 3\n\n【结尾】关注我，评论区发你清单。",
        hashtags: baseTags,
        checklist,
      };
      continue;
    }
    if (p === "instagram") {
      v[p] = {
        title: truncate(params.title, 40),
        body: `${params.body}\n\n${baseTags.join(" ")}`.trim(),
        hashtags: baseTags,
        checklist,
      };
      continue;
    }
    v[p] = {
      title: truncate(params.title, 28),
      body: params.body,
      hashtags: baseTags,
      checklist,
    };
  }
  return v;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | {
          title?: string;
          body?: string;
          platforms?: unknown;
          dryRun?: boolean;
          connections?: Record<string, { token?: string; webhookUrl?: string }>;
          timeoutSeconds?: number;
        };

    const title = String(body?.title ?? "").trim();
    const content = String(body?.body ?? "").trim();
    const platforms = uniqPlatforms(body?.platforms);
    if (!title || !content) {
      return NextResponse.json({ ok: false, error: "缺少 title/body" }, { status: 400 });
    }
    if (platforms.length === 0) {
      return NextResponse.json({ ok: false, error: "请选择至少一个平台" }, { status: 400 });
    }

    const dryRun = body?.dryRun !== false;
    const connections = body?.connections && typeof body.connections === "object" ? body.connections : {};
    const timeoutSeconds =
      typeof body?.timeoutSeconds === "number" && Number.isFinite(body.timeoutSeconds)
        ? Math.max(10, Math.min(180, Math.floor(body.timeoutSeconds)))
        : 50;

    const checklist = platforms.map((p, idx) => `${idx + 1}. ${platformHint(p)}`).join("\n");

    const openclawMessage =
      "你是社媒发布助手。用户给你一份『原始内容』与『目标平台列表』。\n" +
      "你的任务：为每个平台生成可直接发布的版本，并给出检查清单。\n" +
      "要求：只输出严格 JSON（不要代码块、不要解释）。\n" +
      "JSON schema:\n" +
      "{\n" +
      '  "variants": {\n' +
      '    "<platform>": { "title": string, "body": string, "hashtags": string[], "checklist": string[] }\n' +
      "  }\n" +
      "}\n\n" +
      `平台列表：${platforms.join(", ")}\n` +
      `原始标题：${title}\n` +
      `原始内容：\n${content}\n\n` +
      "平台偏好提示：\n" +
      checklist;

    const openclaw =
      body?.timeoutSeconds === 0
        ? ({ ok: false, error: "OpenClaw skipped", raw: null } as const)
        : await runOpenClawAgent({
            sessionId: `webos-publish-${dryRun ? "dry" : "dispatch"}`,
            message: openclawMessage,
            timeoutSeconds,
          });

    const variantsText = openclaw.ok ? openclaw.text : "";
    let variantsJson: any = null;
    try {
      variantsJson = variantsText ? JSON.parse(variantsText) : null;
    } catch {
      variantsJson = null;
    }

    const variants = (variantsJson?.variants && typeof variantsJson.variants === "object")
      ? (variantsJson.variants as Record<string, any>)
      : fallbackVariants({ title, body: content, platforms });

    const actions = platforms.map((p) => {
      const conn = (connections as any)?.[p] as undefined | { token?: string; webhookUrl?: string };
      const webhookUrl = String(conn?.webhookUrl ?? "").trim();
      const token = String(conn?.token ?? "").trim();
      return {
        platform: p,
        mode: webhookUrl ? "webhook" : "manual",
        connected: Boolean(token),
        webhookUrlConfigured: Boolean(webhookUrl),
      } as const;
    });

    const text =
      `【发布${dryRun ? "预演" : "请求"}】\n` +
      `标题：${title}\n` +
      `平台：${platforms.join(", ")}\n\n` +
      `【内容】\n${content}\n\n` +
      `【平台建议】\n${checklist}\n\n` +
      "说明：若配置了平台 Webhook，将触发自动发布；否则返回手动发布清单。";

    if (dryRun) {
      return NextResponse.json(
        { ok: true, mode: "dry-run", dryRun, platforms, actions, text, variants, openclaw },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Dispatch: call platform webhooks (if configured). This is intentionally
    // "bring-your-own-connector" to avoid embedding fragile/ToS-violating automation.
    const results: Array<{
      platform: Platform;
      ok: boolean;
      mode: "webhook" | "manual";
      status?: number;
      responseText?: string;
      error?: string;
    }> = [];

    for (const p of platforms) {
      const conn = (connections as any)?.[p] as undefined | { token?: string; webhookUrl?: string };
      const webhookUrl = String(conn?.webhookUrl ?? "").trim();
      const token = String(conn?.token ?? "").trim();
      const variant = variants?.[p] ?? null;
      const payload = {
        platform: p,
        title: String(variant?.title ?? title),
        body: String(variant?.body ?? content),
        hashtags: Array.isArray(variant?.hashtags) ? variant.hashtags : [],
        token,
        dryRun: false,
      };

      if (!webhookUrl) {
        results.push({ platform: p, ok: true, mode: "manual", responseText: "未配置 Webhook，已返回手动发布清单。" });
        continue;
      }

      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseText = await res.text().catch(() => "");
        results.push({
          platform: p,
          ok: res.ok,
          mode: "webhook",
          status: res.status,
          responseText: responseText.slice(0, 20_000),
          error: res.ok ? undefined : `Webhook 返回失败状态：${res.status}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "请求异常";
        results.push({ platform: p, ok: false, mode: "webhook", error: message });
      }
    }

    const allOk = results.every((r) => r.ok);
    return NextResponse.json(
      {
        ok: allOk,
        mode: "dispatch",
        dryRun: false,
        platforms,
        actions,
        text,
        variants,
        results,
        openclaw,
      },
      { status: allOk ? 200 : 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
