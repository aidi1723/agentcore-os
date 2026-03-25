"use client";

import { useEffect, useMemo, useState } from "react";

type Run = {
  ts: number;
  id: string;
  ok: boolean;
  durationMs: number;
  mode: "mock";
  inputs: {
    platforms: string[];
    aspect: string;
    language: string;
    topic: string;
  };
  outputs: {
    script: string;
    shotlist: string;
    captions: string;
  };
  error?: string;
};

type Cfg = {
  defaultPlatforms: string[];
  defaultAspect: "9:16" | "1:1" | "16:9";
  defaultLanguage: "en" | "zh" | "bilingual";
  safety: { publishEnabled: boolean };
};

type ApiGet = { ok: true; cfg: Cfg; runs: Run[] } | { ok: false; error: string };

type ApiPost =
  | { ok: true; run: Run; publishEnabled: boolean }
  | { ok: false; error: string };

function fmt(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export function SocialOpsMockRunner({ lang }: { lang: "zh" | "en" }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const [topic, setTopic] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [language, setLanguage] = useState<"en" | "zh" | "bilingual">("en");

  const t = useMemo(
    () =>
      lang === "zh"
        ? {
            inputs: "输入",
            topic: "主题/产品",
            topicPh: "例如：thermal break window corner detail / aluminum profile hardware",
            aspect: "比例",
            lang: "语言",
            platforms: "平台（来自默认配置）",
            run: "模拟运行（生成脚本/分镜/字幕草稿）",
            noPublish: "不会发布（安全模式）",
            lastRuns: "最近运行",
            outputs: "本次产物",
            script: "旁白稿/脚本",
            shotlist: "分镜/镜头清单",
            captions: "字幕/屏幕文案",
            copy: "复制",
          }
        : {
            inputs: "Inputs",
            topic: "Topic / Product",
            topicPh: "e.g. thermal break window corner detail / aluminum profile hardware",
            aspect: "Aspect",
            lang: "Language",
            platforms: "Platforms (from default config)",
            run: "Mock Run (generate script/shotlist/captions drafts)",
            noPublish: "No publish (safe mode)",
            lastRuns: "Recent runs",
            outputs: "Outputs",
            script: "VO Script",
            shotlist: "Shotlist",
            captions: "Captions",
            copy: "Copy",
          },
    [lang],
  );

  async function refresh() {
    setErr(null);
    try {
      const res = await fetch("/api/social-ops", { cache: "no-store" });
      const j = (await res.json()) as ApiGet;
      if (!j.ok) throw new Error(j.error);
      setCfg(j.cfg);
      setRuns(j.runs);
      setAspect(j.cfg.defaultAspect);
      setLanguage(j.cfg.defaultLanguage);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function mockRun() {
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/social-ops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "mockRun",
          inputs: {
            topic,
            aspect,
            language,
          },
        }),
      });
      const j = (await res.json()) as ApiPost;
      if (!j.ok) throw new Error(j.error);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const latest = runs[0] || null;

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="text-sm font-semibold">{t.inputs}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-2">
            <div className="text-xs text-zinc-400">{t.topic}</div>
            <input
              className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-600"
              placeholder={t.topicPh}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>

          <label>
            <div className="text-xs text-zinc-400">{t.aspect}</div>
            <select
              className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 text-sm text-zinc-100 ring-1 ring-white/10"
              value={aspect}
              onChange={(e) => setAspect(e.target.value as "9:16" | "1:1" | "16:9")}
            >
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </select>
          </label>

          <label>
            <div className="text-xs text-zinc-400">{t.lang}</div>
            <select
              className="mt-2 w-full rounded-xl bg-black/40 px-4 py-3 text-sm text-zinc-100 ring-1 ring-white/10"
              value={language}
              onChange={(e) =>
                setLanguage(e.target.value as "en" | "zh" | "bilingual")
              }
            >
              <option value="en">EN</option>
              <option value="zh">中文</option>
              <option value="bilingual">双语</option>
            </select>
          </label>

          <div className="sm:col-span-3">
            <div className="text-xs text-zinc-400">{t.platforms}</div>
            <div className="mt-2 rounded-xl bg-black/30 px-4 py-3 text-xs text-zinc-300 ring-1 ring-white/10">
              {cfg?.defaultPlatforms?.join(" / ") || "-"}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={mockRun}
            disabled={loading}
            className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/85 ring-1 ring-white/15 hover:bg-white/12 disabled:opacity-50"
          >
            {loading ? "..." : t.run}
          </button>
          <div className="text-xs text-zinc-500">{t.noPublish}</div>
        </div>

        {err ? <div className="mt-3 text-xs text-rose-200">{err}</div> : null}
      </section>

      <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="text-sm font-semibold">{t.outputs}</div>
        {!latest ? (
          <div className="mt-3 text-xs text-zinc-400">-</div>
        ) : (
          <div className="mt-4 grid gap-3">
            <div className="text-xs text-zinc-400">
              {t.lastRuns}: {fmt(latest.ts)} | {latest.durationMs}ms
            </div>

            <div className="rounded-xl bg-black/40 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-200">{t.script}</div>
                <button
                  onClick={() => copyText(latest.outputs.script)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 ring-1 ring-white/15 hover:bg-white/12"
                >
                  {t.copy}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-zinc-200">
                {latest.outputs.script}
              </pre>
            </div>

            <div className="rounded-xl bg-black/40 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-200">{t.shotlist}</div>
                <button
                  onClick={() => copyText(latest.outputs.shotlist)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 ring-1 ring-white/15 hover:bg-white/12"
                >
                  {t.copy}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-zinc-200">
                {latest.outputs.shotlist}
              </pre>
            </div>

            <div className="rounded-xl bg-black/40 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-zinc-200">{t.captions}</div>
                <button
                  onClick={() => copyText(latest.outputs.captions)}
                  className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 ring-1 ring-white/15 hover:bg-white/12"
                >
                  {t.copy}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-zinc-200">
                {latest.outputs.captions}
              </pre>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="text-sm font-semibold">{t.lastRuns}</div>
        <div className="mt-3 space-y-2">
          {runs.slice(0, 6).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-black/30 px-4 py-3 text-xs ring-1 ring-white/10"
            >
              <div className="truncate text-zinc-200">{r.inputs.topic || "(untitled)"}</div>
              <div className="shrink-0 font-mono text-zinc-400">{fmt(r.ts)}</div>
            </div>
          ))}
          {!runs.length ? (
            <div className="text-xs text-zinc-400">-</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
