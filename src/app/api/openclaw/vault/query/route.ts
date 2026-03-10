import { NextResponse } from "next/server";
import { runOpenClawAgent } from "@/lib/openclaw-cli";

export const runtime = "nodejs";

type VaultFile = {
  id: string;
  folderId: string;
  name: string;
  size: number;
  addedAt: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { query?: string; folderName?: string; files?: VaultFile[] };

    const query = (body?.query ?? "").trim();
    const folderName = (body?.folderName ?? "知识库").trim() || "知识库";
    const files = Array.isArray(body?.files) ? body?.files ?? [] : [];

    if (!query) {
      return NextResponse.json({ ok: false, error: "缺少 query" }, { status: 400 });
    }

    const list = files
      .slice(0, 40)
      .map((f) => `- ${f.name} (${Math.round(f.size / 1024)}KB)`)
      .join("\n");

    const message =
      "你是知识库检索助手。用户会给你一个文件列表（仅文件名/大小）和一个问题。\n" +
      "你的任务是：\n" +
      "1) 从列表里挑出最相关的 3 个文件名（如果没有就说没有）。\n" +
      "2) 给出可执行的下一步：为了回答得更准，需要用户提供哪些关键信息或把哪些文件内容粘贴出来。\n" +
      "注意：当前你看不到文件内容，只能基于文件名进行初步判断。\n\n" +
      `当前文件夹：${folderName}\n` +
      `文件列表：\n${list || "(空)"}\n\n` +
      `用户问题：${query}\n\n` +
      "请用简洁的 Markdown 输出：\n" +
      "【最相关文件】\n- ...\n【建议】\n- ...";

    const r = await runOpenClawAgent({
      sessionId: "webos-vault",
      message,
      timeoutSeconds: 60,
    });
    if (!r.ok) return NextResponse.json(r, { status: 502 });

    return NextResponse.json(
      { ok: true, text: r.text, raw: r.raw },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
