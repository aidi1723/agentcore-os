"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";

type SpotlightApp = { id: string; name: string };

export function Spotlight({
  open,
  onClose,
  apps = [],
  onOpenApp,
}: {
  open: boolean;
  onClose: () => void;
  apps?: SpotlightApp[];
  onOpenApp?: (appId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const taskIdRef = useRef<TaskId | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setValue("");
    setResult("");
    setIsRunning(false);
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const run = async () => {
    const message = value.trim().replace(/^>\s*/, "");
    if (!message || isRunning) return;

    setIsRunning(true);
    setResult("");
    taskIdRef.current = createTask({
      name: "Assistant - Spotlight Command",
      status: "running",
      detail: message.slice(0, 80),
    });

    try {
      const res = await fetch("/api/openclaw/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: "webos-spotlight" }),
      });
      const data = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; text?: string; error?: string };

      if (!res.ok || !data?.ok) {
        const error = data?.error || "执行失败，请检查 OpenClaw 是否运行";
        setResult(error);
        if (taskIdRef.current) {
          updateTask(taskIdRef.current, { status: "error", detail: error });
        }
        return;
      }

      const text = String(data.text ?? "").trim();
      setResult(text || "（无输出）");
      if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "请求异常";
      setResult(errorMessage);
      if (taskIdRef.current) {
        updateTask(taskIdRef.current, { status: "error", detail: errorMessage });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const items = useMemo(() => {
    const q = value.trim().replace(/^>\s*/, "").toLowerCase();
    const showCommand = Boolean(q);
    const appMatches = q
      ? apps
          .filter((a) => {
            const hay = `${a.name} ${a.id}`.toLowerCase();
            return hay.includes(q);
          })
          .slice(0, 7)
      : apps.slice(0, 7);

    const list: Array<
      | { kind: "command"; title: string; subtitle: string }
      | { kind: "app"; app: SpotlightApp }
    > = [];

    if (showCommand) {
      list.push({
        kind: "command",
        title: `执行指令：${q}`,
        subtitle: "Enter：执行 · ↑↓：选择 · ESC：关闭",
      });
    }

    for (const app of appMatches) list.push({ kind: "app", app });
    return list;
  }, [apps, value]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, value]);

  const activate = async () => {
    const item = items[activeIndex] ?? null;
    if (!item) return;
    if (item.kind === "app") {
      onOpenApp?.(item.app.id);
      onClose();
      return;
    }
    await run();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center pt-28"
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[820px] mx-6">
        <div className="rounded-[28px] border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="px-6 py-5">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  activate();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, items.length - 1)));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((prev) => Math.max(0, prev - 1));
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  inputRef.current?.focus();
                }
              }}
              placeholder="Spotlight: 输入指令或搜索应用..."
              className="w-full bg-transparent text-white placeholder:text-white/55 text-lg font-semibold tracking-tight focus:outline-none"
              aria-label="Spotlight Input"
            />
          </div>
          <div className="h-px bg-white/10" />
          <div className="px-6 py-4">
            <div className="space-y-3">
              {items.length > 0 ? (
                <div
                  role="listbox"
                  aria-label="Spotlight results"
                  className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden"
                >
                  {items.map((item, idx) => {
                    const active = idx === activeIndex;
                    if (item.kind === "command") {
                      return (
                        <button
                          key={`cmd:${idx}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setActiveIndex(idx)}
                          onDoubleClick={() => {
                            setActiveIndex(idx);
                            activate();
                          }}
                          className={[
                            "w-full text-left px-4 py-3 transition-colors",
                            active ? "bg-white/10" : "hover:bg-white/5",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-white/90">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-white/55 mt-0.5">
                            {item.subtitle}
                          </div>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={item.app.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setActiveIndex(idx);
                          onOpenApp?.(item.app.id);
                          onClose();
                        }}
                        className={[
                          "w-full flex items-center justify-between gap-3 text-left px-4 py-3 transition-colors",
                          active ? "bg-white/10" : "hover:bg-white/5",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white/90 truncate">
                            {item.app.name}
                          </div>
                          <div className="text-[11px] text-white/50 mt-0.5 font-mono truncate">
                            {item.app.id}
                          </div>
                        </div>
                        <div className="text-[11px] text-white/55">打开</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-white/55">
                  输入内容以执行指令，或搜索应用。
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                {isRunning ? (
                  <div className="text-xs text-white/65">Assistant is thinking...</div>
                ) : result ? (
                  <pre className="max-h-[32vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-white/85">
                    {result}
                  </pre>
                ) : (
                  <div className="text-xs text-white/55">
                    提示：Enter 执行 · ↑↓ 选择 · ESC 关闭 · 用 <span className="font-mono">{">"}</span> 强制指令模式
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
