"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { ModeId } from "@/apps/types";
import { modes } from "@/apps/modes";
import {
  getDisplayLanguage,
  getModeDisplayName,
  getShellLabel,
} from "@/lib/app-display";
import { getLanguageLabel } from "@/lib/language";
import type { InterfaceLanguage, LlmProviderId } from "@/lib/settings";
import { providerLabel } from "@/lib/desktop-helpers";

function detectWelcomeLanguage(): InterfaceLanguage {
  if (typeof navigator === "undefined") return "en-US";
  const language = navigator.language.toLowerCase();
  if (language.startsWith("zh")) return "zh-CN";
  if (language.startsWith("ja")) return "ja-JP";
  return "en-US";
}

function getWelcomeCopy(language: InterfaceLanguage) {
  const displayLanguage = getDisplayLanguage(language);
  if (displayLanguage === "ja") {
    return {
      eyebrow: "Language",
      title: "使用する言語を選択",
      desc: "最初に表示言語を選びます。あとから上部バーでいつでも変更できます。",
      badge: "Global first",
      zhDesc: "中国語ユーザー向け",
      enDesc: "For global users",
      jaDesc: "日本語ユーザー向け",
    };
  }
  if (displayLanguage === "zh") {
    return {
      eyebrow: "语言",
      title: "选择你的语言",
      desc: "先选择界面语言，之后也可以随时从顶部栏切换。",
      badge: "全球优先",
      zhDesc: "适合中文用户",
      enDesc: "适合全球用户",
      jaDesc: "适合日语用户",
    };
  }
  return {
    eyebrow: "Language",
    title: "Choose your language",
    desc: "Pick the interface language first. You can change it anytime from the top bar.",
    badge: "Global first",
    zhDesc: "For Chinese users",
    enDesc: "For global users",
    jaDesc: "For Japanese users",
  };
}

export function LanguageCapsule({
  value,
  customLanguageLabel,
  onChange,
}: {
  value: InterfaceLanguage;
  customLanguageLabel: string;
  onChange: (next: InterfaceLanguage) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const items: Array<{ id: InterfaceLanguage; label: string; hint?: string }> = [
    { id: "zh-CN", label: "中文" },
    { id: "en-US", label: "English" },
    { id: "ja-JP", label: "日本語" },
    {
      id: "custom",
      label: customLanguageLabel.trim() || getShellLabel("customLanguage", value),
      hint: customLanguageLabel.trim()
        ? getShellLabel("customLanguageSet", value)
        : getShellLabel("openSettings", value),
    },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={[
          "max-w-[56vw] truncate rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:max-w-none sm:px-4",
          "shadow-sm",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Globe2 className="h-3.5 w-3.5" />
          {getLanguageLabel(value, customLanguageLabel)} ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 mt-2 w-[220px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0f18]/70 shadow-2xl backdrop-blur-2xl"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 text-[11px] font-semibold text-white/70">
            {getShellLabel("interfaceLanguage", value)}
          </div>
          <div className="space-y-1 p-2">
            {items.map((item) => {
              const active = item.id === value;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {active ? (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/80">
                      {getShellLabel("current", value)}
                    </span>
                  ) : item.hint ? (
                    <span className="text-[10px] text-white/45">{item.hint}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function LanguageWelcomeCard({
  customLanguageLabel,
  onSelect,
  onOpenSettings,
}: {
  customLanguageLabel: string;
  onSelect: (next: InterfaceLanguage) => void;
  onOpenSettings: () => void;
}) {
  const welcomeLanguage = useMemo(() => detectWelcomeLanguage(), []);
  const copy = useMemo(() => getWelcomeCopy(welcomeLanguage), [welcomeLanguage]);
  const items: Array<{ id: InterfaceLanguage; title: string; desc: string }> = [
    { id: "zh-CN", title: "中文", desc: copy.zhDesc },
    { id: "en-US", title: "English", desc: copy.enDesc },
    { id: "ja-JP", title: "日本語", desc: copy.jaDesc },
  ];

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/15 bg-[#0b0f18]/75 p-6 text-white shadow-2xl backdrop-blur-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
              {copy.eyebrow}
            </div>
            <div className="mt-2 text-2xl font-bold text-white">{copy.title}</div>
            <div className="mt-2 text-sm text-white/70">
              {copy.desc}
            </div>
          </div>
          <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/65">
            {copy.badge}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className="rounded-3xl border border-white/15 bg-white/5 p-5 text-left transition-colors hover:bg-white/10"
            >
              <div className="text-lg font-semibold text-white">{item.title}</div>
              <div className="mt-2 text-sm text-white/65">{item.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            {customLanguageLabel.trim() || getShellLabel("customLanguage", welcomeLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RuntimeOnboardingCard({
  onChooseLightRuntime,
  onOpenEngineSettings,
}: {
  onChooseLightRuntime: () => void;
  onOpenEngineSettings: () => void;
}) {
  return (
    <div className="absolute inset-0 z-[160] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-[linear-gradient(180deg,rgba(8,12,24,0.96)_0%,rgba(17,24,39,0.98)_100%)] p-6 shadow-[0_36px_120px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="flex justify-center">
          <AgentCoreLogoMark size={28} roundedClassName="rounded-[10px]" />
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onChooseLightRuntime}
            className="flex w-full items-center justify-between rounded-[24px] border border-emerald-200/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.2)_0%,rgba(255,255,255,0.05)_100%)] px-5 py-4 text-left transition-colors hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.26)_0%,rgba(255,255,255,0.08)_100%)]"
          >
            <span className="text-base font-semibold text-white">进入轻量级桌面</span>
            <ArrowRight className="h-4 w-4 text-emerald-100" />
          </button>

          <button
            type="button"
            onClick={onOpenEngineSettings}
            className="flex w-full items-center justify-between rounded-[24px] border border-white/12 bg-white/6 px-5 py-4 text-left transition-colors hover:bg-white/10"
          >
            <span className="text-base font-semibold text-white">配置桌面</span>
            <ArrowRight className="h-4 w-4 text-white/75" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModelCapsule({
  value,
  language,
  onChange,
}: {
  value: LlmProviderId;
  language: InterfaceLanguage;
  onChange: (next: LlmProviderId) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = () => setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const items: LlmProviderId[] = ["kimi"];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={[
          "max-w-[68vw] truncate rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm sm:max-w-none sm:px-4",
          "text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        ✨ {getShellLabel("engine", language)}: {providerLabel(value)} ▾
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 mt-2 w-[260px] rounded-2xl border border-white/15 bg-[#0b0f18]/70 backdrop-blur-2xl shadow-2xl overflow-hidden"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 text-[11px] font-semibold text-white/70">
            一键切换全局大模型
          </div>
          <div className="p-2 space-y-1">
            {items.map((id) => {
              const active = id === value;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(id);
                    setOpen(false);
                  }}
                  className={[
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                    active ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10",
                  ].join(" ")}
                >
                  <span>{providerLabel(id)}</span>
                  {active && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/80">
                      {getShellLabel("current", language)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-3 text-[11px] text-white/55">
            配置 Key/Base URL 请到「设置 → 大模型与助手」。
          </div>
        </div>
      )}
    </div>
  );
}

export function ModeSwitcher({
  value,
  language,
  onChange,
}: {
  value: ModeId;
  language: InterfaceLanguage;
  onChange: (next: ModeId) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModeId)}
        className="appearance-none rounded-md border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-label={getShellLabel("switchMode", language)}
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id} className="text-black">
            {getModeDisplayName(mode.id, mode.name, language)}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
        <span className="text-[10px]">▼</span>
      </div>
    </div>
  );
}

export function AgentCoreBrand() {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <AgentCoreLogoMark size={32} roundedClassName="rounded-lg" />
      <div className="min-w-0 leading-none">
        <div className="truncate text-[11px] font-semibold uppercase text-slate-950">
          AgentCore OS
        </div>
        <div className="truncate text-[10px] text-slate-500">
          Business Solution Operating System
        </div>
      </div>
    </div>
  );
}

export function AgentCoreLogoMark({
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
