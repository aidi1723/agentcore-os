export type Lang = "zh" | "en";

export const LANG_LABEL: Record<Lang, string> = {
  zh: "中文",
  en: "EN",
};

export function getLangFromSearchParams(sp?: URLSearchParams | null): Lang {
  const v = (sp?.get("lang") || "").toLowerCase();
  if (v === "zh" || v === "zh-cn" || v === "cn") return "zh";
  return "en";
}

type Dict = Record<string, string>;

const ZH: Dict = {
  appName: "OpenClaw OS",
  desktop: "桌面",
  apps: "应用",
  open: "打开",
  quick: "快捷",
  notes: "说明",
  safety: "安全",

  // Home cards
  quickTaskboardTitle: "任务看板",
  quickTaskboardDesc:
    "打开你本地的 Taskboard 独立界面。如果未运行，请在 workspace 启动。",
  quickTaskboardBtn: "打开 Taskboard",

  notesTitle: "本地优先",
  notesDesc:
    "这个界面先做桌面启动器 + 诊断外壳。下一步：把每个 App 接到本机 OpenClaw 网关。",

  safetyTitle: "不自动执行",
  safetyDesc:
    "界面不会悄悄修改系统。任何有风险的动作都会要求你确认。",

  // Apps
  gateway: "网关",
  nodes: "节点",
  taskboard: "任务看板",
  skills: "技能",
  logs: "日志",
  automations: "自动化",
  socialOps: "社媒运营",

  gatewayDesc: "服务状态与诊断",
  nodesDesc: "设备与已配对节点",
  taskboardDesc: "本地任务与计时",
  skillsDesc: "本地技能目录",
  logsDesc: "最近事件与错误",
  automationsDesc: "自动化流程中心",
  socialOpsDesc: "文案 + 视频制作 + 发布流水线（占位/不发布）",

  comingSoon: "即将上线",
  placeholder:
    "这是占位壳页面。下一步会接入本机 OpenClaw 服务（网关、节点、技能、日志）。",

  // Taskboard page
  today: "今日",
  fromJsonl: "来自本地 JSONL（taskboard/time_log.jsonl）",
  openTaskboardUi: "打开 Taskboard 界面",
  total: "总计",
  segments: "片段数",
  topTasks: "Top 任务",
  topProjects: "Top 项目",

  // Skills
  localSkills: "本地技能",
  skillsPathHint: "读取 ~/.openclaw/workspace/skills",
  skillMd: "SKILL.md",
  noSkillMd: "（无 SKILL.md）",
  skillMdNotFound: "未找到 SKILL.md",

  // Logs
  recentMemory: "最近 memory/*.md",
  logsHint: "本地文件只读视图，用作活动日志。",

  // Gateway/Nodes
  cmdGateway: "openclaw status --deep",
  cmdNodes: "openclaw nodes status",
};

const EN: Dict = {
  appName: "OpenClaw OS",
  desktop: "Desktop",
  apps: "Apps",
  open: "Open",
  quick: "Quick",
  notes: "Notes",
  safety: "Safety",

  quickTaskboardTitle: "Taskboard",
  quickTaskboardDesc:
    "Opens your local standalone Taskboard UI. If it isn’t running, start it from the workspace.",
  quickTaskboardBtn: "Open Taskboard",

  notesTitle: "Local-first",
  notesDesc:
    "This UI starts as a launcher + diagnostics shell. Next step: wire each app to local OpenClaw services.",

  safetyTitle: "No auto-actions",
  safetyDesc:
    "Buttons will never silently mutate your system. Every risky action will require confirmation.",

  gateway: "Gateway",
  nodes: "Nodes",
  taskboard: "Taskboard",
  skills: "Skills",
  logs: "Logs",
  automations: "Automations",
  socialOps: "Social Ops",

  gatewayDesc: "Service status and diagnostics",
  nodesDesc: "Devices and paired nodes",
  taskboardDesc: "Your local tasks and time",
  skillsDesc: "Local skills catalog",
  logsDesc: "Recent events and errors",
  automationsDesc: "Automation workflow hub",
  socialOpsDesc: "Copy + video production + publish pipeline (mock-only)",

  comingSoon: "Coming soon",
  placeholder:
    "This page is a placeholder shell. Next step is wiring it to local OpenClaw services (gateway, nodes, skills, logs).",

  today: "Today",
  fromJsonl: "From local JSONL (taskboard/time_log.jsonl)",
  openTaskboardUi: "Open Taskboard UI",
  total: "Total",
  segments: "Segments",
  topTasks: "Top Tasks",
  topProjects: "Top Projects",

  localSkills: "Local skills",
  skillsPathHint: "Reads from ~/.openclaw/workspace/skills",
  skillMd: "SKILL.md",
  noSkillMd: "(no SKILL.md)",
  skillMdNotFound: "SKILL.md not found",

  recentMemory: "Recent memory/*.md",
  logsHint: "Local file view (read-only). Useful as an activity log.",

  cmdGateway: "openclaw status --deep",
  cmdNodes: "openclaw nodes status",
};

export function dict(lang: Lang): Dict {
  return lang === "zh" ? ZH : EN;
}
