import { NextResponse } from "next/server";

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

async function tryFetch(url: string, headers: HeadersInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await res.text().catch(() => "");
      return { res, text, error: null as string | null };
    } catch (err) {
      const cause = (err as any)?.cause as unknown;
      const causeMessage =
        cause && typeof cause === "object" && "message" in (cause as any)
          ? String((cause as any).message)
          : null;
      const message = err instanceof Error ? err.message : String(err);
      const merged = causeMessage ? `${message}（${causeMessage}）` : message;
      return { res: null as Response | null, text: "", error: merged };
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryPostChatCompletions(
  baseUrl: string,
  headers: HeadersInit,
): Promise<{ reachable: boolean; status?: number; statusText?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const url = `${baseUrl}/v1/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openclaw",
        stream: false,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    return { reachable: true, status: res.status, statusText: res.statusText };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { baseUrl?: string; apiToken?: string };

    const baseUrl = normalizeBaseUrl(body?.baseUrl ?? "");
    const apiToken = (body?.apiToken ?? "").trim();

    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: "缺少引擎地址" },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
    };
    if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
      headers["X-API-Token"] = apiToken;
    }

    const candidates = [
      `${baseUrl}/health`,
      `${baseUrl}/v1/health`,
      `${baseUrl}/api/health`,
      `${baseUrl}/status`,
      `${baseUrl}/version`,
    ];

    let lastError: string | null = null;
    for (const url of candidates) {
      const { res, text, error } = await tryFetch(url, headers);
      if (res?.ok) {
        return NextResponse.json(
          { ok: true, endpoint: url },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!res) {
        lastError = error || "连接失败";
        continue;
      }
      lastError = `${res.status} ${res.statusText}${text ? ` · ${text}` : ""}`;
    }

    // Fallback: even if health endpoints don't exist, verify basic reachability via chat completions.
    const chat = await tryPostChatCompletions(baseUrl, headers);
    if (chat.reachable) {
      return NextResponse.json(
        {
          ok: true,
          endpoint: `${baseUrl}/v1/chat/completions`,
          note: `health 端点不可用，但引擎可达（HTTP ${chat.status} ${chat.statusText}）`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: false, error: lastError || "连接失败" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求异常" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
