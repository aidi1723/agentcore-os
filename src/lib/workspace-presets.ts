import type { AppId } from "@/apps/types";

export type WorkspaceIndustryId =
  | "general"
  | "creator"
  | "sales"
  | "support"
  | "research"
  | "people"
  | "operations"
  | "personal";

export type WorkspaceScenario = {
  id: string;
  industryId: WorkspaceIndustryId;
  title: string;
  desc: string;
  desktopApps: AppId[];
  dockApps: AppId[];
};

export const workspaceIndustries: Array<{
  id: WorkspaceIndustryId;
  title: string;
  desc: string;
}> = [
  {
    id: "general",
    title: "通用团队",
    desc: "适合 founder、运营负责人或需要多场景切换的通用工作台。",
  },
  {
    id: "creator",
    title: "内容与创作者",
    desc: "适合内容团队、自媒体、品牌增长和创作者工作流。",
  },
  {
    id: "sales",
    title: "销售与商务",
    desc: "适合线索跟进、外联、提案和客户关系推进。",
  },
  {
    id: "support",
    title: "客服与用户运营",
    desc: "适合工单、私信、评论区和 FAQ 回答场景。",
  },
  {
    id: "research",
    title: "研究与策略",
    desc: "适合情报、研究、竞争观察和长期洞察沉淀。",
  },
  {
    id: "people",
    title: "招聘与人才",
    desc: "适合招聘筛选、面试记录、候选人评分和跟进。",
  },
  {
    id: "operations",
    title: "项目与运营",
    desc: "适合项目推进、周报、风险同步和执行跟踪。",
  },
  {
    id: "personal",
    title: "个人与家庭",
    desc: "适合习惯、健康、家庭节奏、语言学习和个人生活管理。",
  },
];

export const workspaceScenarios: WorkspaceScenario[] = [
  {
    id: "founder-command",
    industryId: "general",
    title: "Founder Command Center",
    desc: "信息摄取、晨报、会议、CRM、邮件和知识沉淀放在一张桌面上。",
    desktopApps: [
      "website_seo_studio",
      "tech_news_digest",
      "morning_brief",
      "meeting_copilot",
      "personal_crm",
      "email_assistant",
      "deal_desk",
      "second_brain",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "website_seo_studio",
      "morning_brief",
      "task_manager",
      "personal_crm",
      "email_assistant",
      "knowledge_vault",
      "settings",
    ],
  },
  {
    id: "creator-studio",
    industryId: "creator",
    title: "Creator Studio",
    desc: "从 Tech Digest、Creator Radar 到 Repurposer、发布中心的一条龙内容工作台。",
    desktopApps: [
      "tech_news_digest",
      "website_seo_studio",
      "social_media_autopilot",
      "creator_radar",
      "content_repurposer",
      "media_ops",
      "creative_studio",
      "publisher",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "website_seo_studio",
      "creator_radar",
      "social_media_autopilot",
      "content_repurposer",
      "media_ops",
      "creative_studio",
      "publisher",
      "settings",
    ],
  },
  {
    id: "sales-pipeline",
    industryId: "sales",
    title: "Sales Pipeline Desk",
    desc: "聚焦线索判断、CRM、邮件跟进和会后闭环。",
    desktopApps: [
      "morning_brief",
      "meeting_copilot",
      "deal_desk",
      "personal_crm",
      "email_assistant",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "deal_desk",
      "personal_crm",
      "email_assistant",
      "task_manager",
      "settings",
    ],
  },
  {
    id: "support-ops",
    industryId: "support",
    title: "Support Ops Desk",
    desc: "统一收件箱、客服回复、知识库和任务跟进。",
    desktopApps: [
      "morning_brief",
      "inbox_declutter",
      "support_copilot",
      "personal_crm",
      "knowledge_vault",
      "task_manager",
      "email_assistant",
      "settings",
    ],
    dockApps: [
      "inbox_declutter",
      "support_copilot",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
  },
  {
    id: "research-radar",
    industryId: "research",
    title: "Research Radar",
    desc: "围绕 digest、brief、知识沉淀和观点输出的一体化工作台。",
    desktopApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "creator_radar",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "second_brain",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
  },
  {
    id: "recruiting-pipeline",
    industryId: "people",
    title: "Recruiting Pipeline",
    desc: "适合岗位筛选、候选人评分、面试跟进和后续动作收口。",
    desktopApps: [
      "industry_hub",
      "recruiting_desk",
      "meeting_copilot",
      "email_assistant",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "recruiting_desk",
      "email_assistant",
      "task_manager",
      "settings",
    ],
  },
  {
    id: "project-delivery",
    industryId: "operations",
    title: "Project Delivery Board",
    desc: "适合项目周报、风险同步、任务推进和跨团队执行收口。",
    desktopApps: [
      "industry_hub",
      "project_ops",
      "morning_brief",
      "meeting_copilot",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "project_ops",
      "task_manager",
      "morning_brief",
      "settings",
    ],
  },
  {
    id: "personal-rhythm",
    industryId: "personal",
    title: "Personal Rhythm",
    desc: "适合个人和家庭：晨报、日历、习惯、健康和长期记录。",
    desktopApps: [
      "morning_brief",
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "language_learning_desk",
      "second_brain",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "language_learning_desk",
      "task_manager",
      "settings",
    ],
  },
  {
    id: "language-immersion",
    industryId: "personal",
    title: "Language Immersion Desk",
    desc: "适合翻译、口语练习、短句库沉淀和周期性复习。",
    desktopApps: [
      "language_learning_desk",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "language_learning_desk",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
  },
];

export function getWorkspaceScenario(scenarioId: string) {
  return workspaceScenarios.find((scenario) => scenario.id === scenarioId) ?? null;
}

export function listWorkspaceScenarios(industryId: WorkspaceIndustryId) {
  return workspaceScenarios.filter((scenario) => scenario.industryId === industryId);
}
