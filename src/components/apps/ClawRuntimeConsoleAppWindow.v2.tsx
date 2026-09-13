"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Shield, TerminalSquare } from "lucide-react";

import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { useRuntimeDoctorReport } from "@/hooks/useRuntimeDoctorReport";
import { buildAgentCoreApiUrl } from "@/lib/app-api";
import { getDesktopRuntimeStatusSummary } from "@/lib/desktop-runtime";
import { addRuntimeEventListener, RuntimeEventNames } from "@/lib/runtime-events";
import { loadSettings, type AppSettings } from "@/lib/settings";
import { requestOpenSettings } from "@/lib/ui-events";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Card, CardHeader, CardBody } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

const DEFAULT_BASE = "http://127.0.0.1:18789";

export function ClawRuntimeConsoleAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [healthText, setHealthText] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const { toast, showToast } = useTimedToast(2000);

  const {
    report: runtimeDoctor,
    loading: runtimeDoctorLoading,
    refresh: refreshRuntimeDoctor,
  } = useRuntimeDoctorReport(isVisible);

  useEffect(() => {
    if (!isVisible) return;
    const syncFromSettings = () => {
      const settings = loadSettings();
      const configured = settings.runtime.localRuntimeUrl.trim() || settings.openclaw.baseUrl.trim();
      setSettings(settings);
      setBaseUrl(configured || DEFAULT_BASE);
    };
    syncFromSettings();
    const removeSettingsListener = addRuntimeEventListener(RuntimeEventNames.settings, syncFromSettings);
    window.addEventListener("storage", syncFromSettings);
    return () => {
      removeSettingsListener();
      window.removeEventListener("storage", syncFromSettings);
    };
  }, [isVisible]);

  const runtimeSummary = useMemo(
    () => getDesktopRuntimeStatusSummary(settings, runtimeDoctor),
    [settings, runtimeDoctor],
  );

  const checkHealth = async () => {
    setIsChecking(true);
    setHealthText("");
    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/runtime/gateway/health"), {
        method: "GET",
      });
      const data = (await res.json().catch(() => null)) as
        | null
        | { ok?: boolean; health?: unknown; error?: string };
      if (!res.ok || !data?.ok) {
        const err = data?.error || "检查失败";
        setHealthText(err);
        showToast(err, "error");
        return;
      }
      setHealthText(JSON.stringify(data.health ?? {}, null, 2));
      showToast("AgentCoreOS Runtime 正常", "ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "请求异常";
      setHealthText(message);
      showToast(message, "error");
    } finally {
      setIsChecking(false);
    }
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Runtime Console"
      icon={TerminalSquare}
      widthClassName="w-[980px]"
      storageKey="agentcore.window.claw_runtime_console"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">AgentCoreOS Runtime Console</h1>
              <p className="mt-1 text-sm text-gray-500">
                这里展示 AgentCore OS 的运行时执行状态、会话审计和本地诊断。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" size="md">
                <Shield className="mr-1 h-3 w-3" />
                Token 不下发到前端
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => requestOpenSettings("engine")}
              >
                打开设置
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <Card padding="lg">
            <CardHeader
              title={runtimeSummary.profileMeta.title}
              subtitle={runtimeSummary.profileMeta.desc}
              actions={
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => requestOpenSettings("engine")}
                >
                  打开运行时设置
                </Button>
              }
            />
            <CardBody spacing="md">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    LLM
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">API Only</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {runtimeSummary.providerConfigured ? "Provider configured" : "Provider key missing"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Shell
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {runtimeSummary.shell === "tauri" ? "Tauri Desktop" : "Browser / Web Shell"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">桌面版上线后这里会切到 Tauri</div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Orchestration
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {runtimeSummary.orchestrationMeta.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {runtimeSummary.orchestrationMeta.desc}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                    Runtime
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-900">
                    {runtimeSummary.initializationComplete ? "Ready" : "Needs setup"}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Local runtime and sidecar addresses can be tuned in settings.
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card padding="md">
            <CardHeader
              title="Initialization Status"
              subtitle="当前桌面运行时的可用性，统一按运行模式、云端模型和本地 sidecar 诊断结果判断。"
              actions={
                <Badge
                  variant={runtimeSummary.initializationComplete ? "success" : "warning"}
                  size="md"
                >
                  {runtimeSummary.initializationComplete ? (
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                  ) : (
                    <AlertTriangle className="mr-1 h-4 w-4" />
                  )}
                  {runtimeSummary.completedSteps}/{runtimeSummary.totalSteps} ready
                </Badge>
              }
            />
            <CardBody spacing="sm">
              <div className="space-y-2">
                {runtimeSummary.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                    <Badge
                      variant={
                        item.status === "ready"
                          ? "success"
                          : item.status === "attention"
                            ? "warning"
                            : "default"
                      }
                      size="sm"
                    >
                      {item.status === "ready" ? "Ready" : item.status === "attention" ? "Warning" : "Not ready"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card padding="md">
            <CardHeader
              title="Health Check"
              subtitle="测试 AgentCoreOS Runtime 的连通性和健康状态。"
              actions={
                <Button
                  variant="primary"
                  size="md"
                  icon={<RefreshCw className="h-4 w-4" />}
                  onClick={checkHealth}
                  disabled={isChecking}
                  loading={isChecking}
                >
                  {isChecking ? "检查中..." : "检查健康状态"}
                </Button>
              }
            />
            <CardBody spacing="md">
              <Input
                label="Runtime Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:18789"
                fullWidth
              />

              {healthText && (
                <pre className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
                  {healthText}
                </pre>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ExternalLink className="h-4 w-4" />}
                  onClick={() => openExternal(baseUrl)}
                >
                  打开控制台 Dashboard
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={refreshRuntimeDoctor}
                  disabled={runtimeDoctorLoading}
                >
                  刷新诊断报告
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card padding="md">
            <CardHeader
              title="Runtime Doctor Report"
              subtitle="本地运行时的详细诊断信息。"
            />
            <CardBody spacing="md">
              {runtimeDoctorLoading ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  正在加载诊断报告...
                </div>
              ) : runtimeDoctor ? (
                <pre className="overflow-auto rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-700">
                  {JSON.stringify(runtimeDoctor, null, 2)}
                </pre>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                  没有可用的诊断报告
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppWindowShell>
  );
}
