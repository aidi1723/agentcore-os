import { NextResponse } from "next/server";

type Style = "xiaohongshu" | "wechat" | "shortvideo";

function pick<T>(arr: T[], seed: number) {
  return arr[Math.abs(seed) % arr.length]!;
}

function seedFrom(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function splitPoints(input: string) {
  const raw = input
    .split(/[\n，,。.!！?？;；、]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (raw.length === 0) return [input.trim()].filter(Boolean);
  return raw.slice(0, 6);
}

function genXhs(topic: string) {
  const seed = seedFrom(`xhs:${topic}`);
  const points = splitPoints(topic);
  const hooks = ["我真的后悔没早点知道", "太离谱了…", "不允许还有人不知道", "今天必须安利"];
  const titles = [
    `🔥 ${pick(hooks, seed)}：${points[0] ?? topic}`,
    `💡 ${points[0] ?? topic}｜一看就会的实用思路`,
    `✨ ${points[0] ?? topic} 真实体验：值得吗？`,
  ];
  const emojis = ["✨", "💡", "🔥", "✅", "📌", "🧩", "🚀", "🫶"];
  const body = [
    `【标题】\n${titles.map((t) => `- ${t}`).join("\n")}`,
    "",
    `【正文】\n${pick(emojis, seed + 1)} 先说结论：${points[0] ?? topic}，真的很适合「想快速见效」的人。\n`,
    points.map((p, i) => `${pick(emojis, seed + 10 + i)} 卖点 ${i + 1}：${p}`).join("\n"),
    "",
    `【怎么用/怎么选】\n${pick(emojis, seed + 2)} 场景：___\n${pick(emojis, seed + 3)} 人群：___\n${pick(emojis, seed + 4)} 建议：先从 ___ 开始`,
    "",
    `【结尾】\n${pick(emojis, seed + 5)} 想要我把它写成“更狠”的版本（更强钩子/更强转化）？把你的产品/受众/价格发我～`,
    "",
    `【标签】\n#干货分享 #内容运营 #文案 #增长 #${(points[0] ?? "好物推荐").slice(0, 8)}`,
  ].join("\n");
  return body.trim();
}

function genWechat(topic: string) {
  const seed = seedFrom(`wechat:${topic}`);
  const points = splitPoints(topic);
  const title = `关于「${points[0] ?? topic}」的结构化分析与可执行建议`;
  const body = [
    `标题：${title}`,
    "",
    "摘要：",
    `- 核心问题：${points[0] ?? topic} 为什么值得做/买/关注？`,
    `- 关键结论：给出 3 条可落地建议与风险提示。`,
    "",
    "正文：",
    "一、背景与痛点",
    `- 现状：${topic}`,
    "二、关键洞察（3 点）",
    points
      .slice(0, 3)
      .map((p, i) => `- 洞察 ${i + 1}：${p}`)
      .join("\n"),
    "三、解决方案与路径",
    `- 路径 A：${pick(["先做小样验证", "从一个细分场景切入", "用数据定义目标"], seed + 1)}`,
    `- 路径 B：${pick(["建立内容资产库", "打造可复用模板", "沉淀 SOP"], seed + 2)}`,
    `- 路径 C：${pick(["用最小成本试错", "控制变量迭代", "复盘并放大有效策略"], seed + 3)}`,
    "四、风险与边界",
    `- 风险 1：${pick(["目标不清导致发散", "资源不足导致半途而废", "指标选择不当"], seed + 4)}`,
    `- 风险 2：${pick(["缺少复盘机制", "忽视用户反馈", "节奏过快质量下滑"], seed + 5)}`,
    "",
    "结论与行动建议：",
    "1) 用一句话明确目标（人群/场景/转化）。",
    "2) 先做 1 周小规模验证，再决定是否加码。",
    "3) 每次迭代只改一个变量，确保可复盘。",
  ].join("\n");
  return body.trim();
}

function genShortVideo(topic: string) {
  const seed = seedFrom(`shortvideo:${topic}`);
  const points = splitPoints(topic);
  const hook = pick(
    [
      `3 秒告诉你：${points[0] ?? topic} 到底怎么选？`,
      `别再踩坑了！${points[0] ?? topic} 这样做立刻变好`,
      `我用 7 天验证：${points[0] ?? topic} 真的有效吗？`,
    ],
    seed,
  );

  const body = [
    "【开场 3 秒钩子】",
    hook,
    "",
    "【镜头/画面】",
    "1) 近景：你指着问题点（字幕加粗）。",
    "2) 中景：展示对比/步骤（屏幕录制或实拍）。",
    "3) 结尾：成果展示 + CTA。",
    "",
    "【口播文案】",
    `如果你也在纠结「${topic}」，先记住这 3 句：`,
    points
      .slice(0, 3)
      .map((p, i) => `${i + 1}）${p}。`)
      .join("\n"),
    "",
    "【字幕要点】",
    `- 重点 1：${points[0] ?? topic}`,
    `- 重点 2：${points[1] ?? "怎么做更省时间"}`,
    `- 重点 3：${points[2] ?? "怎么避免踩坑"}`,
    "",
    "【结尾引导】",
    pick(
      [
        "要模板/清单的评论区打「1」，我发你。",
        "想要我按你的产品改成“更爆”的脚本？私信我关键词。",
        "关注我，后面每天 1 条可直接抄作业的脚本。",
      ],
      seed + 7,
    ),
  ].join("\n");
  return body.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { style?: Style; topic?: string };

    const style = (body?.style ?? "xiaohongshu") as Style;
    const topic = (body?.topic ?? "").trim();
    if (!topic) {
      return NextResponse.json({ ok: false, error: "缺少输入内容" }, { status: 400 });
    }

    const text =
      style === "wechat"
        ? genWechat(topic)
        : style === "shortvideo"
          ? genShortVideo(topic)
          : genXhs(topic);

    return NextResponse.json(
      { ok: true, text },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
