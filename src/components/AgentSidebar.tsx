"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";

import type { AppId } from "@/apps/types";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  getDisplayLanguage,
  getShellLabel,
} from "@/lib/app-display";
import {
  buildChatPromptSuggestions,
} from "@/lib/home-command-center";
import type { InterfaceLanguage, LlmProviderId } from "@/lib/settings";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";
import { providerLabel } from "@/lib/desktop-helpers";
import { createTask, updateTask } from "@/lib/tasks";

function AgentCoreLogoMark({
  size = 32,
  roundedClassName = "rounded-[12px]",
}: {
  size?: number;
  roundedClassName?: string;
}) {
  return (
    <div
      className={[
        "relative shrink-0 overflow-hidden ring-1 ring-white/18 shadow-[0_10px_24px_rgba(36,118,255,0.28)]",
        roundedClassName,
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      <Image
        src="/agentcore-logo.png"
        alt="AgentCore OS"
        fill
        sizes={`${size}px`}
        className="object-cover"
        priority
      />
    </div>
  );
}

type AgentSidebarMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  error?: boolean;
};

type AgentSidebarSessionMeta = {
  id: string;
  title: string;
  updatedAt: number;
  lastMessage: string;
};

const AGENT_SIDEBAR_MAX_SESSIONS = 40;
const AGENT_SIDEBAR_MAX_MESSAGES = 120;
const AGENT_SIDEBAR_MESSAGE_KEY_PREFIX = "agentcore.desktop.agent-sidebar.messages.";
const AGENT_SIDEBAR_MESSAGE_KEY_SUFFIX = ".v1";

function normalizeAgentSidebarSessions(sessions: AgentSidebarSessionMeta[]) {
  const deduped = new Map<string, AgentSidebarSessionMeta>();
  for (const session of sessions) {
    if (!session?.id) continue;
    deduped.set(session.id, session);
  }
  return Array.from(deduped.values())
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, AGENT_SIDEBAR_MAX_SESSIONS);
}

function extractAgentSidebarMessageTimestamp(message: AgentSidebarMessage) {
  const match = message.id.match(/^(\d+)/);
  const timestamp = Number(match?.[1] ?? "");
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function recoverAgentSidebarSessionsFromStorage(storage: Storage) {
  const recovered: AgentSidebarSessionMeta[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      !key ||
      !key.startsWith(AGENT_SIDEBAR_MESSAGE_KEY_PREFIX) ||
      !key.endsWith(AGENT_SIDEBAR_MESSAGE_KEY_SUFFIX)
    ) {
      continue;
    }

    const sessionId = key.slice(
      AGENT_SIDEBAR_MESSAGE_KEY_PREFIX.length,
      key.length - AGENT_SIDEBAR_MESSAGE_KEY_SUFFIX.length,
    );
    if (!sessionId) continue;

    try {
      const raw = storage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as AgentSidebarMessage[]) : null;
      if (!Array.isArray(parsed) || parsed.length === 0) continue;

      const firstUserMessage = parsed.find((message) => message.role === "user" && message.text.trim());
      const lastMessage = [...parsed]
        .reverse()
        .find((message) => message.text.trim());
      const updatedAt =
        parsed.reduce(
          (latest, message) => Math.max(latest, extractAgentSidebarMessageTimestamp(message)),
          0,
        ) || Date.now();

      recovered.push({
        id: sessionId,
        title: firstUserMessage?.text.slice(0, 18) || "恢复的会话",
        updatedAt,
        lastMessage: lastMessage?.text.slice(0, 60) || "",
      });
    } catch {
      // ignore malformed orphaned session payloads
    }
  }

  return normalizeAgentSidebarSessions(recovered);
}

function isAgentSidebarSessionEmpty(session: AgentSidebarSessionMeta) {
  return !session.lastMessage.trim() && ["新对话", "默认会话"].includes(session.title);
}

function pickPreferredAgentSidebarSessionId(
  sessions: AgentSidebarSessionMeta[],
  savedActiveSessionId: string | null,
) {
  if (savedActiveSessionId && sessions.some((session) => session.id === savedActiveSessionId)) {
    return savedActiveSessionId;
  }
  const latestNonEmptySession = sessions.find((session) => !isAgentSidebarSessionEmpty(session));
  return latestNonEmptySession?.id ?? sessions[0]?.id ?? "";
}

export function AgentSidebar({
  collapsed,
  width,
  language,
  activeProvider,
  scenarioTitle,
  contextSummary,
  onToggleCollapsed,
  onResize,
}: {
  collapsed: boolean;
  width: number;
  language: InterfaceLanguage;
  activeProvider: LlmProviderId;
  scenarioTitle?: string;
  contextSummary: string;
  onToggleCollapsed: () => void;
  onResize: (nextWidth: number) => void;
}) {
  const sessionsStorageKey = "agentcore.desktop.agent-sidebar.sessions.v1";
  const activeSessionStorageKey = "agentcore.desktop.agent-sidebar.active-session.v1";
  const buildMessageStorageKey = (sessionId: string) =>
    `agentcore.desktop.agent-sidebar.messages.${sessionId}.v1`;
  const createWelcomeMessage = (text?: string): AgentSidebarMessage => ({
    id: `${Date.now()}-welcome`,
    role: "assistant",
    text:
      text ||
      "我是 AgentCore OS 助手。你可以直接让我拆任务、做调研、整理工作流，或给当前桌面下一步建议。",
  });
  const createSessionMeta = (title = "新对话"): AgentSidebarSessionMeta => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    updatedAt: Date.now(),
    lastMessage: "",
  });

  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionStrip, setShowSessionStrip] = useState(false);
  const [showPromptStrip, setShowPromptStrip] = useState(false);
  const [sessions, setSessions] = useState<AgentSidebarSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messagesBySessionId, setMessagesBySessionId] = useState<
    Record<string, AgentSidebarMessage[]>
  >({});
  const [storageHydrated, setStorageHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const messages = useMemo(() => {
    if (!activeSessionId) return [createWelcomeMessage()];
    return messagesBySessionId[activeSessionId] ?? [createWelcomeMessage()];
  }, [activeSessionId, messagesBySessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawSessions = window.localStorage.getItem(sessionsStorageKey);
      const parsedSessions = rawSessions ? (JSON.parse(rawSessions) as AgentSidebarSessionMeta[]) : null;
      const recoveredSessions = recoverAgentSidebarSessionsFromStorage(window.localStorage);
      const initialSessions =
        Array.isArray(parsedSessions) && parsedSessions.length > 0
          ? normalizeAgentSidebarSessions([...parsedSessions, ...recoveredSessions])
          : recoveredSessions.length > 0
            ? recoveredSessions
          : [createSessionMeta("默认会话")];
      setSessions(initialSessions);
      const savedActive = window.localStorage.getItem(activeSessionStorageKey);
      const resolvedActive = pickPreferredAgentSidebarSessionId(initialSessions, savedActive);
      setActiveSessionId(resolvedActive);
    } catch {
      const fallback = [createSessionMeta("默认会话")];
      setSessions(fallback);
      setActiveSessionId(fallback[0].id);
    } finally {
      setStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!storageHydrated || !activeSessionId || typeof window === "undefined") return;
    setMessagesBySessionId((prev) => {
      if (prev[activeSessionId]) return prev;
      try {
        const raw = window.localStorage.getItem(buildMessageStorageKey(activeSessionId));
        const parsed = raw ? (JSON.parse(raw) as AgentSidebarMessage[]) : null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            ...prev,
            [activeSessionId]: parsed.slice(-AGENT_SIDEBAR_MAX_MESSAGES),
          };
        }
      } catch {
        // ignore
      }
      return {
        ...prev,
        [activeSessionId]: [createWelcomeMessage()],
      };
    });
  }, [activeSessionId, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        sessionsStorageKey,
        JSON.stringify(normalizeAgentSidebarSessions(sessions)),
      );
      if (activeSessionId) {
        window.localStorage.setItem(activeSessionStorageKey, activeSessionId);
      }
    } catch {
      // ignore
    }
  }, [activeSessionId, sessions, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || typeof window === "undefined") return;
    try {
      for (const [sessionId, sessionMessages] of Object.entries(messagesBySessionId)) {
        window.localStorage.setItem(
          buildMessageStorageKey(sessionId),
          JSON.stringify(sessionMessages.slice(-AGENT_SIDEBAR_MAX_MESSAGES)),
        );
      }
    } catch {
      // ignore
    }
  }, [messagesBySessionId, storageHydrated]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, collapsed]);

  const suggestions = useMemo(() => {
    const displayLanguage = getDisplayLanguage(language);
    if (displayLanguage === "en") {
      return [
        "Plan my top 3 actions for today",
        "Audit this workspace for automation gaps",
        "Turn this workflow into an SOP",
      ];
    }
    if (displayLanguage === "ja") {
      return [
        "今日の優先アクションを3つに絞って",
        "このワークスペースの自動化不足を点検して",
        "このフローをSOPにして",
      ];
    }
    return [
      "帮我拆今天最重要的 3 个动作",
      "检查这个工作台还有哪些自动化薄弱点",
      "把当前流程整理成 SOP 清单",
    ];
  }, [language]);

  const pinnedPrompts = useMemo(
    () => [
      {
        id: "priority",
        label: "今日优先级",
        prompt: "根据当前工作台，帮我整理今天最重要的 3 个执行动作，并说明先后顺序。",
      },
      {
        id: "automation",
        label: "自动化排查",
        prompt: "请审视当前工作台和流程，指出最值得优先补齐的自动化薄弱点。",
      },
      {
        id: "sop",
        label: "SOP 生成",
        prompt: "把当前这套工作流整理成简明 SOP，要求能直接交给团队执行。",
      },
    ],
    [],
  );

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  const clearConversation = () => {
    if (!activeSessionId) return;
    setMessagesBySessionId((prev) => ({
      ...prev,
      [activeSessionId]: [createWelcomeMessage("已清空当前会话。你可以继续基于当前工作台提问。")],
    }));
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? { ...session, title: "新对话", updatedAt: Date.now(), lastMessage: "" }
          : session,
      ),
    );
  };

  const createNewSession = () => {
    const reusableEmptySession = sessions.find((session) => isAgentSidebarSessionEmpty(session));
    if (reusableEmptySession) {
      setActiveSessionId(reusableEmptySession.id);
      setMessagesBySessionId((prev) => ({
        ...prev,
        [reusableEmptySession.id]: [createWelcomeMessage("已回到现有空白会话。")],
      }));
      return;
    }
    const next = createSessionMeta("新对话");
    setSessions((prev) => normalizeAgentSidebarSessions([next, ...prev]));
    setActiveSessionId(next.id);
    setMessagesBySessionId((prev) => ({
      ...prev,
      [next.id]: [createWelcomeMessage("已创建一个新的对话会话。")],
    }));
  };

  const deleteSession = (sessionId: string) => {
    const remaining = sessions.filter((session) => session.id !== sessionId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(buildMessageStorageKey(sessionId));
      } catch {
        // ignore
      }
    }
    if (remaining.length === 0) {
      const fallback = createSessionMeta("新对话");
      setSessions([fallback]);
      setActiveSessionId(fallback.id);
      setMessagesBySessionId({
        [fallback.id]: [createWelcomeMessage()],
      });
      return;
    }
    setSessions(remaining);
    setMessagesBySessionId((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const insertContextIntoDraft = () => {
    setDraft((prev) => {
      const next = prev.trim();
      return [next, "## 当前工作台上下文", contextSummary]
        .filter(Boolean)
        .join(next ? "\n\n" : "\n");
    });
  };

  const sendMessage = async (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text || loading || !activeSessionId) return;

    const targetSessionId = activeSessionId;

    const userMessage: AgentSidebarMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    };
    const runningTaskId = createTask({
      name: "Agent Sidebar Chat",
      status: "running",
      detail: text.slice(0, 80),
    });

    setMessagesBySessionId((prev) => {
      const current = prev[targetSessionId] ?? [createWelcomeMessage()];
      return {
        ...prev,
        [targetSessionId]: [...current, userMessage].slice(-AGENT_SIDEBAR_MAX_MESSAGES),
      };
    });
    setSessions((prev) =>
      prev
        .map((session) =>
          session.id === targetSessionId
            ? {
                ...session,
                title: session.title === "新对话" ? text.slice(0, 18) : session.title,
                updatedAt: Date.now(),
                lastMessage: text.slice(0, 60),
              }
            : session,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
    setDraft("");
    setLoading(true);

    try {
      const reply = await requestOpenClawAgent({
        message: text,
        sessionId: `webos-desktop-agent-sidebar-${targetSessionId}`,
        timeoutSeconds: 45,
      });
      const assistantMessage: AgentSidebarMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: reply || "（没有返回内容）",
      };
      setMessagesBySessionId((prev) => {
        const current = prev[targetSessionId] ?? [createWelcomeMessage()];
        return {
          ...prev,
          [targetSessionId]: [...current, assistantMessage].slice(-AGENT_SIDEBAR_MAX_MESSAGES),
        };
      });
      setSessions((prev) =>
        prev
          .map((session) =>
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  lastMessage: (reply || "（没有返回内容）").slice(0, 60),
                }
              : session,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
      updateTask(runningTaskId, { status: "done", detail: "对话完成" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      const errorMessage: AgentSidebarMessage = {
        id: `${Date.now()}-error`,
        role: "assistant",
        text: message,
        error: true,
      };
      setMessagesBySessionId((prev) => {
        const current = prev[targetSessionId] ?? [createWelcomeMessage()];
        return {
          ...prev,
          [targetSessionId]: [...current, errorMessage].slice(-AGENT_SIDEBAR_MAX_MESSAGES),
        };
      });
      setSessions((prev) =>
        prev
          .map((session) =>
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  lastMessage: message.slice(0, 60),
                }
              : session,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
      updateTask(runningTaskId, { status: "error", detail: message });
    } finally {
      setLoading(false);
    }
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      onResize(startWidth + delta);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  if (collapsed) {
    return (
      <aside className="absolute bottom-28 right-4 z-[45]">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="group inline-flex items-center gap-3 rounded-[22px] bg-[linear-gradient(180deg,rgba(7,12,24,0.9)_0%,rgba(10,17,32,0.82)_100%)] px-4 py-3 text-white shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl transition-transform hover:-translate-y-0.5"
          title="展开聊天"
          aria-label="展开聊天"
        >
          <AgentCoreLogoMark size={40} roundedClassName="rounded-2xl" />
          <span className="flex flex-col items-start">
            <span className="text-sm font-semibold text-white">聊天</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-white/58">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {providerLabel(activeProvider)}
            </span>
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="absolute bottom-24 right-4 top-20 z-[45] flex flex-col overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,rgba(7,12,24,0.92)_0%,rgba(15,23,42,0.86)_58%,rgba(11,18,32,0.82)_100%)] shadow-[0_24px_72px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
      style={{ width }}
    >
      <div
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize"
        onPointerDown={startResize}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-2.5 border-b border-white/10 px-3 py-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72">
            <AgentCoreLogoMark size={22} roundedClassName="rounded-[8px]" />
            聊天
          </div>
          <div className="mt-2 text-[13px] font-semibold text-white">随时对话</div>
          <div className="mt-0.5 text-[11px] leading-4 text-white/58">
            {scenarioTitle ? `当前工作台：${scenarioTitle}` : "当前工作台未固定"} · {providerLabel(activeProvider)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={createNewSession}
            className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/82 transition-colors hover:bg-white/15"
          >
            新建
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/82 transition-colors hover:bg-white/15"
            title="折叠侧栏"
            aria-label="折叠侧栏"
          >
            <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="space-y-2">
          <div className="rounded-[18px] bg-white/[0.05] p-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowSessionStrip((prev) => !prev)}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white"
              >
                {showSessionStrip ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                会话
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/56">
                  {sessions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const latestNonEmptySession = sessions.find(
                    (session) =>
                      session.id !== activeSessionId && !isAgentSidebarSessionEmpty(session),
                  );
                  if (latestNonEmptySession) {
                    setActiveSessionId(latestNonEmptySession.id);
                  }
                }}
                className="text-[11px] font-semibold text-white/62 transition-colors hover:text-white"
                disabled={!sessions.some(
                  (session) => session.id !== activeSessionId && !isAgentSidebarSessionEmpty(session),
                )}
              >
                回到最近
              </button>
              <button
                type="button"
                onClick={clearConversation}
                className="text-[11px] font-semibold text-white/62 transition-colors hover:text-white"
              >
                清空当前
              </button>
            </div>
            {showSessionStrip ? (
              <div className="mt-2.5 max-h-72 space-y-2 overflow-y-auto pr-1">
                {sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={[
                        "rounded-2xl border px-3 py-2",
                        active ? "border-white/20 bg-white/14" : "border-white/10 bg-white/6",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveSessionId(session.id)}
                        className="w-full text-left"
                      >
                        <div className="truncate text-xs font-semibold text-white">
                          {session.title || "新对话"}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/52">
                          {session.lastMessage || "暂无消息"}
                        </div>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-[10px] text-white/35">
                          {active ? "当前会话" : new Date(session.updatedAt).toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSession(session.id)}
                          className="text-[10px] font-semibold text-white/45 transition-colors hover:text-white/80"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="rounded-[18px] bg-white/[0.05] p-1.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPromptStrip((prev) => !prev)}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58 transition-colors hover:text-white"
              >
                {showPromptStrip ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                常用
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/56">
                  {pinnedPrompts.length + suggestions.length}
                </span>
              </button>
              <button
                type="button"
                onClick={insertContextIntoDraft}
                className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/76 transition-colors hover:bg-white/14"
              >
                插入上下文
              </button>
            </div>
            {showPromptStrip ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[...pinnedPrompts.map((item) => item.label), ...suggestions].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const preset = pinnedPrompts.find((prompt) => prompt.label === item);
                      void sendMessage(preset?.prompt ?? item);
                    }}
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/78 transition-colors hover:bg-white/14"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={[
                "max-w-[92%] rounded-[20px] border px-3 py-2.5 text-[13px] leading-6 shadow-sm",
                message.role === "user"
                  ? "ml-auto border-sky-200/30 bg-sky-400/12 text-white"
                  : message.error
                    ? "border-rose-300/30 bg-rose-400/10 text-rose-50"
                    : "border-white/10 bg-white/8 text-white/86",
              ].join(" ")}
            >
              {message.text}
            </div>
          ))}
          {loading ? (
            <div className="max-w-[92%] rounded-[20px] border border-white/10 bg-white/8 px-3 py-2.5 text-[13px] text-white/65">
              正在处理...
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="rounded-[20px] border border-white/10 bg-black/14 p-2.5">
          <div className="mb-2.5 rounded-[16px] border border-white/8 bg-white/6 px-3 py-1.5 text-[10px] leading-5 text-white/52">
            当前会话：{activeSession?.title || "新对话"}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            rows={3}
            placeholder="直接提问，例如：根据当前工作台，帮我给今天排一个执行顺序。"
            className="w-full resize-none bg-transparent text-[13px] leading-5 text-white outline-none placeholder:text-white/35"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="text-[10px] leading-4 text-white/48">
              `Enter` 发送，`Shift + Enter` 换行
            </div>
            <button
              type="button"
              disabled={loading || !draft.trim()}
              onClick={() => void sendMessage()}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-950 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ArrowRight className="h-3 w-3" />
              发送
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

