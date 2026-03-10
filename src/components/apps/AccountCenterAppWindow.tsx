"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Globe,
  Mail,
  MessageCircle,
  Settings2,
  Shield,
  Smartphone,
} from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppWindowShell } from "@/components/windows/AppWindowShell";

type CategoryId = "social" | "cms" | "comms";

type PlatformCard = {
  id: string;
  name: string;
  category: CategoryId;
  logo: { kind: "icon"; icon: React.ReactNode; bgClassName: string };
  status: "authorized" | "needs_update";
  description?: string;
};

const categories: Array<{ id: CategoryId; name: string; icon: React.ReactNode }> =
  [
    { id: "social", name: "社交媒体", icon: <Smartphone className="h-4 w-4" /> },
    { id: "cms", name: "独立站与 CMS", icon: <Globe className="h-4 w-4" /> },
    { id: "comms", name: "邮件与通讯", icon: <Mail className="h-4 w-4" /> },
  ];

const statusLabel: Record<PlatformCard["status"], { dot: string; text: string }> =
  {
    authorized: { dot: "🟢", text: "已授权" },
    needs_update: { dot: "🔴", text: "需更新" },
  };

export function AccountCenterAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("social");
  const [toast, setToast] = useState<
    null | { message: string; tone: "ok" | "error" }
  >(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
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

  const cards: PlatformCard[] = useMemo(
    () => [
      {
        id: "xiaohongshu",
        name: "小红书",
        category: "social",
        status: "authorized",
        description: "内容发布 / 数据回传",
        logo: {
          kind: "icon",
          icon: <Shield className="h-5 w-5 text-white" />,
          bgClassName: "bg-gradient-to-br from-rose-500 to-pink-500",
        },
      },
      {
        id: "douyin",
        name: "抖音",
        category: "social",
        status: "needs_update",
        description: "矩阵分发 / 自动评论",
        logo: {
          kind: "icon",
          icon: <MessageCircle className="h-5 w-5 text-white" />,
          bgClassName: "bg-gradient-to-br from-slate-900 to-slate-700",
        },
      },
      {
        id: "site_admin",
        name: "示例站点后台",
        category: "cms",
        status: "needs_update",
        description: "商品 / 文章 / 订单同步",
        logo: {
          kind: "icon",
          icon: <Building2 className="h-5 w-5 text-white" />,
          bgClassName: "bg-gradient-to-br from-amber-500 to-orange-500",
        },
      },
      {
        id: "cms_generic",
        name: "CMS（通用）",
        category: "cms",
        status: "authorized",
        description: "Webhook / API Token",
        logo: {
          kind: "icon",
          icon: <Globe className="h-5 w-5 text-white" />,
          bgClassName: "bg-gradient-to-br from-sky-500 to-indigo-500",
        },
      },
      {
        id: "gmail",
        name: "Gmail",
        category: "comms",
        status: "authorized",
        description: "邮件触发 / 自动回复",
        logo: {
          kind: "icon",
          icon: <Mail className="h-5 w-5 text-white" />,
          bgClassName: "bg-gradient-to-br from-emerald-500 to-teal-500",
        },
      },
      {
        id: "wechat_work",
        name: "企业微信",
        category: "comms",
        status: "needs_update",
        description: "通知 / 机器人 / 群发",
        logo: {
          kind: "icon",
          icon: <Settings2 className="h-5 w-5 text-white" />,
          bgClassName: "bg-gradient-to-br from-blue-600 to-cyan-500",
        },
      },
    ],
    [],
  );

  const filtered = useMemo(
    () => cards.filter((c) => c.category === activeCategory),
    [cards, activeCategory],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="矩阵授权中心"
      icon={Shield}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.account_center"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
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
          {/* Left menu */}
          <aside className="w-60 border-r border-gray-200 bg-gray-50/60">
            <div className="p-5">
              <div className="text-xs font-semibold text-gray-500">
                Account Center
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">矩阵授权</div>
              <div className="mt-2 text-xs text-gray-500">
                统一管理各平台 Token / OAuth 状态
              </div>
            </div>

            <nav className="px-2 pb-4 space-y-1">
              {categories.map((cat) => {
                const active = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
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
                      {cat.icon}
                    </span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right grid */}
          <main className="flex-1 p-6">
            <div className="flex items-end justify-between gap-3 mb-5">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {categories.find((c) => c.id === activeCategory)?.name}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  点击卡片上的“配置/修改”进入授权流程（占位交互）。
                </div>
              </div>
              <div className="text-xs text-gray-500">
                共 {filtered.length} 个平台
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((card) => {
                const s = statusLabel[card.status];
                return (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={[
                            "h-12 w-12 rounded-2xl flex items-center justify-center shadow",
                            card.logo.bgClassName,
                          ].join(" ")}
                        >
                          {card.logo.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {card.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {card.description ?? "授权与权限配置"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-700 shrink-0">
                        {s.dot} {s.text}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">
                        最近更新：—
                      </div>
                      <button
                        type="button"
                        onClick={() => showToast("该平台授权流程待接入", "ok")}
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors"
                      >
                        配置/修改
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
