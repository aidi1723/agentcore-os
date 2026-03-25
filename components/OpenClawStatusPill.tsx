"use client";

import { useEffect, useMemo, useState } from "react";

type Api = {
  ok: boolean;
  ts: number;
  gatewayOnline: boolean;
  nodesCount: number | null;
  channelsHint?: string;
  error?: string;
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function OpenClawStatusPill({ lang }: { lang: "zh" | "en" }) {
  const [data, setData] = useState<Api | null>(null);
  const [now, setNow] = useState(() => 0);

  const labels = useMemo(
    () =>
      lang === "zh"
        ? {
            gateway: "网关",
            online: "在线",
            offline: "离线",
            nodes: "节点",
            time: "时间",
          }
        : {
            gateway: "Gateway",
            online: "Online",
            offline: "Offline",
            nodes: "Nodes",
            time: "Time",
          },
    [lang],
  );

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const res = await fetch("/api/openclaw-status", { cache: "no-store" });
        const j = (await res.json()) as Api;
        if (alive) setData(j);
      } catch (e) {
        if (alive)
          setData({
            ok: false,
            ts: Date.now(),
            gatewayOnline: false,
            nodesCount: null,
            error: (e as Error).message,
          });
      }
    }

    tick();
    const clk = window.setInterval(() => setNow(Date.now()), 1_000);
    const iv = window.setInterval(tick, 10_000);

    return () => {
      alive = false;
      window.clearInterval(iv);
      window.clearInterval(clk);
    };
  }, []);

  const gatewayOnline = data?.ok && data.gatewayOnline;
  const nodesText =
    data?.ok && typeof data.nodesCount === "number" ? String(data.nodesCount) : "-";

  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "rounded-full px-3 py-2 text-xs ring-1 " +
          (gatewayOnline
            ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/25"
            : "bg-rose-400/10 text-rose-200 ring-rose-300/20")
        }
        title={data?.error || ""}
      >
        {labels.gateway}: {gatewayOnline ? labels.online : labels.offline}
      </div>
      <div className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/70 ring-1 ring-white/15">
        {labels.nodes}: {nodesText}
      </div>
      <div className="rounded-full bg-white/10 px-3 py-2 text-xs text-white/70 ring-1 ring-white/15">
        {labels.time}: {fmtTime(now)}
      </div>
    </div>
  );
}
