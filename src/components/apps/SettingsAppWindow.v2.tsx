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

type SettingsTab = "personalization" | "openclaw" | "runtime" | "advanced";

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof SettingsIcon }> = [
  { id: "personalization", label: "个性化", icon: Palette },
  { id: "openclaw", label: "OpenClaw Agent", icon: Sparkles },
  { id: "runtime", label: "运行时", icon: Zap },
  { id: "advanced", label: "高级", icon: KeyRound },
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

                <Card padding="md">
                  <CardHeader
                    title="输出语言偏好"
                    subtitle="AI 生成内容时优先使用的语言。"
                  />
                  <CardBody spacing="md">
                    <Input
                      label="偏好语言"
                      value={settings.personalization.outputLanguagePreference}
                      onChange={(e) =>
                        updatePersonalization({ outputLanguagePreference: e.target.value })
                      }
                      placeholder="例如：中文 / English / 日本語"
                      fullWidth
                    />
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="用户身份标识"
                    subtitle="用于个性化推荐和内容生成。"
                  />
                  <CardBody spacing="md">
                    <Input
                      label="用户名称"
                      value={settings.personalization.userName}
                      onChange={(e) => updatePersonalization({ userName: e.target.value })}
                      placeholder="你的名字"
                      fullWidth
                    />
                    <Input
                      label="用户角色"
                      value={settings.personalization.userRole}
                      onChange={(e) => updatePersonalization({ userRole: e.target.value })}
                      placeholder="例如：创作者 / 产品经理 / 开发者"
                      fullWidth
                    />
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
                      label="会话 ID"
                      value={settings.openclaw.sessionId}
                      onChange={(e) => updateOpenClaw({ sessionId: e.target.value })}
                      placeholder="agent:main:main"
                      fullWidth
                    />
                    <Input
                      label="超时时间（秒）"
                      type="number"
                      value={settings.openclaw.timeoutSeconds}
                      onChange={(e) =>
                        updateOpenClaw({ timeoutSeconds: parseInt(e.target.value, 10) || 60 })
                      }
                      placeholder="60"
                      fullWidth
                    />
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="系统提示词"
                    subtitle="为 Agent 添加全局系统提示词。"
                  />
                  <CardBody spacing="md">
                    <Textarea
                      label="全局系统提示词"
                      value={settings.openclaw.systemPromptOverride}
                      onChange={(e) => updateOpenClaw({ systemPromptOverride: e.target.value })}
                      placeholder="留空使用默认提示词..."
                      rows={6}
                      fullWidth
                    />
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="功能开关"
                    subtitle="控制 Agent 的行为特性。"
                  />
                  <CardBody spacing="md">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.openclaw.enableSkills}
                          onChange={(e) => updateOpenClaw({ enableSkills: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启用技能系统</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.openclaw.enableMemory}
                          onChange={(e) => updateOpenClaw({ enableMemory: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启用记忆功能</span>
                      </label>
                    </div>
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
                      label="Sidecar 地址"
                      value={settings.runtime.sidecarAddress}
                      onChange={(e) => updateRuntime({ sidecarAddress: e.target.value })}
                      placeholder="http://127.0.0.1:18790"
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
                      label="LLM Provider"
                      value={settings.runtime.llmProvider}
                      onChange={(e) => updateRuntime({ llmProvider: e.target.value })}
                      placeholder="openai / anthropic / azure"
                      fullWidth
                    />
                    <Input
                      label="LLM Model"
                      value={settings.runtime.llmModel}
                      onChange={(e) => updateRuntime({ llmModel: e.target.value })}
                      placeholder="gpt-4 / claude-3-opus"
                      fullWidth
                    />
                    <Input
                      label="最大并发数"
                      type="number"
                      value={settings.runtime.maxConcurrentExecutions}
                      onChange={(e) =>
                        updateRuntime({
                          maxConcurrentExecutions: parseInt(e.target.value, 10) || 3,
                        })
                      }
                      placeholder="3"
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
                          checked={settings.runtime.enableAutoRetry}
                          onChange={(e) => updateRuntime({ enableAutoRetry: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启用自动重试</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.runtime.enableCaching}
                          onChange={(e) => updateRuntime({ enableCaching: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启用结果缓存</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.runtime.enableTelemetry}
                          onChange={(e) => updateRuntime({ enableTelemetry: e.target.checked })}
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启用遥测数据</span>
                      </label>
                    </div>
                  </CardBody>
                </Card>
              </>
            )}

            {activeTab === "advanced" && (
              <>
                <Card padding="md">
                  <CardHeader
                    title="高级配置"
                    subtitle="专家选项，谨慎修改。"
                  />
                  <CardBody spacing="md">
                    <Input
                      label="调试模式日志级别"
                      value={settings.advanced?.logLevel ?? "info"}
                      onChange={(e) =>
                        updateSettings({
                          advanced: { ...settings.advanced, logLevel: e.target.value },
                        })
                      }
                      placeholder="debug / info / warn / error"
                      fullWidth
                    />
                    <Input
                      label="API 请求超时（毫秒）"
                      type="number"
                      value={settings.advanced?.apiTimeout ?? 30000}
                      onChange={(e) =>
                        updateSettings({
                          advanced: {
                            ...settings.advanced,
                            apiTimeout: parseInt(e.target.value, 10) || 30000,
                          },
                        })
                      }
                      placeholder="30000"
                      fullWidth
                    />
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="实验性功能"
                    subtitle="这些功能可能不稳定，仅用于测试。"
                  />
                  <CardBody spacing="md">
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.advanced?.enableExperimentalFeatures ?? false}
                          onChange={(e) =>
                            updateSettings({
                              advanced: {
                                ...settings.advanced,
                                enableExperimentalFeatures: e.target.checked,
                              },
                            })
                          }
                          className="h-5 w-5 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900">启用实验性功能</span>
                      </label>
                    </div>
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="数据管理"
                    subtitle="管理本地存储的数据。"
                  />
                  <CardBody spacing="md">
                    <div className="space-y-3">
                      <Button
                        variant="danger"
                        size="md"
                        onClick={() => {
                          if (confirm("确定要清空所有本地数据吗？此操作不可恢复。")) {
                            localStorage.clear();
                            sessionStorage.clear();
                            showToast("本地数据已清空", "ok");
                          }
                        }}
                      >
                        清空所有本地数据
                      </Button>
                      <p className="text-xs text-gray-500">
                        这将删除所有草稿、任务、知识库条目和其他本地数据。设置将保留。
                      </p>
                    </div>
                  </CardBody>
                </Card>

                <Card padding="md">
                  <CardHeader
                    title="当前配置"
                    subtitle="查看完整的配置对象（调试用）。"
                  />
                  <CardBody spacing="md">
                    <pre className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
                      {JSON.stringify(settings, null, 2)}
                    </pre>
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
