"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { AppId } from "@/apps/types";
import { getApp } from "@/apps/registry";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import {
  getAppDisplayName,
  getAppCategory,
  getCategoryMeta,
  getDisplayLanguage,
} from "@/lib/app-display";
import {
  buildCommandCenterAssets,
  buildCommandCenterAttentionCards,
  buildCommandCenterShortcuts,
  buildChatPromptSuggestions,
  buildRuntimeCockpitSummary,
  type CommandCenterTone,
} from "@/lib/home-command-center";
import type { InterfaceLanguage, LlmProviderId } from "@/lib/settings";
import { getActiveLlmConfig, loadSettings } from "@/lib/settings";
import {
  getIndustryBundle,
  mapIndustryToWorkspaceIndustry,
  type IndustryId,
} from "@/lib/industry-solutions";
import {
  type IndustrySolutionStarter,
} from "@/lib/solution-starters";
import {
  getWorkspaceScenario,
  workspaceIndustries,
  workspaceRoleDesks,
  type WorkspaceRoleDesk,
} from "@/lib/workspace-presets";
import {
  getWorkflowRuns,
  startWorkflowRun,
  subscribeWorkflowRuns,
  type WorkflowRunRecord,
} from "@/lib/workflow-runs";
import { createTask, updateTask } from "@/lib/tasks";
import {
  getRunStateMeta,
  getWorkflowModeMeta,
  commandCenterToneClass,
  providerLabel,
} from "@/lib/desktop-helpers";
import { CommandCenterSidebar } from "@/components/CommandCenterSidebar";

function getPrivacySafeStarterTitle(
  starter: IndustrySolutionStarter,
  fallback: string,
  language: InterfaceLanguage,
) {
  const displayLanguage = getDisplayLanguage(language);
  const map: Record<string, { zh: string; en: string; ja: string }> = {
    "sales-inbound-quote": {
      zh: "销售询盘处理",
      en: "Sales Intake Flow",
      ja: "営業問い合わせ処理",
    },
    "creator-campaign-sprint": {
      zh: "内容增长冲刺",
      en: "Creator Sprint",
      ja: "コンテンツ成長スプリント",
    },
    "support-escalation-recovery": {
      zh: "客服升级处理",
      en: "Support Recovery",
      ja: "サポート復旧フロー",
    },
    "research-market-scan": {
      zh: "研究扫描任务",
      en: "Research Scan",
      ja: "リサーチスキャン",
    },
  };

  return map[starter.id]?.[displayLanguage] || fallback;
}

function getCompactRunSummary(run: WorkflowRunRecord | null, stageCount: number) {
  if (!run) {
    return `未启动 · ${stageCount} 个阶段`;
  }
  const currentIndex = run.currentStageId
    ? run.stageRuns.findIndex((stage) => stage.id === run.currentStageId)
    : run.state === "completed"
      ? run.stageRuns.length - 1
      : -1;
  const visibleIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  return `${getRunStateMeta(run).label} · ${visibleIndex}/${Math.max(stageCount, 1)} 阶段`;
}

function getAppShortName(appId: AppId, language: InterfaceLanguage) {
  const app = getApp(appId);
  const fullName = getAppDisplayName(appId, app.name, language);
  return fullName.length > 14 ? `${fullName.slice(0, 14)}…` : fullName;
}

function getDeskShellCopy(
  roleDesk: WorkspaceRoleDesk | null,
  language: InterfaceLanguage,
) {
  const displayLanguage = getDisplayLanguage(language);
  const roleId = roleDesk?.id ?? "ceo";

  if (displayLanguage === "en") {
    const copy: Record<
      string,
      { hero: string; desc: string; intake: string; notes: string }
    > = {
        creator: {
          hero: "Bring me the angle, signal, and founder voice. I turn it into publishable content.",
          desc: "Use this desk to decide the content line first, then move into drafting, preflight, and asset retention.",
          intake: "Today's content intake",
          notes: "Creator notes",
        },
        sales: {
          hero: "Bring me the lead, context, and follow-up window. I turn it into the next sales move.",
          desc: "Qualify the lead, draft the outreach, and keep CRM + task closure in one operating surface.",
          intake: "Today's pipeline intake",
          notes: "Sales notes",
        },
        ops: {
          hero: "Bring me the blockers, owners, and timeline. I turn them into an executable ops chain.",
          desc: "Keep project status, task closure, and risk sync visible without spreading across tools.",
          intake: "Today's ops intake",
          notes: "Ops notes",
        },
        research: {
          hero: "Bring me the topic, source, and hypothesis. I turn them into a usable research brief.",
          desc: "This desk keeps signal intake, analysis, and reusable insight on the same path.",
          intake: "Today's research intake",
          notes: "Research notes",
        },
        people: {
          hero: "Bring me the role, candidate context, and next step. I turn them into a clear hiring flow.",
          desc: "Keep hiring decisions, interview notes, and follow-up in one stable desk.",
          intake: "Today's hiring intake",
          notes: "People notes",
        },
        ceo: {
          hero: "Bring me the signal, pressure, and decision context. I turn them into today's operating priorities.",
          desc: "The command desk keeps the summary, risk, and next move visible with the fewest possible clicks.",
          intake: "Today's command intake",
          notes: "Command notes",
        },
      };
    return copy[roleId] ?? copy.ceo;
  }

  if (displayLanguage === "ja") {
    const copy: Record<
      string,
      { hero: string; desc: string; intake: string; notes: string }
    > = {
        creator: {
          hero: "企画、話題、発信者の原文を渡してください。公開できるコンテンツに変えます。",
          desc: "最初に今日の主線を決め、その後で改稿、配信前確認、資産化へ進みます。",
          intake: "今日の入力",
          notes: "Creator メモ",
        },
        sales: {
          hero: "リード、文脈、追客タイミングを渡してください。次の営業アクションに変えます。",
          desc: "リード判定、メール草案、CRM 推進、タスク収口を同じ画面で管理します。",
          intake: "今日の営業入力",
          notes: "Sales メモ",
        },
        ops: {
          hero: "課題、担当者、納期を渡してください。実行可能な運営チェーンに変えます。",
          desc: "プロジェクト進行、リスク同期、実行状況を散らさずに保持します。",
          intake: "今日の運営入力",
          notes: "Ops メモ",
        },
        research: {
          hero: "テーマ、ソース、仮説を渡してください。使える調査ブリーフに変えます。",
          desc: "情報取得、分析、再利用可能な知見を一つのデスクでつなぎます。",
          intake: "今日の調査入力",
          notes: "Research メモ",
        },
        people: {
          hero: "職種、候補者情報、次の一手を渡してください。明確な採用フローに変えます。",
          desc: "面接記録、候補者判断、次の連絡を一つの採用デスクで管理します。",
          intake: "今日の採用入力",
          notes: "People メモ",
        },
        ceo: {
          hero: "シグナル、圧力、判断材料を渡してください。今日の経営優先事項に変えます。",
          desc: "要約、リスク、次の一手を最少クリックで確認できる指揮デスクです。",
          intake: "今日の経営入力",
          notes: "Command メモ",
        },
      };
    return copy[roleId] ?? copy.ceo;
  }

  const copy: Record<
    string,
    { hero: string; desc: string; intake: string; notes: string }
  > = {
      creator: {
        hero: "把选题、热点、老板原话给我，我来变成能直接发布的内容。",
        desc: "这块桌面先收口今天的内容主线，再决定改写、预演、分发和资产沉淀怎么推进。",
        intake: "今日创作入口",
        notes: "Creator Desk 说明",
      },
      sales: {
        hero: "把线索、背景、跟进窗口给我，我来变成下一步销售动作。",
        desc: "这里优先做线索判断、邮件推进和 CRM 收口，不让销售流程停在原始消息层。",
        intake: "今日销售入口",
        notes: "Sales Desk 说明",
      },
      ops: {
        hero: "把阻塞、责任人和时间线给我，我来变成可执行的推进链。",
        desc: "项目、周报、风险同步和任务收口放在同一块桌面里，不再靠多个页面跳转来回找。",
        intake: "今日运营入口",
        notes: "Ops Desk 说明",
      },
      research: {
        hero: "把主题、来源和假设给我，我来变成可复用的研究结论。",
        desc: "研究输入、分析过程和观点沉淀保持在同一条工作链里，方便继续流转到内容和决策。",
        intake: "今日研究入口",
        notes: "Research Desk 说明",
      },
      people: {
        hero: "把岗位、候选人信息和下一步给我，我来变成清晰的招聘推进链。",
        desc: "筛选、记录、跟进和招聘闭环都留在这块桌面里，不让招聘动作散在多个工具之间。",
        intake: "今日招聘入口",
        notes: "People Desk 说明",
      },
      ceo: {
        hero: "把信号、压力和决策上下文给我，我来变成今天真正该盯的优先级。",
        desc: "这块桌面只保留摘要、风险、推进和下一步，适合经营视角快速判断今天主线。",
        intake: "今日指挥入口",
        notes: "Command Desk 说明",
      },
    };

  return copy[roleId] ?? copy.ceo;
}

const workspaceCategoryOrder = [
  "workflow",
  "insight",
  "content",
  "relationship",
  "personal",
  "system",
] as const;

type DeskCommandMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  error?: boolean;
};

type DeskExecutionEvent = {
  id: string;
  title: string;
  detail: string;
  tone: "default" | "success" | "error";
};

type DeskExecutorSessionTurn = {
  id: string;
  ok: boolean;
  message: string;
  outputText?: string;
  error?: string;
};

const DESK_COMMAND_MAX_MESSAGES = 24;

function extractDeskCommandText(message: string) {
  const marker = "用户命令：";
  const markerIndex = message.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return message.slice(markerIndex + marker.length).trim();
  }
  return message.trim();
}

function buildDeskMessagesFromTurns(turns: DeskExecutorSessionTurn[]) {
  return turns
    .flatMap<DeskCommandMessage>((turn) => {
      const messages: DeskCommandMessage[] = [];
      const userText = extractDeskCommandText(turn.message);
      if (userText) {
        messages.push({
          id: `${turn.id}-user`,
          role: "user",
          text: userText,
        });
      }
      const assistantText = turn.ok
        ? turn.outputText?.trim() || "（没有返回内容）"
        : turn.error?.trim() || "请求失败";
      if (assistantText) {
        messages.push({
          id: `${turn.id}-${turn.ok ? "assistant" : "error"}`,
          role: "assistant",
          text: assistantText,
          error: !turn.ok,
        });
      }
      return messages;
    })
    .slice(-DESK_COMMAND_MAX_MESSAGES);
}

export function SolutionCenterPanel({
  language,
  activeProvider,
  runtimeReady,
  runtimeLabel,
  starters,
  onLaunchStarter,
  onEnterRoleDesk,
  onOpenApp,
  onOpenIndustryHub,
  onOpenSolutionsHub,
}: {
  language: InterfaceLanguage;
  activeProvider: LlmProviderId;
  runtimeReady: boolean;
  runtimeLabel: string;
  starters: IndustrySolutionStarter[];
  onLaunchStarter: (starter: IndustrySolutionStarter) => void;
  onEnterRoleDesk: (roleDesk: WorkspaceRoleDesk, industryId: IndustryId) => void;
  onOpenApp: (appId: AppId) => void;
  onOpenIndustryHub: () => void;
  onOpenSolutionsHub: () => void;
}) {
  const [selectedStarterId, setSelectedStarterId] = useState(starters[0]?.id ?? "");
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunRecord[]>([]);
  const [commandDraft, setCommandDraft] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandMessagesByStarterId, setCommandMessagesByStarterId] = useState<
    Record<string, DeskCommandMessage[]>
  >({});
  const [executionEventsByStarterId, setExecutionEventsByStarterId] = useState<
    Record<string, DeskExecutionEvent[]>
  >({});

  useEffect(() => {
    if (!selectedStarterId && starters[0]?.id) {
      setSelectedStarterId(starters[0].id);
    }
  }, [selectedStarterId, starters]);

  useEffect(() => {
    const sync = () => setWorkflowRuns(getWorkflowRuns());
    sync();
    const off = subscribeWorkflowRuns(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      off();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const displayLanguage = getDisplayLanguage(language);
  const selectedStarter =
    starters.find((starter) => starter.id === selectedStarterId) ?? starters[0] ?? null;
  const selectedBundle = selectedStarter ? getIndustryBundle(selectedStarter.bundleId) : null;
  const selectedScenario = selectedStarter
    ? getWorkspaceScenario(selectedStarter.scenarioId)
    : null;
  const roleDesk = selectedStarter?.roleId
    ? workspaceRoleDesks.find((desk) => desk.id === selectedStarter.roleId) ?? null
    : null;
  const groupedIndustries = useMemo(
    () =>
      workspaceIndustries
        .map((industry) => {
          const industryStarters = starters.filter(
            (starter) => mapIndustryToWorkspaceIndustry(starter.industryId) === industry.id,
          );
          if (!industryStarters.length) return null;
          return { industry, starters: industryStarters };
        })
        .filter(
          (
            item,
          ): item is {
            industry: (typeof workspaceIndustries)[number];
            starters: IndustrySolutionStarter[];
          } => Boolean(item),
        ),
    [starters],
  );

  const selectedWorkspaceIndustryId = selectedStarter
    ? mapIndustryToWorkspaceIndustry(selectedStarter.industryId)
    : groupedIndustries[0]?.industry.id;
  const selectedIndustryGroup =
    groupedIndustries.find((item) => item.industry.id === selectedWorkspaceIndustryId) ??
    groupedIndustries[0] ??
    null;
  const selectedIndustryStarters = selectedIndustryGroup?.starters ?? [];
  const deskCopy = getDeskShellCopy(roleDesk, language);

  const copy = useMemo(() => {
    if (displayLanguage === "en") {
      return {
        rail: "Departments",
        industryHub: "Industry hub",
        library: "Solution library",
        launch: "Run workflow",
        role: "Open role desk",
        workflow: "Workflow chain",
        focus: "Desk focus",
        sameIndustry: "Related flows",
        apps: "Key apps",
        stage: "Stage",
        runtime: "Runtime",
        desk: "Command desk",
        intake: "Task command",
        noRole: "No dedicated role desk yet.",
        headline: "Turn the department target into one executable chain.",
        commandHint: "Describe the goal, customer, constraints, and what should happen next.",
        commandPlaceholder:
          "Example: Search and qualify 20 manufacturing leads in Shanghai, draft first outreach, and break the work into a verifiable chain.",
        commandAction: "Send command",
        latest: "Latest assistant response",
        progress: "Execution feed",
        quick: "Quick commands",
        appsDesc: "Open only the apps that belong to this chain.",
        sameIndustryDesc: "Switch to a nearby operating chain without leaving the desk.",
        workflowDesc: "Keep the current stage, mode, and output visible.",
        progressIdle: "Waiting for a command. The desk will log dispatch and result status here.",
        dispatching: "Dispatching to executor",
        completed: "Result returned",
        failed: "Execution failed",
        enterHint: "Enter to send, Shift + Enter for newline",
        openApp: "Open app",
        desktopState: "Desk state",
        deliverables: "Deliverables",
      };
    }
    if (displayLanguage === "ja") {
      return {
        rail: "部門",
        industryHub: "Industry Hub",
        library: "Solutions",
        launch: "ワークフローを起動",
        role: "ロールデスクを開く",
        workflow: "ワークフロー主線",
        focus: "デスクの焦点",
        sameIndustry: "近いフロー",
        apps: "主要アプリ",
        stage: "段階",
        runtime: "実行状態",
        desk: "指揮デスク",
        intake: "タスク命令",
        noRole: "専用ロールデスクはまだありません。",
        headline: "部門の目標を、一つの実行チェーンにまとめます。",
        commandHint: "目標、顧客、制約、次に起こすべきことをまとめて入力してください。",
        commandPlaceholder:
          "例: 上海の製造業リードを 20 件調査・選別し、初回アプローチ案を作成し、確認可能な作業チェーンに分解してください。",
        commandAction: "命令を送信",
        latest: "最新応答",
        progress: "実行フィード",
        quick: "クイック命令",
        appsDesc: "このチェーンに必要なアプリだけを開きます。",
        sameIndustryDesc: "デスクを離れずに近い業務フローへ切り替えます。",
        workflowDesc: "現在の段階、モード、出力物を見失わないための表示です。",
        progressIdle: "命令待ちです。実行器への送出と結果返却がここに記録されます。",
        dispatching: "実行器へ送信中",
        completed: "結果を受信",
        failed: "実行失敗",
        enterHint: "Enter 送信 / Shift + Enter 改行",
        openApp: "アプリを開く",
        desktopState: "デスク状態",
        deliverables: "成果物",
      };
    }
    return {
      rail: "部门模式",
      industryHub: "行业中心",
      library: "方案库",
      launch: "启动工作流",
      role: "打开角色桌面",
      workflow: "工作流主线",
      focus: "桌面焦点",
      sameIndustry: "同部门链路",
      apps: "关键应用",
      stage: "阶段",
      runtime: "运行状态",
      desk: "执行指挥台",
      intake: "任务指令",
      noRole: "当前还没有绑定专属角色桌面。",
      headline: "把部门目标直接压缩成一条可执行、可回看的任务链。",
      commandHint: "直接描述目标、客户、约束条件和你期待的下一步动作。",
      commandPlaceholder:
        "例如：帮销售部自动搜索并筛选 20 个潜在客户，按优先级排序，起草第一轮触达内容，并生成可执行的任务推进链。",
      commandAction: "发送命令",
      latest: "最新执行回执",
      progress: "执行动态",
      quick: "快捷命令",
      appsDesc: "只打开这条链真正需要的应用，减少桌面噪音。",
      sameIndustryDesc: "不离开当前桌面，快速切换到同部门的相邻工作链。",
      workflowDesc: "把阶段、模式和当前产出钉在右侧，方便持续盯进度。",
      progressIdle: "等待新命令。任务接收、执行器派发和返回结果都会在这里显示。",
      dispatching: "已派发到底层执行器",
      completed: "已收到执行结果",
      failed: "执行异常",
      enterHint: "Enter 发送，Shift + Enter 换行",
      openApp: "打开应用",
      desktopState: "桌面状态",
      deliverables: "目标交付物",
    };
  }, [displayLanguage]);

  const selectedRun =
    selectedStarter
      ? workflowRuns.find((item) => item.scenarioId === selectedStarter.scenarioId) ?? null
      : null;
  const commandSessionId = selectedStarter
    ? `webos-desktop-command-center-${selectedStarter.id}`
    : "";

  useEffect(() => {
    if (!selectedStarter?.id || !commandSessionId) return;

    let cancelled = false;

    const hydrateCommandSession = async () => {
      try {
        const response = await fetch(
          `/api/runtime/executor/sessions/${encodeURIComponent(commandSessionId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | null
          | {
              ok?: boolean;
              data?: { session?: { turns?: DeskExecutorSessionTurn[] } };
            };

        if (cancelled) return;

        if (!response.ok || !payload?.ok) {
          if (response.status === 404) {
            setCommandMessagesByStarterId((prev) => ({
              ...prev,
              [selectedStarter.id]: [],
            }));
          }
          return;
        }

        const turns = Array.isArray(payload.data?.session?.turns)
          ? payload.data.session.turns
          : [];
        setCommandMessagesByStarterId((prev) => ({
          ...prev,
          [selectedStarter.id]: buildDeskMessagesFromTurns(turns),
        }));
      } catch {
        if (cancelled) return;
      }
    };

    void hydrateCommandSession();

    return () => {
      cancelled = true;
    };
  }, [commandSessionId, selectedStarter?.id]);

  if (!selectedStarter || !selectedBundle) {
    return null;
  }

  const roleDeskTitle = roleDesk?.title || selectedScenario?.title || selectedStarter.title;
  const defaultExecutionEvents: DeskExecutionEvent[] = [
    {
      id: `${selectedStarter.id}-runtime`,
      title: copy.desktopState,
      detail: getCompactRunSummary(selectedRun, selectedScenario?.workflowStages.length ?? 0),
      tone:
        selectedRun?.state === "error"
          ? "error"
          : selectedRun?.state === "completed"
            ? "success"
            : "default",
    },
    {
      id: `${selectedStarter.id}-workflow`,
      title: copy.workflow,
      detail: selectedScenario?.workflowTitle || selectedBundle.summary,
      tone: "default",
    },
    {
      id: `${selectedStarter.id}-deliverables`,
      title: copy.deliverables,
      detail:
        (selectedScenario?.resultAssets ?? []).slice(0, 4).join(" · ") ||
        selectedStarter.assets.join(" · "),
      tone: "default",
    },
  ];
  const commandMessages = commandMessagesByStarterId[selectedStarter.id] ?? [];
  const executionEvents =
    executionEventsByStarterId[selectedStarter.id] ?? defaultExecutionEvents;
  const quickCommands =
    roleDesk?.id === "sales"
      ? [
          "搜索目标客户并按优先级排序",
          "根据客户画像起草首轮触达话术",
          "把今天的销售推进链拆成可执行任务",
        ]
      : roleDesk?.id === "creator"
        ? [
            "围绕今天的热点给我 3 个可发布选题",
            "把长内容改成短视频和社媒分发包",
            "整理这条内容链的发布前检查清单",
          ]
        : roleDesk?.id === "ops"
          ? [
              "把今天的阻塞项整理成推进链",
              "按优先级重排团队任务",
              "生成今天的项目同步摘要和风险点",
            ]
        : [
            "帮我拆今天最重要的 3 个动作",
            "检查当前桌面还有哪些自动化薄弱点",
            "把当前流程整理成一份可执行 SOP",
          ];
  const runningWorkflowCount = workflowRuns.filter(
    (run) => run.state === "running" || run.state === "awaiting_human",
  ).length;
  const failedWorkflowCount = workflowRuns.filter((run) => run.state === "error").length;
  const pendingApprovalCount =
    selectedRun?.stageRuns.filter(
      (stage) =>
        (stage.mode === "review" || stage.mode === "manual") && stage.state !== "completed",
    ).length ?? 0;
  const runtimeCockpitSummary = buildRuntimeCockpitSummary({
    runtimeReady,
    runtimeLabel,
    scenarioTitle: roleDeskTitle,
    workflowTitle: selectedScenario?.workflowTitle || selectedBundle.summary,
    selectedRunState: selectedRun?.state ?? null,
    pendingApprovalCount,
    runningCount: runningWorkflowCount,
    failedCount: failedWorkflowCount,
    language,
  });
  const commandCenterShortcuts = buildCommandCenterShortcuts({
    runtimeReady,
    runtimeLabel,
    scenarioTitle: roleDeskTitle,
    workflowAppId: selectedStarter.apps[0] ?? null,
    assetAppId: selectedStarter.apps.includes("knowledge_vault")
      ? "knowledge_vault"
      : (selectedStarter.apps.find((appId) => getAppCategory(appId) === "insight") ?? null),
    language,
  });
  const commandCenterAssets = buildCommandCenterAssets({
    scenarioAssets: selectedScenario?.resultAssets ?? [],
    starterAssets: selectedStarter.assets,
    limit: 4,
  });
  const attentionCards = buildCommandCenterAttentionCards({
    pendingApprovalCount,
    runningCount: runningWorkflowCount,
    failedCount: failedWorkflowCount,
    runtimeReady,
    language,
  });
  const chatPromptSuggestions = buildChatPromptSuggestions({
    quickCommands,
    starterTitle: selectedStarter.title,
    limit: 3,
  });

  const sendCommand = async (raw?: string) => {
    const text = (raw ?? commandDraft).trim();
    if (!text || commandLoading) return;

    const now = Date.now();
    const userMessage: DeskCommandMessage = {
      id: `${now}-user`,
      role: "user",
      text,
    };
    const runningTaskId = createTask({
      name: `${roleDeskTitle} Command`,
      status: "running",
      detail: text.slice(0, 100),
    });
    const contextMessage = [
      `当前部门：${selectedIndustryGroup?.industry.title || "未指定"}`,
      `当前桌面：${roleDeskTitle}`,
      `工作流主线：${selectedScenario?.workflowTitle || selectedBundle.summary}`,
      `当前状态：${getCompactRunSummary(selectedRun, selectedScenario?.workflowStages.length ?? 0)}`,
      `关键焦点：${(roleDesk?.focus ?? selectedScenario?.resultAssets ?? []).join("、")}`,
      "",
      `用户命令：${text}`,
    ].join("\n");

    setCommandMessagesByStarterId((prev) => ({
      ...prev,
      [selectedStarter.id]: [...(prev[selectedStarter.id] ?? []), userMessage].slice(
        -DESK_COMMAND_MAX_MESSAGES,
      ),
    }));
    const dispatchEvent: DeskExecutionEvent = {
      id: `${now}-dispatch`,
      title: copy.dispatching,
      detail: `${providerLabel(activeProvider)} · ${text.slice(0, 72)}`,
      tone: "default",
    };
    setExecutionEventsByStarterId((prev) => ({
      ...prev,
      [selectedStarter.id]: [
        dispatchEvent,
        ...(prev[selectedStarter.id] ?? defaultExecutionEvents),
      ].slice(0, 6),
    }));
    setCommandDraft("");
    setCommandLoading(true);

    try {
      const reply = await requestOpenClawAgent({
        message: contextMessage,
        sessionId: commandSessionId,
        timeoutSeconds: 45,
        taskLabel: "desk-command",
        memoryScope: `${selectedStarter.industryId}:${selectedStarter.scenarioId}:desk-command`,
      });
      const assistantMessage: DeskCommandMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: reply || "（没有返回内容）",
      };
      const successEvent: DeskExecutionEvent = {
        id: `${Date.now()}-done`,
        title: copy.completed,
        detail: (reply || "（没有返回内容）").slice(0, 120),
        tone: "success",
      };
      setCommandMessagesByStarterId((prev) => ({
        ...prev,
        [selectedStarter.id]: [...(prev[selectedStarter.id] ?? []), assistantMessage].slice(
          -DESK_COMMAND_MAX_MESSAGES,
        ),
      }));
      setExecutionEventsByStarterId((prev) => ({
        ...prev,
        [selectedStarter.id]: [
          successEvent,
          ...(prev[selectedStarter.id] ?? defaultExecutionEvents),
        ].slice(0, 6),
      }));
      updateTask(runningTaskId, { status: "done", detail: "命令执行完成" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      const errorMessage: DeskCommandMessage = {
        id: `${Date.now()}-error`,
        role: "assistant",
        text: message,
        error: true,
      };
      const failEvent: DeskExecutionEvent = {
        id: `${Date.now()}-fail`,
        title: copy.failed,
        detail: message.slice(0, 120),
        tone: "error",
      };
      setCommandMessagesByStarterId((prev) => ({
        ...prev,
        [selectedStarter.id]: [...(prev[selectedStarter.id] ?? []), errorMessage].slice(
          -DESK_COMMAND_MAX_MESSAGES,
        ),
      }));
      setExecutionEventsByStarterId((prev) => ({
        ...prev,
        [selectedStarter.id]: [
          failEvent,
          ...(prev[selectedStarter.id] ?? defaultExecutionEvents),
        ].slice(0, 6),
      }));
      updateTask(runningTaskId, { status: "error", detail: message });
    } finally {
      setCommandLoading(false);
    }
  };

  return (
    <section className="h-full text-slate-950">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/94 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-3">
        <div className="shrink-0 border-b border-slate-100 pb-2">
          <div className="flex gap-2 overflow-x-auto">
          {groupedIndustries.map((item) => {
            const active = item.industry.id === selectedWorkspaceIndustryId;
            const leadStarter = item.starters[0];
            const starterRun =
              workflowRuns.find((run) => run.scenarioId === leadStarter.scenarioId) ?? null;
            const runMeta = getRunStateMeta(starterRun);
            return (
              <button
                key={item.industry.id}
                type="button"
                onClick={() => setSelectedStarterId(leadStarter.id)}
                className={[
                  "shrink-0 rounded-full border px-3 py-2 text-left text-xs font-semibold transition-colors",
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                ].join(" ")}
              >
                <span>{item.industry.title}</span>
                <span className={active ? "ml-2 text-white/56" : "ml-2 text-slate-400"}>
                  {runMeta.label}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 pt-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 px-4 pt-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Runtime cockpit</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                  {runtimeCockpitSummary.title}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {runtimeCockpitSummary.subtitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 px-4 pt-4 lg:justify-end">
                <button
                  type="button"
                  onClick={() => onOpenApp("runtime_console")}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {runtimeCockpitSummary.primaryActionLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchStarter(selectedStarter)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {runtimeCockpitSummary.secondaryActionLabel}
                </button>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pt-4 lg:grid-cols-4">
              {runtimeCockpitSummary.metrics.map((metric) => (
                <div
                  key={metric.id}
                  className={[
                    "rounded-lg border px-3 py-2.5",
                    commandCenterToneClass(metric.tone),
                  ].join(" ")}
                >
                  <div className="text-[11px] font-semibold uppercase opacity-65">
                    {metric.label}
                  </div>
                  <div className="mt-1 text-base font-semibold">{metric.value}</div>
                  <div className="mt-1 line-clamp-1 text-[11px] opacity-60">
                    {metric.detail}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                {commandMessages.slice(-8).map((message) => (
                  <div
                    key={message.id}
                    className={[
                      "max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-7",
                      message.role === "user"
                        ? "ml-auto bg-slate-950 text-white"
                        : message.error
                          ? "border border-rose-200 bg-rose-50 text-rose-900"
                          : "border border-slate-200 bg-slate-50 text-slate-700",
                    ].join(" ")}
                  >
                    {message.text}
                  </div>
                ))}
                {commandLoading ? (
                  <div className="max-w-[86%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {copy.dispatching}
                  </div>
                ) : null}
                {commandMessages.length === 0 && !commandLoading ? (
                  <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                    <div className="text-base font-semibold text-slate-950">
                      像聊天一样安排工作
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">
                      输入目标、客户、约束和期望结果，AgentCore OS 会把它转成可执行的工作链。
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3">
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {chatPromptSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void sendCommand(item)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-950"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50">
                <textarea
                  value={commandDraft}
                  onChange={(event) => setCommandDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendCommand();
                    }
                  }}
                  rows={2}
                  placeholder={copy.commandPlaceholder}
                  className="max-h-[96px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-6 text-slate-950 outline-none placeholder:text-slate-400"
                />
                <div className="flex flex-col gap-2 border-t border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5">
                  <div className="hidden text-xs leading-5 text-slate-500 sm:block">{copy.enterHint}</div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {roleDesk ? (
                      <button
                        type="button"
                        onClick={() => onEnterRoleDesk(roleDesk, selectedStarter.industryId)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 sm:py-2"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {copy.role}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onLaunchStarter(selectedStarter)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 sm:py-2"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      {copy.launch}
                    </button>
                    <button
                      type="button"
                      disabled={commandLoading || !commandDraft.trim()}
                      onClick={() => void sendCommand()}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      {copy.commandAction}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <CommandCenterSidebar
            shortcuts={commandCenterShortcuts}
            attentionCards={attentionCards}
            assets={commandCenterAssets}
            executionEvents={executionEvents}
            workflowTitle={selectedScenario?.workflowTitle || selectedBundle.summary}
            workflowStages={selectedScenario?.workflowStages ?? []}
            selectedRun={selectedRun}
            runtimeCockpitSummary={runtimeCockpitSummary}
            copy={copy}
            onOpenApp={onOpenApp}
            onOpenIndustryHub={onOpenIndustryHub}
            onOpenSolutionsHub={onOpenSolutionsHub}
          />
          <section className="grid shrink-0 grid-cols-3 gap-2 lg:hidden">
            {commandCenterShortcuts.slice(0, 4).map((shortcut) => {
              const app = getApp(shortcut.appId);
              const Icon = app.icon;
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => onOpenApp(shortcut.appId)}
                  className={[
                    "min-w-0 rounded-lg border px-2 py-2 text-left transition-colors hover:border-slate-300 hover:bg-white",
                    commandCenterToneClass(shortcut.tone),
                  ].join(" ")}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-[11px] font-semibold">{shortcut.label}</span>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onOpenIndustryHub}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-[11px] font-semibold">{copy.industryHub}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={onOpenSolutionsHub}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-center justify-center gap-1.5">
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-[11px] font-semibold">{copy.library}</span>
              </div>
            </button>
          </section>
      </div>

      </div>
    </section>
  );
}
