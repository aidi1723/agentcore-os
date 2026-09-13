"use client";

import { useEffect, useState } from "react";
import { Globe, KeyRound, Palette, Settings as SettingsIcon, Sparkles, Zap } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
  type InterfaceLanguage,
} from "@/lib/settings";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

type SettingsTab = "personalization" | "openclaw" | "runtime";

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof SettingsIcon }> = [
  { id: "personalization", label: "个性化", icon: Palette },
  { id: "openclaw", label: "OpenClaw Agent", icon: Sparkles },
  { id: "runtime", label: "运行时", icon: Zap },
];

const languageOptions: Array<{ id: InterfaceLanguage; label: string }> = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en-US", label: "English" },
  { id: "ja-JP", label: "日本語" },
];

export function SettingsAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<SettingsTab>("personalization");
  const { toast, showToast } = useTimedToast(1800);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => setSettings(loadSettings());
    sync();
    const removeListener = addRuntimeEventListener(RuntimeEventNames.settings, sync);
    window.addEventListener("storage", sync);
    return () => {
      removeListener();
      window.removeEventListener("storage", sync);
    };
  }, [isVisible]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    saveSettings(next);
    setSettings(next);
    showToast("设置已保存", "ok");
  };

  const updatePersonalization = (partial: Partial<AppSettings["personalization"]>) => {
    updateSettings({
      personalization: { ...settings.personalization, ...partial },
    });
  };

  const updateOpenClaw = (partial: Partial<AppSettings["openclaw"]>) => {
    updateSettings({
      openclaw: { ...settings.openclaw, ...partial },
    });
  };

  const updateRuntime = (partial: Partial<AppSettings["runtime"]>) => {
    updateSettings({
      runtime: { ...settings.runtime, ...partial },
    });
  };

  const resetToDefaults = () => {
    saveSettings(defaultSettings);
    setSettings(defaultSettings);
    showToast("已重置为默认设置", "ok");
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
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">系统设置</h1>
              <p className="mt-1 text-sm text-gray-500">
                配置界面语言、OpenClaw Agent 参数和运行时选项。
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={resetToDefaults}
            >
              重置为默认值
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    isActive
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-900">{tab.label}</span>
                </button>
              );
            })}
          </aside>

          <main className="space-y-4">
            {activeTab === "personalization" && (
              <>
                <Card padding="md">
                  <CardHeader
                    title="界面语言"
                    subtitle="选择系统界面显示的语言。"
                  />
                  <CardBody spacing="md">
                    <div className="flex flex-wrap gap-2">
                      {languageOptions.map((option) => (
                        <Button
                          key={option.id}
                          variant={
                            settings.personalization.interfaceLanguage === option.id
                              ? "primary"
                              : "secondary"
                          }
                          size="md"
                          onClick={() => updatePersonalization({ interfaceLanguage: option.id })}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </CardBody>
                </Card>

              </>
            )}

            {activeTab === "openclaw" && (
              <>
                <Card padding="md">
                  <CardHeader
                    title="OpenClaw Agent 配置"
                    subtitle="配置智能 Agent 的基础参数。"
                  />
                  <CardBody spacing="md">
                    <Input
                      label="Base URL"
                      value={settings.openclaw.baseUrl}
                      onChange={(e) => updateOpenClaw({ baseUrl: e.target.value })}
                      placeholder="http://127.0.0.1:18789"
                      fullWidth
                    />
                    <Input
                      label="API Token"
                      type="password"
                      value={settings.openclaw.apiToken}
                      onChange={(e) => updateOpenClaw({ apiToken: e.target.value })}
                      placeholder="留空则不使用认证"
                      fullWidth
                    />
                  </CardBody>
                </Card>
              </>
            )}

            {activeTab === "runtime" && (
              <>
                <Card padding="md">
                  <CardHeader
                    title="本地运行时配置"
                    subtitle="配置本地 AgentCore 运行时地址。"
                  />
                  <CardBody spacing="md">
                    <Input
                      label="本地运行时 URL"
                      value={settings.runtime.localRuntimeUrl}
                      onChange={(e) => updateRuntime({ localRuntimeUrl: e.target.value })}
                      placeholder="http://127.0.0.1:18789"
                      fullWidth
                    />
                    <Input
                      label="Sidecar API URL"
                      value={settings.runtime.sidecarApiUrl}
                      onChange={(e) => updateRuntime({ sidecarApiUrl: e.target.value })}
                      placeholder="http://127.0.0.1:18790"
                      fullWidth
                    />
                    <Input
                      label="Local App URL"
                      value={settings.runtime.localAppUrl}
                      onChange={(e) => updateRuntime({ localAppUrl: e.target.value })}
                      placeholder="http://127.0.0.1:3000"
                      fullWidth
                    />
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="执行器配置"
                    subtitle="配置 Agent 执行器的运行参数。"
                  />
                  <CardBody spacing="md">
                    <Input
                      label="Claw Code Binary Path"
                      value={settings.runtime.clawCodeBinaryPath}
                      onChange={(e) => updateRuntime({ clawCodeBinaryPath: e.target.value })}
                      placeholder="/usr/local/bin/claw"
                      fullWidth
                    />
                    <Input
                      label="Claw Code Workspace"
                      value={settings.runtime.clawCodeWorkspace}
                      onChange={(e) => updateRuntime({ clawCodeWorkspace: e.target.value })}
                      placeholder="~/workspace"
                      fullWidth
                    />
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="运行时开关"
                    subtitle="控制运行时的行为特性。"
                  />
                  <CardBody spacing="md">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.runtime.autoBootLocalStack}
                          onChange={(e) => updateRuntime({ autoBootLocalStack: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启动时自动启动本地堆栈</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.runtime.detectDockerOnLaunch}
                          onChange={(e) => updateRuntime({ detectDockerOnLaunch: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启动时检测 Docker</span>
                      </label>
                    </div>
                  </CardBody>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
