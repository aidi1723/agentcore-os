import type { AppId } from "@/apps/types";
import type { InterfaceLanguage, LlmProviderId } from "@/lib/settings";
import type { WorkflowRunRecord } from "@/lib/workflow-runs";
import type { IndustrySolutionStarter } from "@/lib/solution-starters";
import type { CommandCenterTone } from "@/lib/home-command-center";
import type { WorkspaceRoleDesk } from "@/lib/workspace-presets";
import { getDisplayLanguage } from "@/lib/app-display";
import { getAppDisplayName } from "@/lib/app-display";
import { getApp } from "@/apps/registry";

export function uniqueAppIds(appIds: AppId[]) {
  return Array.from(new Set(appIds));
}

export function getRunStateMeta(run: WorkflowRunRecord | null) {
  switch (run?.state) {
    case "running":
      return { label: "运行中", className: "border-sky-200 bg-sky-50 text-sky-700" };
    case "awaiting_human":
      return { label: "待人工确认", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "completed":
      return { label: "已完成", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "error":
      return { label: "异常", className: "border-rose-200 bg-rose-50 text-rose-700" };
    default:
      return { label: "未启动", className: "border-slate-200 bg-white text-slate-600" };
  }
}

export function getWorkflowModeMeta(mode: "auto" | "assist" | "review" | "manual") {
  switch (mode) {
    case "auto":
      return { label: "自动", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    case "assist":
      return { label: "协作", className: "border-sky-200 bg-sky-50 text-sky-700" };
    case "review":
      return { label: "审核", className: "border-amber-200 bg-amber-50 text-amber-700" };
    case "manual":
    default:
      return { label: "人工", className: "border-slate-200 bg-white text-slate-600" };
  }
}

export function commandCenterToneClass(tone: CommandCenterTone) {
  const map: Record<CommandCenterTone, string> = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return map[tone];
}

export function providerLabel(id: LlmProviderId) {
  const map: Record<LlmProviderId, string> = {
    kimi: "Kimi (Moonshot)",
    deepseek: "DeepSeek",
    openai: "OpenAI",
    anthropic: "Claude (Anthropic)",
    qwen: "通义千问",
  };
  return map[id];
}

export function getAppShortName(appId: AppId, language: InterfaceLanguage) {
  const app = getApp(appId);
  const fullName = getAppDisplayName(appId, app.name, language);
  return fullName.length > 14 ? `${fullName.slice(0, 14)}…` : fullName;
}

export const workspaceCategoryOrder = [
  "workflow",
  "insight",
  "content",
  "relationship",
  "personal",
  "system",
] as const;
