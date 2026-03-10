"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Cpu,
  KeyRound,
  Palette,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import type { AppSettings } from "@/lib/settings";
import {
  defaultSettings,
  getActiveLlmConfig,
  loadSettings,
  saveSettings,
  type LlmProviderId,
} from "@/lib/settings";

type TabId = "llm" | "engine" | "matrix" | "personalization";

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "llm", label: "大模型与助手", icon: <Bot className="h-4 w-4" /> },
  { id: "engine", label: "引擎核心", icon: <Cpu className="h-4 w-4" /> },
  {
    id: "matrix",
    label: "矩阵账号授权",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    id: "personalization",
    label: "个性化",
    icon: <Palette className="h-4 w-4" />,
  },
];

type MatrixApp = "xiaohongshu" | "douyin" | "instagram" | "tiktok" | "storefront";

const matrixApps: Array<{ id: MatrixApp; name: string }> = [
  { id: "xiaohongshu", name: "小红书" },
  { id: "douyin", name: "抖音" },
  { id: "instagram", name: "Instagram" },
  { id: "tiktok", name: "TikTok" },
  { id: "storefront", name: "独立站" },
];

function statusDotClass(connected: boolean) {
  return connected ? "bg-emerald-500" : "bg-gray-300";
}

export function SettingsAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [activeTab, setActiveTab] = useState<TabId>("llm");
  const [form, setForm] = useState<AppSettings>(() => defaultSettings);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [isTestingEngine, setIsTestingEngine] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState<Record<MatrixApp, boolean>>({
    xiaohongshu: false,
    douyin: false,
    instagram: false,
    tiktok: false,
    storefront: false,
  });

  const [toast, setToast] = useState<
    null | { message: string; tone: "ok" | "error" }
  >(null);
  const toastTimerRef = useRef<number | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const isWindowVisible = state === "open" || state === "opening";

  const flushSaveNow = () => {
    if (!isWindowVisible) return;
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    saveSettings(form);
    setSavedAt(Date.now());
  };

  useEffect(() => {
    if (isWindowVisible) {
      setActiveTab("llm");
      setForm(loadSettings());
      setSavedAt(null);
      hydratedRef.current = true;
    }
  }, [isWindowVisible]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (autosaveTimerRef.current !== null)
        window.clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const showToast = (message: string, tone: "ok" | "error" = "ok") => {
    setToast({ message, tone });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2000);
  };

  // Auto-save: any change persists to localStorage with debounce.
  useEffect(() => {
    if (!isWindowVisible) return;
    if (!hydratedRef.current) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      saveSettings(form);
      setSavedAt(Date.now());
      autosaveTimerRef.current = null;
    }, 250);
  }, [form, isWindowVisible]);

  const assistantPromptHint = useMemo(() => {
    return "例如：你是我的系统助手。说话简洁、注重可执行步骤；默认中文回答；需要时给出安全提醒。";
  }, []);

  const providerMeta = useMemo(
    () =>
      [
        { id: "kimi" as const, name: "Kimi (Moonshot)", badge: "推荐" },
        { id: "deepseek" as const, name: "DeepSeek", badge: "高速" },
        { id: "openai" as const, name: "OpenAI", badge: "通用" },
        { id: "qwen" as const, name: "通义千问", badge: "国产" },
      ] as const,
    [],
  );

  const backgroundOptions = useMemo(
    () => [
      {
        id: "aurora" as const,
        name: "极光紫",
        className:
          "bg-[radial-gradient(1200px_circle_at_20%_10%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(255,255,255,0.12),transparent_55%),linear-gradient(135deg,#0b1220_0%,#1a1f3b_35%,#3a1c63_70%,#0b1220_100%)]",
      },
      {
        id: "ocean" as const,
        name: "海盐蓝",
        className:
          "bg-[radial-gradient(900px_circle_at_25%_15%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(1100px_circle_at_80%_45%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#06131f_0%,#0b3a5a_35%,#0b6aa6_65%,#06131f_100%)]",
      },
      {
        id: "sunset" as const,
        name: "落日橙",
        className:
          "bg-[radial-gradient(1100px_circle_at_20%_10%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(900px_circle_at_85%_35%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,#1a0b1a_0%,#6a1b2d_35%,#ff6a00_70%,#1a0b1a_100%)]",
      },
    ],
    [],
  );

  const handleTestActiveProvider = async () => {
    const active = getActiveLlmConfig(form);
    if (!active.config.apiKey.trim()) {
      showToast("请先填写当前引擎的 API Key", "error");
      return;
    }

    setIsTestingLlm(true);
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: active.config.apiKey,
          baseUrl: active.config.baseUrl,
          model: active.config.model,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        modelFound?: boolean;
      };

      if (!res.ok || !data.ok) {
        showToast(data.error || "连接失败，请检查配置", "error");
        return;
      }
      if (data.modelFound === false) {
        showToast("连接成功，但未找到该模型", "error");
        return;
      }
      showToast("连接成功", "ok");
    } catch {
      showToast("连接失败（网络问题）", "error");
    } finally {
      setIsTestingLlm(false);
    }
  };

  const handleTestEngine = async () => {
    if (!form.openclaw.baseUrl.trim()) {
      showToast("请先填写引擎地址", "error");
      return;
    }

    setIsTestingEngine(true);
    try {
      const res = await fetch("/api/openclaw/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.openclaw.baseUrl,
          apiToken: form.openclaw.apiToken,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        endpoint?: string;
      };

      if (!res.ok || !data.ok) {
        showToast(data.error || "引擎连接失败", "error");
        return;
      }
      showToast(`引擎可用：${data.endpoint ?? "OK"}`, "ok");
    } catch {
      showToast("引擎连接失败（网络问题）", "error");
    } finally {
      setIsTestingEngine(false);
    }
  };

  const handleSaveMatrix = (appId: MatrixApp) => {
    setMatrixSaving((prev) => ({ ...prev, [appId]: true }));
    // Auto-save already happens, this is a UX "commit" action.
    window.setTimeout(() => {
      setMatrixSaving((prev) => ({ ...prev, [appId]: false }));
      showToast("授权信息已保存", "ok");
    }, 350);
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="设置"
      icon={SettingsIcon}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.settings"
      onFocus={onFocus}
      onMinimize={() => {
        flushSaveNow();
        onMinimize();
      }}
      onClose={() => {
        flushSaveNow();
        onClose();
      }}
    >
      <div className="relative bg-white">
        {toast && (
          <div className="absolute right-5 top-5 z-10">
            <div
              className={[
                "px-4 py-2.5 rounded-xl shadow-lg border text-sm font-semibold backdrop-blur",
                toast.tone === "ok"
                  ? "bg-emerald-600/90 border-emerald-400/40 text-white"
                  : "bg-red-600/90 border-red-400/40 text-white",
              ].join(" ")}
              role="status"
              aria-live="polite"
            >
              {toast.message}
            </div>
          </div>
        )}

        <div className="flex min-h-[560px]">
          {/* Left nav */}
          <aside className="w-64 border-r border-gray-200 bg-gray-50/60">
            <div className="p-5">
              <div className="text-xs font-semibold text-gray-500">
                系统中枢控制台
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">OpenClaw</div>
            </div>

            <nav className="px-2 pb-4 space-y-1">
              {tabs.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                      active
                        ? "bg-white border border-gray-200 text-gray-900 shadow-sm"
                        : "text-gray-700 hover:bg-white/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-9 w-9 rounded-xl flex items-center justify-center border",
                        active ? "bg-blue-50 border-blue-100" : "bg-white border-gray-200",
                      ].join(" ")}
                    >
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="px-5 pb-5 text-xs text-gray-500">
              {savedAt ? `已自动保存：${new Date(savedAt).toLocaleTimeString()}` : "将自动保存到本机"}
            </div>
          </aside>

          {/* Right panel */}
          <main className="flex-1 p-6 overflow-y-auto">
            {activeTab === "llm" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">大模型与助手</div>
                  <div className="text-sm text-gray-500 mt-1">
                    配置大模型与全局系统助手（自动保存）。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        模型库列表
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        为不同引擎分别保存 Key / Base URL / Model，并一键切换当前引擎。
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestActiveProvider}
                      disabled={isTestingLlm}
                      className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isTestingLlm ? "测试中..." : "测试连接"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {providerMeta.map((p) => {
                      const cfg = form.llm.providers[p.id];
                      const active = form.llm.activeProvider === p.id;
                      return (
                        <div
                          key={p.id}
                          className={[
                            "rounded-2xl border p-4 space-y-3",
                            active ? "border-blue-500 bg-blue-50/40" : "border-gray-200 bg-white",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-gray-900 truncate">
                                  {p.name}
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-900 text-white font-semibold">
                                  {p.badge}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {active ? "当前引擎" : "可一键切换"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  llm: { ...prev.llm, activeProvider: p.id as LlmProviderId },
                                }))
                              }
                              className={[
                                "px-3 py-2 rounded-xl text-xs font-semibold border transition-colors",
                                active
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              {active ? "正在使用" : "设为当前"}
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                API Key
                              </label>
                              <div className="relative">
                                <input
                                  type="password"
                                  value={cfg.apiKey}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      llm: {
                                        ...prev.llm,
                                        providers: {
                                          ...prev.llm.providers,
                                          [p.id]: { ...prev.llm.providers[p.id], apiKey: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  placeholder="sk-..."
                                  className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoComplete="off"
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                  <KeyRound className="h-4 w-4" />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                  Base URL
                                </label>
                                <input
                                  value={cfg.baseUrl}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      llm: {
                                        ...prev.llm,
                                        providers: {
                                          ...prev.llm.providers,
                                          [p.id]: { ...prev.llm.providers[p.id], baseUrl: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoComplete="off"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                  Model
                                </label>
                                <input
                                  value={cfg.model}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      llm: {
                                        ...prev.llm,
                                        providers: {
                                          ...prev.llm.providers,
                                          [p.id]: { ...prev.llm.providers[p.id], model: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoComplete="off"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      全局系统助手设定
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      用于预设专属助手的身份、语气与行为边界（自动保存）。
                    </div>
                  </div>
                  <textarea
                    value={form.assistant.systemPrompt}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assistant: { ...prev.assistant, systemPrompt: e.target.value },
                      }))
                    }
                    placeholder={assistantPromptHint}
                    className="h-40 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </section>
            )}

            {activeTab === "engine" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">引擎核心</div>
                  <div className="text-sm text-gray-500 mt-1">
                    配置本地 OpenClaw 引擎地址与 Token（自动保存）。
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    提示：如果你运行的是 openclaw-gateway，API 端口可能不是 8000（例如
                    18791）。
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5 bg-white space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        OpenClaw 引擎连接
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        默认：{defaultSettings.openclaw.baseUrl}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleTestEngine}
                      disabled={isTestingEngine}
                      className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isTestingEngine ? "测试中..." : "测试引擎连通性"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        引擎地址
                      </label>
                      <input
                        value={form.openclaw.baseUrl}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            openclaw: { ...prev.openclaw, baseUrl: e.target.value },
                          }))
                        }
                        placeholder="留空：使用本地 video-frames（推荐）；或填写 http://127.0.0.1:18789"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Token
                      </label>
                      <input
                        type="password"
                        value={form.openclaw.apiToken}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            openclaw: { ...prev.openclaw, apiToken: e.target.value },
                          }))
                        }
                        placeholder="（可选）"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "matrix" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">矩阵账号授权</div>
                  <div className="text-sm text-gray-500 mt-1">
                    为不同平台配置 Auth Token（自动保存 + 手动保存按钮）。
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const local = "http://127.0.0.1:8787/webhook/publish";
                      setForm((prev) => ({
                        ...prev,
                        matrixAccounts: {
                          ...prev.matrixAccounts,
                          xiaohongshu: {
                            ...prev.matrixAccounts.xiaohongshu,
                            webhookUrl: local,
                          },
                          douyin: {
                            ...prev.matrixAccounts.douyin,
                            webhookUrl: local,
                          },
                          instagram: {
                            ...prev.matrixAccounts.instagram,
                            webhookUrl: local,
                          },
                          tiktok: {
                            ...prev.matrixAccounts.tiktok,
                            webhookUrl: local,
                          },
                        },
                      }));
                      showToast("已填入本地 Connector Webhook", "ok");
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    使用本地 Connector（127.0.0.1:8787）
                  </button>
                  <div className="text-xs text-gray-500">
                    先运行 <span className="font-mono">npm run webhook:dev</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {matrixApps.map((app) => {
                    const token = form.matrixAccounts[app.id].token;
                    const webhookUrl = form.matrixAccounts[app.id].webhookUrl;
                    const connected = Boolean(token.trim());
                    const autoEnabled = Boolean(webhookUrl.trim());
                    const saving = matrixSaving[app.id];
                    return (
                      <div
                        key={app.id}
                        className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                "h-2.5 w-2.5 rounded-full",
                                statusDotClass(connected),
                              ].join(" ")}
                              aria-label={connected ? "已授权" : "未授权"}
                            />
                            <div className="text-sm font-semibold text-gray-900">
                              {app.name}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {connected ? "已配置" : "未配置"}{" "}
                            {autoEnabled ? "· 可自动发布" : "· 手动发布"}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Auth Token
                          </label>
                          <input
                            type="password"
                            value={token}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                matrixAccounts: {
                                  ...prev.matrixAccounts,
                                  [app.id]: {
                                    ...prev.matrixAccounts[app.id],
                                    token: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="token..."
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            说明：Token 仅用于后续自动发布/第三方 webhook；当前发布中心默认安全预演。
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Publish Webhook URL（可选）
                          </label>
                          <input
                            value={webhookUrl}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                matrixAccounts: {
                                  ...prev.matrixAccounts,
                                  [app.id]: {
                                    ...prev.matrixAccounts[app.id],
                                    webhookUrl: e.target.value,
                                  },
                                },
                              }))
                            }
                            placeholder="https://your-service.example.com/webhook/publish"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                          />
                          <div className="mt-2 text-xs text-gray-500">
                            填了后「矩阵发布中心」可一键自动发布（由你的服务/脚本执行真实发帖）。
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveMatrix(app.id)}
                          disabled={saving}
                          className="w-full rounded-xl bg-gray-900 text-white font-semibold py-2.5 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? "保存中..." : "保存"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === "personalization" && (
              <section className="space-y-6">
                <div>
                  <div className="text-lg font-bold text-gray-900">个性化</div>
                  <div className="text-sm text-gray-500 mt-1">
                    选择桌面背景主题（点击即可生效）。
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {backgroundOptions.map((bg) => {
                    const selected =
                      form.personalization.desktopBackground === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            personalization: {
                              ...prev.personalization,
                              desktopBackground: bg.id,
                            },
                          }));
                          showToast(`已切换背景：${bg.name}`, "ok");
                        }}
                        className={[
                          "rounded-2xl border overflow-hidden text-left transition-all",
                          selected
                            ? "border-blue-500 ring-4 ring-blue-100"
                            : "border-gray-200 hover:border-gray-300",
                        ].join(" ")}
                      >
                        <div className={["h-28", bg.className].join(" ")} />
                        <div className="p-4 bg-white flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {bg.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {selected ? "当前使用中" : "点击切换"}
                            </div>
                          </div>
                          {selected && (
                            <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <span className="text-xs font-bold">✓</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
