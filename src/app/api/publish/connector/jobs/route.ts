import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return { ok: false, status: 0, text: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const urlObj = new URL(req.url);
  const limit = urlObj.searchParams.get("limit") || "20";
  const url = `http://127.0.0.1:8787/jobs?limit=${encodeURIComponent(limit)}`;
  const r = await fetchWithTimeout(url, 2200);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.text || "Connector unavailable", status: r.status, url },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  let json: unknown = null;
  try {
    json = JSON.parse(r.text);
  } catch {
    json = r.text;
  }
  return NextResponse.json(
    { ok: true, url, data: json },
    { headers: { "Cache-Control": "no-store" } },
  );
}

