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

async function tryFetchModels(url: string, apiKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    return { res, json };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | null
      | { apiKey?: string; baseUrl?: string; model?: string };

    const apiKey = body?.apiKey?.trim() ?? "";
    const baseUrl = normalizeBaseUrl(body?.baseUrl ?? "");
    const model = body?.model?.trim() ?? "";

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

    const candidates: string[] = [];
    candidates.push(`${baseUrl}/models`);
    if (!/\/v1$/.test(baseUrl)) candidates.push(`${baseUrl}/v1/models`);

    let lastError: string | null = null;
    for (const url of candidates) {
      const { res, json } = await tryFetchModels(url, apiKey);
      if (!res.ok) {
        lastError =
          (json && typeof json === "object" && "error" in json
            ? JSON.stringify((json as any).error)
            : null) ?? `${res.status} ${res.statusText}`;
        continue;
      }

      const data = (json as any)?.data;
      const modelFound =
        !model || !Array.isArray(data)
          ? undefined
          : data.some((m) => m?.id === model);

      return NextResponse.json(
        { ok: true, modelFound },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: false, error: lastError || "请求失败" },
      { status: 500 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "请求异常" },
      { status: 500 },
    );
  }
}
