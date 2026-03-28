import type { PublishPlatformId } from "@/lib/publish";
import type { RecommendationAction, RecommendationHit, RecommendationResult } from "@/lib/recommendation-contract";

export type ChecklistStatus = "ok" | "warn" | "risk";

export type PublishChecklistItem = {
  label: string;
  detail: string;
  status: ChecklistStatus;
};

export type PlatformAdvice = {
  platform: PublishPlatformId;
  detail: string;
  status: ChecklistStatus;
};

type PublishRecommendationInput = {
  title: string;
  body: string;
  platforms: PublishPlatformId[];
  dispatchMode: "dry-run" | "dispatch";
  connections: Record<string, { token: string; webhookUrl: string }>;
};

function buildHitScore(status: ChecklistStatus) {
  switch (status) {
    case "risk":
      return 92;
    case "warn":
      return 68;
    case "ok":
    default:
      return 44;
  }
}

function buildAction(params: {
  riskCount: number;
  warnCount: number;
  dispatchMode: "dry-run" | "dispatch";
}): RecommendationAction {
  if (params.riskCount > 0) {
    return {
      kind: "improve_copy",
      label: "先修高风险项",
      rationale: "当前存在高风险项，更适合先修正文、Webhook 配置或平台适配问题，再继续发布。",
    };
  }
  if (params.warnCount > 2) {
    return {
      kind: "run_dry_run",
      label: "先做一轮预演",
      rationale: "当前还有多项需要优化的细节，建议先预演，把标题、CTA 和结构收一遍。",
    };
  }
  if (params.dispatchMode === "dispatch") {
    return {
      kind: "run_dispatch",
      label: "可以进入自动发布",
      rationale: "当前稿件和平台条件已经接近可发布状态，确认 Webhook 后即可进入自动发布。",
    };
  }
  return {
    kind: "run_dry_run",
    label: "继续做安全预演",
    rationale: "当前稿件基础不错，建议先预演确认平台差异，再决定是否自动发布。",
  };
}

function buildChecklistHits(items: PublishChecklistItem[]): RecommendationHit[] {
  return items.map((item) => ({
    kind: "publish_check",
    id: `check-${item.label}`,
    title: item.label,
    summary: item.detail,
    score: buildHitScore(item.status),
    rationale:
      item.status === "risk"
        ? "这是当前最优先修正的发布风险。"
        : item.status === "warn"
          ? "这是影响发布质量的次级问题。"
          : "这一项当前没有明显阻碍。",
    metadata: [`状态 ${item.status}`],
  }));
}

function buildPlatformHits(items: PlatformAdvice[]): RecommendationHit[] {
  return items.map((item) => ({
    kind: "platform_advice",
    id: `platform-${item.platform}`,
    title: item.platform,
    summary: item.detail,
    score: buildHitScore(item.status) + (item.status === "ok" ? 8 : 0),
    rationale:
      item.status === "ok"
        ? "当前平台适配度较高。"
        : item.status === "risk"
          ? "当前平台适配存在明显阻碍。"
          : "当前平台适配还需要进一步收口。",
    metadata: [`平台 ${item.platform}`, `状态 ${item.status}`],
  }));
}

export function analyzePublishReadiness(input: PublishRecommendationInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  const firstLine = body.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
  const bodyLength = body.length;
  const lineCount = body ? body.split(/\r?\n/).filter((line) => line.trim()).length : 0;
  const hashtagCount = (body.match(/#[\p{L}\p{N}_-]+/gu) ?? []).length;
  const hasQuestionOrNumber = /[0-9０-９一二三四五六七八九十?？!！]|为什么|别再|不要|如何|怎样|秘诀|清单|步骤|技巧/.test(
    title || firstLine,
  );
  const hasCta = /关注|评论|私信|收藏|转发|点击|了解|预约|领取|回复|下载|扫码|follow|comment|dm|link|save/i.test(body);
  const selectedPlatforms = input.platforms;
  const checks: PublishChecklistItem[] = [];

  if (!title) {
    checks.push({ label: "标题", detail: "缺少明确标题，预演和发布后的识别成本都会变高。", status: "risk" });
  } else if (title.length < 8) {
    checks.push({ label: "标题", detail: "标题偏短，建议补上结果、数字或冲突点。", status: "warn" });
  } else if (title.length > 36) {
    checks.push({ label: "标题", detail: "标题偏长，建议压到 36 字以内，方便短内容平台首屏阅读。", status: "warn" });
  } else {
    checks.push({ label: "标题", detail: "标题长度合适，适合继续做预演或派发。", status: "ok" });
  }

  if (!body) {
    checks.push({ label: "正文", detail: "正文为空，当前不能进入有效预演或发布。", status: "risk" });
  } else if (bodyLength < 90) {
    checks.push({ label: "正文", detail: "正文偏短，建议补足观点、场景或行动建议。", status: "warn" });
  } else if (bodyLength > 900) {
    checks.push({ label: "正文", detail: "正文较长，更像长文底稿，建议拆出一个短版再发。", status: "warn" });
  } else {
    checks.push({ label: "正文", detail: "正文长度适中，适合继续做平台差异检查。", status: "ok" });
  }

  if (!hasQuestionOrNumber) {
    checks.push({ label: "开场 hook", detail: "标题或首句里缺少数字、问题或强结论，吸引力偏弱。", status: "warn" });
  } else {
    checks.push({ label: "开场 hook", detail: "标题或首句已经包含明显钩子。", status: "ok" });
  }

  if (!hasCta) {
    checks.push({ label: "CTA", detail: "正文里没有明显动作指令，建议补上关注、评论、私信或领取动作。", status: "warn" });
  } else {
    checks.push({ label: "CTA", detail: "正文里已经有明确 CTA。", status: "ok" });
  }

  if (lineCount < 3) {
    checks.push({ label: "结构", detail: "段落偏少，建议拆成 3 段以上，移动端更好读。", status: "warn" });
  } else {
    checks.push({ label: "结构", detail: "段落层次够用，适合移动端阅读。", status: "ok" });
  }

  if (selectedPlatforms.some((platform) => ["xiaohongshu", "instagram", "tiktok"].includes(platform)) && hashtagCount === 0) {
    checks.push({ label: "标签", detail: "当前没有 hashtag，可按平台补 2-4 个主题标签。", status: "warn" });
  } else if (hashtagCount > 8) {
    checks.push({ label: "标签", detail: "hashtag 偏多，建议收敛到更聚焦的几个主题标签。", status: "warn" });
  } else {
    checks.push({ label: "标签", detail: "标签数量可接受。", status: "ok" });
  }

  if (
    input.dispatchMode === "dispatch" &&
    selectedPlatforms.some((platform) => !input.connections[platform]?.webhookUrl?.trim())
  ) {
    checks.push({
      label: "自动发布配置",
      detail: "部分已选平台没有 Webhook，当前更适合先做预演或切成手动发布清单。",
      status: "risk",
    });
  } else if (input.dispatchMode === "dispatch") {
    checks.push({
      label: "自动发布配置",
      detail: "已选平台的自动发布条件基本齐备。",
      status: "ok",
    });
  } else {
    checks.push({
      label: "自动发布配置",
      detail: "当前是预演模式，适合先看平台差异和文案质量。",
      status: "ok",
    });
  }

  const platformAdvice = selectedPlatforms.map<PlatformAdvice>((platform) => {
    if (platform === "xiaohongshu") {
      if (bodyLength < 120) {
        return { platform, status: "warn", detail: "适合补一点场景感、步骤感或个人经验，再去小红书更稳。" };
      }
      return { platform, status: "ok", detail: "结构和长度基本适合做小红书预演，注意封面标题和分段节奏。" };
    }
    if (platform === "douyin" || platform === "tiktok") {
      if (!hasQuestionOrNumber || bodyLength > 260) {
        return { platform, status: "warn", detail: "更像长帖，不像口播脚本。建议压短并把 hook 放到第一句。" };
      }
      return { platform, status: "ok", detail: "具备短视频脚本基础，可以直接预演短口播版本。" };
    }
    if (platform === "instagram") {
      if (lineCount < 3) {
        return { platform, status: "warn", detail: "建议增加换行和标签，让 caption 更像 Instagram 贴文。" };
      }
      return { platform, status: "ok", detail: "caption 结构基本可用，适合继续调语气和标签。" };
    }
    return { platform, status: "warn", detail: "该平台还不是当前第一梯队接入，建议先作为保留位处理。" };
  });

  const scorePenalty = checks.reduce((sum, item) => sum + (item.status === "risk" ? 18 : item.status === "warn" ? 8 : 0), 0);
  const score = Math.max(32, 100 - scorePenalty);
  const riskCount = checks.filter((item) => item.status === "risk").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;
  const recommendedAction = buildAction({
    riskCount,
    warnCount,
    dispatchMode: input.dispatchMode,
  });

  return {
    score,
    recommendation: recommendedAction.rationale,
    checks,
    platformAdvice,
    recommendationResult: {
      contractVersion: "v1",
      query: title || firstLine || "publisher-readiness",
      sections: [
        {
          id: "publish_checks",
          label: "发布检查",
          hits: buildChecklistHits(checks),
        },
        {
          id: "platform_fit",
          label: "平台适配",
          hits: buildPlatformHits(platformAdvice),
        },
      ],
      recommendedAction,
    } satisfies RecommendationResult,
  };
}
