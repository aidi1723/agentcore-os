import { NextResponse } from "next/server";

function svgDataUrl(text: string) {
  const safe = text.replace(/[<>]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="0.55" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" rx="48" fill="url(#bg)"/>
  <rect x="64" y="64" width="1152" height="592" rx="36" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)"/>
  <text x="96" y="165" fill="white" font-size="42" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans SC,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif" font-weight="700">AI 视觉工坊 · 处理结果示例</text>
  <text x="96" y="232" fill="rgba(255,255,255,0.85)" font-size="26" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans SC,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif">后端尚未接入 OpenClaw video-frames，这是一张占位封面图。</text>
  <text x="96" y="320" fill="rgba(255,255,255,0.95)" font-size="30" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans SC,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif" font-weight="600">指令：</text>
  <foreignObject x="96" y="342" width="1088" height="280">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans SC,PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif;font-size:24px;line-height:1.45;color:rgba(255,255,255,0.92);white-space:pre-wrap;">
      ${safe}
    </div>
  </foreignObject>
</svg>`;
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const instruction = String(form.get("instruction") ?? "").trim();
    const video = form.get("video");

    if (!video || !(video instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "缺少视频文件" },
        { status: 400 },
      );
    }
    if (!instruction) {
      return NextResponse.json(
        { ok: false, error: "缺少处理指令" },
        { status: 400 },
      );
    }

    // TODO: 在这里接入 OpenClaw 的 video-frames 技能：
    // - 把视频与指令传给引擎
    // - 返回封面图片或视频片段（建议存储为本地文件或对象存储 URL）

    return NextResponse.json(
      {
        ok: true,
        output: {
          videoSrc: null,
          coverSrc: svgDataUrl(instruction),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求异常" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
