"use client";

export async function requestOpenClawAgent(input: {
  message: string;
  sessionId: string;
  timeoutSeconds?: number;
}) {
  const res = await fetch("/api/openclaw/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await res.json().catch(() => null)) as
    | null
    | { ok?: boolean; text?: string; error?: string };

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || "执行失败，请检查 OpenClaw 是否运行");
  }

  return String(data.text ?? "").trim();
}
