import type { AppId } from "@/apps/types";
import type { InterfaceLanguage } from "@/lib/settings";

export type CommandCenterShortcutId = "workflows" | "approvals" | "assets" | "runtime";
export type CommandCenterTone = "neutral" | "success" | "warning" | "danger";

export type CommandCenterShortcut = {
  id: CommandCenterShortcutId;
  appId: AppId;
  label: string;
  detail: string;
  tone: CommandCenterTone;
};

export type CommandCenterAttentionCard = {
  id: "approvals" | "running" | "failures" | "runtime";
  label: string;
  value: string;
  detail: string;
  tone: CommandCenterTone;
};

function displayLanguage(language: InterfaceLanguage) {
  if (language === "en-US") return "en";
  if (language === "ja-JP") return "ja";
  return "zh";
}

export function buildCommandCenterShortcuts({
  runtimeReady,
  runtimeLabel,
  scenarioTitle,
  workflowAppId,
  assetAppId,
  language,
}: {
  runtimeReady: boolean;
  runtimeLabel: string;
  scenarioTitle?: string | null;
  workflowAppId?: AppId | null;
  assetAppId?: AppId | null;
  language: InterfaceLanguage;
}): CommandCenterShortcut[] {
  const lang = displayLanguage(language);
  const text = {
    zh: {
      workflows: "工作流",
      approvals: "审批",
      assets: "资产",
      runtime: "运行时",
      workflowFallback: "选择角色桌面后继续执行",
      approvalsDetail: "人工确认、阻塞项和任务状态",
      assetsDetail: "沉淀可复用结果与知识",
      runtimeWarning: "Runtime 需要检查",
    },
    en: {
      workflows: "Workflows",
      approvals: "Approvals",
      assets: "Assets",
      runtime: "Runtime",
      workflowFallback: "Choose a role desk to continue",
      approvalsDetail: "Human checks, blockers, and task state",
      assetsDetail: "Reusable results and knowledge",
      runtimeWarning: "Runtime needs attention",
    },
    ja: {
      workflows: "Workflows",
      approvals: "Approvals",
      assets: "Assets",
      runtime: "Runtime",
      workflowFallback: "ロールデスクを選んで続行",
      approvalsDetail: "確認、ブロック、タスク状態",
      assetsDetail: "再利用できる成果と知識",
      runtimeWarning: "Runtime needs attention",
    },
  }[lang];

  return [
    {
      id: "workflows",
      appId: workflowAppId ?? "task_manager",
      label: text.workflows,
      detail: scenarioTitle?.trim() || text.workflowFallback,
      tone: "neutral",
    },
    {
      id: "approvals",
      appId: "task_manager",
      label: text.approvals,
      detail: text.approvalsDetail,
      tone: "warning",
    },
    {
      id: "assets",
      appId: assetAppId ?? "knowledge_vault",
      label: text.assets,
      detail: text.assetsDetail,
      tone: "success",
    },
    {
      id: "runtime",
      appId: "runtime_console",
      label: text.runtime,
      detail: runtimeReady ? runtimeLabel : text.runtimeWarning,
      tone: runtimeReady ? "success" : "warning",
    },
  ];
}

export function buildCommandCenterAssets({
  scenarioAssets,
  starterAssets,
  limit,
}: {
  scenarioAssets: string[];
  starterAssets: string[];
  limit: number;
}) {
  const source = scenarioAssets.length ? scenarioAssets : starterAssets;
  return source.map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

export function buildCommandCenterAttentionCards({
  pendingApprovalCount,
  runningCount,
  failedCount,
  runtimeReady,
  language,
}: {
  pendingApprovalCount: number;
  runningCount: number;
  failedCount: number;
  runtimeReady: boolean;
  language: InterfaceLanguage;
}): CommandCenterAttentionCard[] {
  const lang = displayLanguage(language);
  const text = {
    zh: {
      approvals: "待人工确认",
      approvalsDetail: "需要判断、授权或复核",
      running: "运行中任务",
      runningDetail: "正在执行或窗口已打开",
      failures: "失败/重试",
      failuresDetail: "需要检查异常链路",
      runtime: "运行时",
      runtimeReady: "正常",
      runtimeWarning: "需检查",
      runtimeDetail: "AgentCoreOS Runtime 状态",
    },
    en: {
      approvals: "Approvals",
      approvalsDetail: "Needs review or authorization",
      running: "Running",
      runningDetail: "Executing or already opened",
      failures: "Failures",
      failuresDetail: "Needs recovery",
      runtime: "Runtime",
      runtimeReady: "Ready",
      runtimeWarning: "Check",
      runtimeDetail: "AgentCoreOS Runtime state",
    },
    ja: {
      approvals: "Approvals",
      approvalsDetail: "確認または承認が必要",
      running: "Running",
      runningDetail: "実行中または開いています",
      failures: "Failures",
      failuresDetail: "復旧が必要",
      runtime: "Runtime",
      runtimeReady: "Ready",
      runtimeWarning: "Check",
      runtimeDetail: "AgentCoreOS Runtime state",
    },
  }[lang];

  return [
    {
      id: "approvals",
      label: text.approvals,
      value: String(Math.max(0, pendingApprovalCount)),
      detail: text.approvalsDetail,
      tone: pendingApprovalCount > 0 ? "warning" : "neutral",
    },
    {
      id: "running",
      label: text.running,
      value: String(Math.max(0, runningCount)),
      detail: text.runningDetail,
      tone: "neutral",
    },
    {
      id: "failures",
      label: text.failures,
      value: String(Math.max(0, failedCount)),
      detail: text.failuresDetail,
      tone: failedCount > 0 ? "danger" : "neutral",
    },
    {
      id: "runtime",
      label: text.runtime,
      value: runtimeReady ? text.runtimeReady : text.runtimeWarning,
      detail: text.runtimeDetail,
      tone: runtimeReady ? "success" : "warning",
    },
  ];
}
