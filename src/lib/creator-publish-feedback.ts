import type { PublishJobResult, PublishJobStatus, PublishPlatformId } from "@/lib/publish";

function firstNonEmptyLine(text?: string) {
  return (
    text
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function hasStrongHook(text: string) {
  return /[0-9０-９一二三四五六七八九十?？!！]|为什么|别再|不要|如何|怎样|秘诀|清单|步骤|技巧/.test(text);
}

function hasCallToAction(text: string) {
  return /关注|评论|私信|收藏|转发|点击|了解|预约|领取|回复|下载|扫码|follow|comment|dm|link|save/i.test(text);
}

function summarizeResult(result: PublishJobResult) {
  const parts: string[] = [result.platform];
  if (result.mode === "manual") {
    parts.push("手动清单");
  } else if (!result.ok) {
    parts.push("connector 失败");
  } else if (result.queued) {
    parts.push("已接收并排队");
  } else {
    parts.push("已接收");
  }
  if (typeof result.retryable === "boolean") {
    parts.push(result.retryable ? "可重试" : "终局");
  }
  if (result.errorType) {
    parts.push(`错误类型 ${result.errorType}`);
  }
  if (result.receiptId) {
    parts.push(`收据 ${result.receiptId}`);
  }
  if (result.error) {
    parts.push(result.error);
  } else if (result.message) {
    parts.push(result.message);
  }
  return parts.join(" / ");
}

function uniquePlatforms(values: PublishPlatformId[]) {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function summarizeStructuredFeedback(params: {
  successPlatforms: PublishPlatformId[];
  failedPlatforms: PublishPlatformId[];
  retryablePlatforms: PublishPlatformId[];
  manualPlatforms: PublishPlatformId[];
  results: PublishJobResult[];
}) {
  const parts: string[] = [];
  if (params.successPlatforms.length > 0) {
    parts.push(`已接收: ${params.successPlatforms.join(" / ")}`);
  }
  if (params.failedPlatforms.length > 0) {
    parts.push(`失败: ${params.failedPlatforms.join(" / ")}`);
  }
  if (params.retryablePlatforms.length > 0) {
    parts.push(`可重试: ${params.retryablePlatforms.join(" / ")}`);
  }
  if (params.manualPlatforms.length > 0) {
    parts.push(`人工清单: ${params.manualPlatforms.join(" / ")}`);
  }
  if (parts.length === 0 && params.results.length === 0) {
    return "当前还没有 connector 回执。";
  }
  return parts.join(" | ");
}

function buildPatternLines(params: {
  title: string;
  body: string;
  publishTargets: PublishPlatformId[];
  results: PublishJobResult[];
  primaryAngle?: string;
  blockLabel?: string;
  publishNotes?: string;
}) {
  const lines: string[] = [];
  const successPlatforms = params.results
    .filter((item) => item.ok)
    .map((item) => item.platform);
  const manualPlatforms = params.results
    .filter((item) => item.mode === "manual")
    .map((item) => item.platform);
  const authFailures = params.results
    .filter((item) => item.errorType === "auth")
    .map((item) => item.platform);

  if (params.blockLabel) {
    lines.push(`本轮最可复用的是「${params.blockLabel}」版本，不必每次整包一起进入发布。`);
  }
  if (params.primaryAngle) {
    lines.push(`优先保留「${params.primaryAngle}」这个核心角度，后续平台改写不要偏离主结论。`);
  }
  if (hasStrongHook(params.title)) {
    lines.push("标题已经具备数字/问题/强结论 hook，下一轮复用时应尽量保留这个开场力度。");
  }
  if (hasCallToAction(params.body)) {
    lines.push("正文已有明确 CTA，说明当前版本适合继续沿用“结论后立刻给动作”的收尾结构。");
  }
  if (successPlatforms.some((platform) => platform === "douyin" || platform === "tiktok")) {
    lines.push("短视频平台优先保留短 hook + 3 点结构 + 明确 CTA，不要回退成长文腔。");
  }
  if (successPlatforms.some((platform) => platform === "xiaohongshu" || platform === "instagram")) {
    lines.push("图文平台优先保留分段、列表感和主题标签，不要只剩单段口播稿。");
  }
  if (manualPlatforms.length > 0) {
    lines.push(`这些平台当前仍是人工清单：${manualPlatforms.join(" / ")}。不要把它们误判成自动闭环。`);
  }
  if (authFailures.length > 0) {
    lines.push(`这些平台先修复授权再复用发布模板：${authFailures.join(" / ")}。`);
  }
  if (params.publishNotes) {
    lines.push(`发布备注：${params.publishNotes}`);
  }
  if (lines.length === 0) {
    lines.push("这一轮先保留当前稿件结构，下一轮优先复用标题 hook、首段结论和最后 CTA。");
  }
  return lines;
}

export function buildCreatorPublishStatus(params: {
  dispatchMode: "dry-run" | "dispatch";
  jobStatus?: PublishJobStatus;
}) {
  const prefix = params.dispatchMode === "dispatch" ? "dispatch" : "dry_run";
  switch (params.jobStatus) {
    case "running":
      return `${prefix}_running`;
    case "done":
      return `${prefix}_done`;
    case "error":
      return `${prefix}_error`;
    case "stopped":
      return `${prefix}_stopped`;
    case "queued":
    default:
      return `${prefix}_queued`;
  }
}

export function buildCreatorPublishFeedback(params: {
  draftTitle: string;
  draftBody?: string;
  dispatchMode: "dry-run" | "dispatch";
  jobStatus?: PublishJobStatus;
  publishTargets: PublishPlatformId[];
  results?: PublishJobResult[] | null;
  primaryAngle?: string;
  blockLabel?: string;
  publishNotes?: string;
  reviewedAt?: number;
}) {
  const title = params.draftTitle.trim() || "未命名稿件";
  const body = params.draftBody?.trim() ?? "";
  const results = Array.isArray(params.results) ? params.results : [];
  const successfulPlatforms = uniquePlatforms(
    results.filter((item) => item.ok).map((item) => item.platform),
  );
  const failedPlatforms = uniquePlatforms(
    results.filter((item) => !item.ok).map((item) => item.platform),
  );
  const retryablePlatforms = uniquePlatforms(
    results.filter((item) => item.retryable).map((item) => item.platform),
  );
  const manualPlatforms = uniquePlatforms(
    results.filter((item) => item.mode === "manual").map((item) => item.platform),
  );
  const status = buildCreatorPublishStatus({
    dispatchMode: params.dispatchMode,
    jobStatus: params.jobStatus,
  });

  const nextAction =
    params.jobStatus === "done"
      ? "基于当前平台回执复盘有效结构，然后完成本轮内容闭环。"
      : params.jobStatus === "error"
        ? "先处理失败平台的授权或 connector 问题，再决定是否重新排队。"
        : params.dispatchMode === "dispatch"
          ? "等待 connector 回执补齐，再确认哪些结构值得继续复用。"
          : "先看预演结果，确认平台差异后再决定是否自动发布。";

  const lines = [
    "【本轮发布反馈】",
    `- 稿件：${title}`,
    params.blockLabel ? `- 版本：${params.blockLabel}` : "",
    params.primaryAngle ? `- 主打角度：${params.primaryAngle}` : "",
    params.publishTargets.length ? `- 平台：${params.publishTargets.join(" / ")}` : "",
    firstNonEmptyLine(body) ? `- 开场：${firstNonEmptyLine(body)}` : "",
    "",
    "【平台回执】",
    ...(results.length > 0 ? results.map((result) => `- ${summarizeResult(result)}`) : ["- 当前还没有 connector 回执。"]),
    "",
    "【下一轮可复用】",
    ...buildPatternLines({
      title,
      body,
      publishTargets: params.publishTargets,
      results,
      primaryAngle: params.primaryAngle,
      blockLabel: params.blockLabel,
      publishNotes: params.publishNotes,
    }).map((line) => `- ${line}`),
  ].filter(Boolean);

  return {
    publishStatus: status,
    latestPublishFeedback: summarizeStructuredFeedback({
      successPlatforms: successfulPlatforms,
      failedPlatforms,
      retryablePlatforms,
      manualPlatforms,
      results,
    }),
    successfulPlatforms,
    failedPlatforms,
    retryablePlatforms,
    nextAction,
    reuseNotes: lines.join("\n"),
    lastReviewedAt: params.reviewedAt,
  };
}
