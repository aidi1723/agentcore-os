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

export type RuntimeCockpitMetric = {
  id: "playbook" | "approvals" | "recovery" | "governance";
  label: string;
  value: string;
  detail: string;
  tone: CommandCenterTone;
};

export type RuntimeCockpitSummary = {
  title: string;
  subtitle: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  metrics: RuntimeCockpitMetric[];
};

function displayLanguage(language: InterfaceLanguage) {
  if (language === "en-US") return "en";
  if (language === "ja-JP") return "ja";
  return "zh";
}

function formatRunState(state: string | null | undefined, lang: "zh" | "en" | "ja") {
  if (lang === "zh") {
    if (state === "running") return "运行中";
    if (state === "completed") return "已完成";
    if (state === "error") return "异常";
    if (state === "awaiting_human") return "待审批";
    return "未启动";
  }
  if (lang === "ja") {
    if (state === "running") return "Running";
    if (state === "completed") return "Completed";
    if (state === "error") return "Failed";
    if (state === "awaiting_human") return "Awaiting review";
    return "Not started";
  }
  if (state === "running") return "Running";
  if (state === "completed") return "Completed";
  if (state === "error") return "Failed";
  if (state === "awaiting_human") return "Awaiting review";
  return "Not started";
}

export function buildRuntimeCockpitSummary({
  runtimeReady,
  runtimeLabel,
  scenarioTitle,
  workflowTitle,
  selectedRunState,
  pendingApprovalCount,
  runningCount,
  failedCount,
  language,
}: {
  runtimeReady: boolean;
  runtimeLabel: string;
  scenarioTitle?: string | null;
  workflowTitle?: string | null;
  selectedRunState?: string | null;
  pendingApprovalCount: number;
  runningCount: number;
  failedCount: number;
  language: InterfaceLanguage;
}): RuntimeCockpitSummary {
  const lang = displayLanguage(language);
  const text = {
    zh: {
      title: "受控 Playbook 指挥台",
      fallback: "选择一个受控 playbook 来检查执行状态",
      primaryAction: "打开 Runtime Console",
      secondaryAction: "运行受控 playbook",
      playbook: "Playbook 运行",
      playbookDetail: "当前受控执行状态",
      approvals: "审批",
      approvalsDetail: "人工复核关口",
      recovery: "恢复",
      recoveryDetail: "失败或可重试运行",
      governance: "治理门禁",
      governanceReady: "正常",
      governanceCheck: "需检查",
      governanceDetail: "governed trace 和 replay gates",
    },
    en: {
      title: "Controlled Playbook Cockpit",
      fallback: "Select a controlled playbook to inspect execution state",
      primaryAction: "Open Runtime Console",
      secondaryAction: "Run controlled playbook",
      playbook: "Playbook run",
      playbookDetail: "Current controlled execution state",
      approvals: "Approvals",
      approvalsDetail: "Human review gates",
      recovery: "Recovery",
      recoveryDetail: "Failed or retryable runs",
      governance: "Governance gate",
      governanceReady: "Ready",
      governanceCheck: "Check",
      governanceDetail: "governed trace and replay gates",
    },
    ja: {
      title: "Controlled Playbook Cockpit",
      fallback: "実行状態を確認する controlled playbook を選択",
      primaryAction: "Runtime Console を開く",
      secondaryAction: "controlled playbook を実行",
      playbook: "Playbook run",
      playbookDetail: "Current controlled execution state",
      approvals: "Approvals",
      approvalsDetail: "Human review gates",
      recovery: "Recovery",
      recoveryDetail: "Failed or retryable runs",
      governance: "Governance gate",
      governanceReady: "Ready",
      governanceCheck: "Check",
      governanceDetail: "governed trace and replay gates",
    },
  }[lang];
  const titleParts = [scenarioTitle?.trim(), workflowTitle?.trim()].filter(Boolean);

  return {
    title: text.title,
    subtitle: titleParts.length ? titleParts.join(" · ") : text.fallback,
    primaryActionLabel: text.primaryAction,
    secondaryActionLabel: text.secondaryAction,
    metrics: [
      {
        id: "playbook",
        label: text.playbook,
        value: formatRunState(selectedRunState, lang),
        detail: text.playbookDetail,
        tone: selectedRunState === "error" ? "danger" : "neutral",
      },
      {
        id: "approvals",
        label: text.approvals,
        value: String(Math.max(0, pendingApprovalCount)),
        detail: text.approvalsDetail,
        tone: pendingApprovalCount > 0 ? "warning" : "neutral",
      },
      {
        id: "recovery",
        label: text.recovery,
        value: String(Math.max(0, failedCount)),
        detail: text.recoveryDetail,
        tone: failedCount > 0 ? "danger" : "neutral",
      },
      {
        id: "governance",
        label: text.governance,
        value: runtimeReady ? text.governanceReady : text.governanceCheck,
        detail: `${runtimeLabel} · ${text.governanceDetail}`,
        tone: runtimeReady ? "success" : "warning",
      },
    ],
  };
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

export function buildChatPromptSuggestions({
  quickCommands,
  starterTitle,
  limit,
}: {
  quickCommands: string[];
  starterTitle: string;
  limit: number;
}) {
  const suggestions = quickCommands.map((item) => item.trim()).filter(Boolean);
  if (suggestions.length === 0 && starterTitle.trim()) {
    suggestions.push(`继续推进：${starterTitle.trim()}`);
  }
  return suggestions.slice(0, Math.max(0, limit));
}
