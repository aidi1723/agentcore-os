"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Share2 } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import {
  createDraft,
  getDrafts,
  removeDraft,
  subscribeDrafts,
  updateDraft,
  type DraftId,
  type DraftRecord,
} from "@/lib/drafts";
import {
  createPublishJob,
  getPublishJobs,
  subscribePublish,
  updatePublishJob,
  type PublishJobId,
  type PublishPlatformId,
  type PublishJobRecord,
} from "@/lib/publish";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";
import { loadSettings } from "@/lib/settings";
import { requestOpenApp, requestOpenSettings } from "@/lib/ui-events";

const platforms: Array<{ id: PublishPlatformId; name: string; supported?: boolean }> = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "tiktok", name: "TikTok" },
  { id: "instagram", name: "Instagram" },
  // Temporary scope: the 4 platforms above. Others are placeholders for future connectors.
  { id: "wechat", name: "公众号", supported: false },
  { id: "twitter", name: "X(Twitter)", supported: false },
  { id: "linkedin", name: "LinkedIn", supported: false },
  { id: "storefront", name: "独立站", supported: false },
];

export function PublisherAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [jobs, setJobs] = useState<PublishJobRecord[]>([]);
  const [selectedId, setSelectedId] = useState<DraftId | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PublishPlatformId[]>(
    () => ["xiaohongshu", "douyin"],
  );
  const [resultText, setResultText] = useState("");
  const [lastResults, setLastResults] = useState<
    null | Array<{ platform: string; ok: boolean; mode: string; status?: number; error?: string }>
  >(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const taskIdRef = useRef<TaskId | null>(null);
  const jobIdRef = useRef<PublishJobId | null>(null);
  const processingRef = useRef(false);
  const [connByPlatform, setConnByPlatform] = useState<
    Record<string, { token: string; webhookUrl: string }>
  >({});
  const connByPlatformRef = useRef(connByPlatform);
  const [dispatchMode, setDispatchMode] = useState<"dry-run" | "dispatch">("dry-run");
  const [connectorOnline, setConnectorOnline] = useState<null | boolean>(null);
  const [connectorJobs, setConnectorJobs] = useState<any[] | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    setDrafts(getDrafts());
    setJobs(getPublishJobs());
    const unsubDrafts = subscribeDrafts(() => setDrafts(getDrafts()));
    const unsubPublish = subscribePublish(() => setJobs(getPublishJobs()));
    return () => {
      unsubDrafts();
      unsubPublish();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    const run = async () => {
      const health = await fetch("/api/publish/connector/health", { method: "GET" })
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      setConnectorOnline(Boolean(health?.ok));

      const jobsRes = await fetch("/api/publish/connector/jobs?limit=12", { method: "GET" })
        .then((r) => r.json())
        .catch(() => null);
      if (cancelled) return;
      const list = jobsRes?.ok ? jobsRes?.data?.jobs : null;
      setConnectorJobs(Array.isArray(list) ? list : null);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  useEffect(() => {
    connByPlatformRef.current = connByPlatform;
  }, [connByPlatform]);

  useEffect(() => {
    if (!isVisible) return;
    const apply = () => {
      const s = loadSettings();
      setConnByPlatform({
        xiaohongshu: {
          token: s.matrixAccounts.xiaohongshu.token,
          webhookUrl: s.matrixAccounts.xiaohongshu.webhookUrl,
        },
        douyin: {
          token: s.matrixAccounts.douyin.token,
          webhookUrl: s.matrixAccounts.douyin.webhookUrl,
        },
        instagram: {
          token: s.matrixAccounts.instagram.token,
          webhookUrl: s.matrixAccounts.instagram.webhookUrl,
        },
        tiktok: {
          token: s.matrixAccounts.tiktok.token,
          webhookUrl: s.matrixAccounts.tiktok.webhookUrl,
        },
        storefront: {
          token: s.matrixAccounts.storefront.token,
          webhookUrl: s.matrixAccounts.storefront.webhookUrl,
        },
      });
    };
    apply();
    window.addEventListener("openclaw:settings", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("openclaw:settings", apply);
      window.removeEventListener("storage", apply);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (drafts.length === 0) {
      setSelectedId(null);
      setTitle("");
      setBody("");
      return;
    }
    if (selectedId && drafts.some((d) => d.id === selectedId)) return;
    const first = drafts[0];
    setSelectedId(first.id);
    setTitle(first.title);
    setBody(first.body);
  }, [drafts, isVisible, selectedId]);

  const selectedDraft = useMemo(() => {
    if (!selectedId) return null;
    return drafts.find((d) => d.id === selectedId) ?? null;
  }, [drafts, selectedId]);

  const onSelectDraft = (draftId: DraftId) => {
    const d = drafts.find((x) => x.id === draftId);
    if (!d) return;
    setSelectedId(draftId);
    setTitle(d.title);
    setBody(d.body);
    setResultText("");
  };

  const togglePlatform = (id: PublishPlatformId) => {
    setSelectedPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const saveCurrent = () => {
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    if (!nextBody) return;
    if (!selectedId) {
      const id = createDraft({ title: nextTitle, body: nextBody, tags: selectedPlatforms, source: "publisher" });
      setSelectedId(id);
      return;
    }
    updateDraft(selectedId, { title: nextTitle, body: nextBody, tags: selectedPlatforms });
  };

  const dispatch = () => {
    const nextTitle = title.trim() || "未命名草稿";
    const nextBody = body.trim();
    if (!nextBody) return;
    if (selectedPlatforms.length === 0) return;

    const draftId = (() => {
      const nextBody = body.trim();
      if (!nextBody) return null;
      if (!selectedId) {
        const id = createDraft({ title: nextTitle, body: nextBody, tags: selectedPlatforms, source: "publisher" });
        setSelectedId(id);
        return id;
      }
      updateDraft(selectedId, { title: nextTitle, body: nextBody, tags: selectedPlatforms });
      return selectedId;
    })();
    if (!draftId) return;

    setResultText("已加入队列，等待执行…");
    setLastResults(null);

    const jobId = createPublishJob({
      draftId,
      draftTitle: nextTitle,
      platforms: selectedPlatforms,
      mode: dispatchMode,
      status: "queued",
      maxAttempts: dispatchMode === "dry-run" ? 1 : 3,
    });
    jobIdRef.current = jobId;
  };

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    const runOnce = async () => {
      if (cancelled) return;
      if (processingRef.current) return;

      const now = Date.now();
      const queued = getPublishJobs()
        .filter((j) => j.status === "queued" && (j.nextAttemptAt ?? 0) <= now)
        .sort((a, b) => a.createdAt - b.createdAt);
      const job = queued[0];
      if (!job) return;

      processingRef.current = true;
      setIsDispatching(true);
      updatePublishJob(job.id, { status: "running" });

      const isPrimary = jobIdRef.current === job.id;
      const maxAttempts = job.maxAttempts ?? 3;
      const attempt = (job.attempts ?? 0) + 1;
      const mode = job.mode ?? "dry-run";

      const draft = job.draftId ? getDrafts().find((d) => d.id === job.draftId) ?? null : null;
      const nextTitle = draft?.title?.trim() || job.draftTitle;
      const nextBody = draft?.body?.trim() || "";
      const platforms = job.platforms ?? [];

      const taskId = createTask({
        name: "Assistant - Publish",
        status: "running",
        detail: `${platforms.join(", ")} | ${nextTitle.slice(0, 40)} | attempt ${attempt}/${maxAttempts}`,
      });
      if (isPrimary) taskIdRef.current = taskId;

      try {
        if (!nextBody || platforms.length === 0) {
          const error = "队列任务无效：缺少内容或平台";
          if (isPrimary) setResultText(error);
          updatePublishJob(job.id, { status: "error", resultText: error, attempts: attempt });
          updateTask(taskId, { status: "error", detail: error });
          return;
        }

        const connections = Object.fromEntries(
          platforms.map((p) => [
            p,
            {
              token: connByPlatformRef.current[p]?.token ?? "",
              webhookUrl: connByPlatformRef.current[p]?.webhookUrl ?? "",
            },
          ]),
        );

        const res = await fetch("/api/publish/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: nextTitle,
            body: nextBody,
            platforms,
            dryRun: mode === "dry-run",
            connections,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | null
          | { ok?: boolean; text?: string; error?: string; results?: any; openclaw?: any };

        if (!data) {
          throw new Error("发布失败（无响应）");
        }

        const text = String(data.text ?? "").trim();
        const results = Array.isArray((data as any).results) ? ((data as any).results as any[]) : null;
        if (results && isPrimary) {
          setLastResults(
            results.map((r) => ({
              platform: String(r?.platform ?? ""),
              ok: Boolean(r?.ok),
              mode: String(r?.mode ?? ""),
              status: typeof r?.status === "number" ? r.status : undefined,
              error: r?.error ? String(r.error) : undefined,
            })),
          );
        }

        if (!res.ok || !data.ok) {
          const error = data.error || "发布失败";
          const combined = text ? `${error}\n\n${text}` : error;
          if (attempt < maxAttempts && mode === "dispatch") {
            const backoffMs = Math.min(60_000, 1500 * 2 ** (attempt - 1));
            updatePublishJob(job.id, {
              status: "queued",
              attempts: attempt,
              nextAttemptAt: Date.now() + backoffMs,
              resultText: combined,
            });
            if (isPrimary) setResultText(`失败，将在 ${Math.round(backoffMs / 1000)} 秒后重试：\n${combined}`);
            updateTask(taskId, { status: "error", detail: error });
            return;
          }

          if (isPrimary) setResultText(combined);
          updatePublishJob(job.id, { status: "error", resultText: combined, attempts: attempt });
          updateTask(taskId, { status: "error", detail: error });
          return;
        }

        if (isPrimary) setResultText(text || "（无输出）");
        updatePublishJob(job.id, { status: "done", resultText: text, attempts: attempt });
        updateTask(taskId, { status: "done" });
      } catch (err) {
        const error = err instanceof Error ? err.message : "请求异常";
        if (attempt < maxAttempts && mode === "dispatch") {
          const backoffMs = Math.min(60_000, 1500 * 2 ** (attempt - 1));
          updatePublishJob(job.id, {
            status: "queued",
            attempts: attempt,
            nextAttemptAt: Date.now() + backoffMs,
            resultText: error,
          });
          if (isPrimary) setResultText(`失败，将在 ${Math.round(backoffMs / 1000)} 秒后重试：\n${error}`);
          updateTask(taskId, { status: "error", detail: error });
          return;
        }

        if (isPrimary) setResultText(error);
        updatePublishJob(job.id, { status: "error", resultText: error, attempts: attempt });
        updateTask(taskId, { status: "error", detail: error });
      } finally {
        processingRef.current = false;
        setIsDispatching(false);
      }
    };

    const intervalId = window.setInterval(() => {
      void runOnce();
    }, 1100);
    void runOnce();
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isVisible]);

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="矩阵发布中心"
      icon={Share2}
      widthClassName="w-[1100px]"
      storageKey="openclaw.window.publisher"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="bg-white">
        <div className="flex min-h-[620px] flex-col lg:flex-row">
          <aside className="w-full border-b border-gray-200 bg-gray-50/60 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="p-5">
              <div className="text-xs font-semibold text-gray-500">Publisher</div>
              <div className="mt-1 text-lg font-bold text-gray-900">内容库</div>
              <div className="mt-2 text-xs text-gray-600">
                草稿：<span className="font-semibold">{drafts.length}</span>{" | "}
                发布记录：<span className="font-semibold">{jobs.length}</span>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setTitle("");
                  setBody("");
                  setResultText("");
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black transition-colors"
              >
                新建草稿
              </button>
            </div>

            <div className="px-2 pb-4">
              <div className="px-3 pb-2 text-xs font-semibold text-gray-500">草稿列表</div>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {drafts.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">
                    还没有草稿。可以从「AI 文案」里保存到内容库。
                  </div>
                ) : (
                  drafts.slice(0, 20).map((d) => {
                    const activeRow = d.id === selectedId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onSelectDraft(d.id)}
                        className={[
                          "w-full text-left px-3 py-2.5 rounded-xl border transition-colors",
                          activeRow
                            ? "bg-white border-gray-200 text-gray-900 shadow-sm"
                            : "bg-transparent border-transparent text-gray-700 hover:bg-white/70",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold truncate">{d.title}</div>
                        <div className="mt-1 text-xs text-gray-500 truncate">
                          {new Date(d.updatedAt).toLocaleString()}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <main className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-lg font-bold text-gray-900">发布工作台</div>
                <div className="text-sm text-gray-500 mt-1">
                  选择平台 → 微调内容 → 预演或自动发布。自动发布需要为平台配置 Publish Webhook（设置→矩阵账号授权）。
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                <Send className="h-4 w-4 text-emerald-600" />
                {dispatchMode === "dry-run" ? "安全预演" : "自动发布"}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDispatchMode("dry-run")}
                  className={[
                    "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors",
                    dispatchMode === "dry-run"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  安全预演
                </button>
                <button
                  type="button"
                  onClick={() => setDispatchMode("dispatch")}
                  className={[
                    "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors",
                    dispatchMode === "dispatch"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50",
                  ].join(" ")}
                >
                  自动发布（Webhook）
                </button>
                <div className="text-xs text-gray-500">
                  临时范围：小红书 / 抖音 / Instagram / TikTok
                </div>
                <div
                  className={[
                    "text-xs px-3 py-2 rounded-xl border font-semibold",
                    connectorOnline === null
                      ? "bg-gray-50 text-gray-600 border-gray-200"
                      : connectorOnline
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200",
                  ].join(" ")}
                  title="本机示例 Connector（可选）"
                >
                  Connector:{" "}
                  {connectorOnline === null ? "检测中" : connectorOnline ? "在线" : "离线"}
                </div>
                <button
                  type="button"
                  onClick={() => window.open("http://127.0.0.1:8787/", "_blank", "noopener,noreferrer")}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                >
                  打开 Connector
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {platforms.map((p) => {
                  const checked = selectedPlatforms.includes(p.id);
                  const conn = connByPlatform[p.id];
                  const tokenOk = Boolean(conn?.token?.trim());
                  const webhookOk = Boolean(conn?.webhookUrl?.trim());
                  const supported = p.supported !== false;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (!supported) return;
                        togglePlatform(p.id);
                      }}
                      className={[
                        "px-4 py-3 rounded-xl border text-left transition-colors",
                        checked
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-gray-200 hover:bg-gray-50",
                        supported ? "" : "opacity-50 cursor-not-allowed",
                      ].join(" ")}
                      aria-pressed={checked}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                        <span
                          className={[
                            "text-[11px] px-2 py-0.5 rounded-full border font-semibold",
                            supported
                              ? tokenOk
                                ? "bg-emerald-600/10 text-emerald-700 border-emerald-200"
                                : "bg-amber-500/10 text-amber-700 border-amber-200"
                              : "bg-gray-50 text-gray-600 border-gray-200",
                          ].join(" ")}
                        >
                          {supported ? (tokenOk ? "已授权" : "未授权") : "待接入"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 font-mono">{p.id}</div>
                      {supported && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
                          <span
                            className={[
                              "px-2 py-0.5 rounded-full border font-semibold",
                              webhookOk
                                ? "bg-emerald-600/10 text-emerald-700 border-emerald-200"
                                : "bg-gray-50 text-gray-600 border-gray-200",
                            ].join(" ")}
                          >
                            {webhookOk ? "Webhook" : "手动"}
                          </span>
                          {!webhookOk && (
                            <span className="text-gray-500">
                              填 Webhook 才能自动发布
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标题
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：新品发布｜3 个技巧让转化翻倍"
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    内容
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="粘贴/编辑要发布的正文..."
                    className="h-48 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={saveCurrent}
                  disabled={!body.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-sm hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={dispatch}
                  disabled={!body.trim() || selectedPlatforms.length === 0 || isDispatching}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDispatching
                    ? "处理中..."
                    : dispatchMode === "dry-run"
                      ? "预演发布"
                      : "自动发布"}
                </button>
                {dispatchMode === "dispatch" &&
                  selectedPlatforms.some((p) => !connByPlatform[p]?.webhookUrl?.trim()) && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                      部分平台未配置 Webhook，将回退为手动发布清单。
                    </div>
                  )}
                {dispatchMode === "dispatch" &&
                  selectedPlatforms.some((p) => !connByPlatform[p]?.webhookUrl?.trim()) && (
                    <button
                      type="button"
                      onClick={() => requestOpenSettings("matrix")}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      去配置 Webhook
                    </button>
                  )}
                {selectedDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      removeDraft(selectedDraft.id);
                      setSelectedId(null);
                      setTitle("");
                      setBody("");
                      setResultText("");
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    删除草稿
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-semibold text-gray-900">发布预演结果</div>
                <div className="mt-2 text-xs text-gray-500">
                  可直接复制内容到各平台；后续接入真实 API 后，这里会显示发布 URL/状态。
                </div>
                {lastResults && lastResults.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-700">执行结果</div>
                    <div className="mt-2 space-y-1">
                      {lastResults.map((r) => (
                        <div
                          key={`${r.platform}:${r.mode}`}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-mono text-gray-700">{r.platform}</span>
                          <span className="text-gray-600">{r.mode}</span>
                          <span
                            className={[
                              "px-2 py-0.5 rounded-full border font-semibold",
                              r.ok
                                ? "bg-emerald-600/10 text-emerald-700 border-emerald-200"
                                : "bg-red-600/10 text-red-700 border-red-200",
                            ].join(" ")}
                          >
                            {r.ok ? "OK" : "ERR"}
                            {typeof r.status === "number" ? ` ${r.status}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    {lastResults.some((r) => !r.ok && r.error) && (
                      <div className="mt-2 text-[11px] text-red-700">
                        {lastResults.find((r) => !r.ok && r.error)?.error}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 min-h-[220px]">
                  {resultText ? (
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-800">
                      {resultText}
                    </pre>
                  ) : (
                    <div className="text-xs text-gray-500">
                      点击“预演发布”生成平台建议与检查清单。
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">发布记录</div>
                  <button
                    type="button"
                    onClick={() => requestOpenApp("task_manager")}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    打开任务调度
                  </button>
                </div>
                <div className="mt-4 space-y-2 max-h-[220px] overflow-auto">
                  {jobs.length === 0 ? (
                    <div className="text-xs text-gray-500">暂无记录</div>
                  ) : (
                    jobs.slice(0, 30).map((j) => (
                      <div
                        key={j.id}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {j.draftTitle}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {j.platforms.join(", ")} · {j.status} ·{" "}
                          {new Date(j.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5">
                  <div className="text-sm font-semibold text-gray-900">Connector 收据（本机）</div>
                  <div className="mt-2 text-xs text-gray-500">
                    来自示例 Connector 的 `jobs.jsonl`（可用于验证自动发布请求是否送达）。
                  </div>
                  <div className="mt-3 space-y-2 max-h-[220px] overflow-auto">
                    {connectorJobs === null ? (
                      <div className="text-xs text-gray-500">
                        {connectorOnline ? "暂无数据" : "Connector 未运行或不可达"}
                      </div>
                    ) : connectorJobs.length === 0 ? (
                      <div className="text-xs text-gray-500">暂无收据</div>
                    ) : (
                      connectorJobs.map((j) => (
                        <div
                          key={String(j.id)}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                        >
                          <div className="text-xs text-gray-700 font-mono truncate">
                            {String(j.platform)} · {String(j.id)}
                          </div>
                          <div className="mt-1 text-xs text-gray-600 truncate">
                            {String(j.title || "")}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500">
                            {String(j.receivedAt || "")}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
