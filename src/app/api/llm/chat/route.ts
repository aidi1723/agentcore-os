import { NextResponse } from "next/server";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function normalizeBaseUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const noSlash = trimmed.replace(/\/+$/, "");
  const normalizedWs = noSlash.replace(/^wss:\/\//i, "https://").replace(
    /^ws:\/\//i,
    "http://",
  );
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalizedWs)) return normalizedWs;
  return `http://${normalizedWs}`;
}

function chatCompletionsUrl(baseUrl: string) {
  if (/\/v1$/.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | {
          apiKey?: string;
          baseUrl?: string;
          model?: string;
          messages?: ChatMessage[];
          stream?: boolean;
        };

    const apiKey = body?.apiKey?.trim() ?? "";
    const baseUrl = normalizeBaseUrl(body?.baseUrl ?? "");
    const model = body?.model?.trim() ?? "";
    const messages = body?.messages ?? [];
    const stream = body?.stream !== false;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "缺少 API Key" },
        { status: 400 },
      );
    }
    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: "缺少 Base URL" },
        { status: 400 },
      );
    }
    if (!model) {
      return NextResponse.json({ ok: false, error: "缺少 Model" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "缺少 messages" },
        { status: 400 },
      );
    }

    const url = chatCompletionsUrl(baseUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
          temperature: 0.7,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = upstream.headers.get("content-type") ?? "";

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: text || `${upstream.status} ${upstream.statusText}`,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (contentType.includes("text/event-stream")) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const json = await upstream.json().catch(() => null);
    return NextResponse.json(json, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "请求异常";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
