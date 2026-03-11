import type { AppId } from "@/apps/types";
import type { PlaybookAction } from "@/lib/playbooks";
import type { WorkspaceIndustryId } from "@/lib/workspace-presets";

export type IndustryId =
  | "creator_media"
  | "sales_growth"
  | "support_success"
  | "research_strategy"
  | "people_hiring"
  | "operations_delivery"
  | "personal_life";

export type IndustryBundle = {
  id: string;
  industryId: IndustryId;
  title: string;
  summary: string;
  sourceUseCases: string[];
  featuredApps: AppId[];
  desktopApps: AppId[];
  dockApps: AppId[];
  highlights: string[];
  dashboardCards: Array<{
    label: string;
    value: string;
    note: string;
  }>;
  shortcutButtons: Array<{
    title: string;
    caption: string;
    accent: "slate" | "blue" | "emerald" | "amber" | "rose";
    actions: PlaybookAction[];
  }>;
  todayChecklist: string[];
  launchSequence: AppId[];
  appSpotlights: Array<{
    appId: AppId;
    role: string;
    outcome: string;
  }>;
  quickActions: Array<{
    title: string;
    desc: string;
    actions: PlaybookAction[];
  }>;
};

export const industries: Array<{
  id: IndustryId;
  title: string;
  desc: string;
}> = [
  {
    id: "creator_media",
    title: "内容与创作者",
    desc: "围绕选题、内容生产、再利用和分发形成闭环。",
  },
  {
    id: "sales_growth",
    title: "销售与增长",
    desc: "围绕线索判断、关系推进、邮件跟进和增长动作展开。",
  },
  {
    id: "support_success",
    title: "客服与用户成功",
    desc: "围绕多渠道收口、标准回复、CRM 跟进和知识沉淀展开。",
  },
  {
    id: "research_strategy",
    title: "研究与策略",
    desc: "围绕多源情报、市场研究、洞察沉淀和日常策略节奏。",
  },
  {
    id: "people_hiring",
    title: "招聘与人才",
    desc: "围绕候选人筛选、面试记录、评分卡和后续跟进展开。",
  },
  {
    id: "operations_delivery",
    title: "项目与运营",
    desc: "围绕项目周报、阻塞同步、推进节奏和执行收口展开。",
  },
  {
    id: "personal_life",
    title: "个人与家庭",
    desc: "围绕晨报、家庭节奏、习惯、健康和长期记录。",
  },
];

export const industryBundles: IndustryBundle[] = [
  {
    id: "creator-command",
    industryId: "creator_media",
    title: "Creator Command Center",
    summary:
      "把 Daily YouTube Digest、YouTube Content Pipeline、Podcast Production Pipeline 这类成熟场景压成一个内容工作台。",
    sourceUseCases: [
      "Daily YouTube Digest",
      "YouTube Content Pipeline",
      "Podcast Production Pipeline",
      "Multi-Source Tech News Digest",
    ],
    featuredApps: [
      "website_seo_studio",
      "tech_news_digest",
      "social_media_autopilot",
      "creator_radar",
      "content_repurposer",
      "media_ops",
      "publisher",
    ],
    desktopApps: [
      "industry_hub",
      "website_seo_studio",
      "tech_news_digest",
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
      "industry_hub",
      "website_seo_studio",
      "social_media_autopilot",
      "creator_radar",
      "content_repurposer",
      "media_ops",
      "publisher",
      "settings",
    ],
    highlights: [
      "先做多源内容雷达，再整理成今日最值得做的选题。",
      "把长视频、播客、直播纪要拆成多平台内容包。",
      "直接把内容包送进发布中心继续排程和预演。",
    ],
    dashboardCards: [
      { label: "今日选题", value: "3 条", note: "先挑 1 条最值得做的内容推进" },
      { label: "可复用内容", value: "长内容 -> 4 端", note: "优先做一稿多拆，降低生产成本" },
      { label: "推荐启动", value: "Radar -> Repurpose -> Publish", note: "先信息，后生产，再分发" },
    ],
    shortcutButtons: [
      {
        title: "今日选题",
        caption: "快速进入内容雷达和选题整理。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
        ],
      },
      {
        title: "SEO 页面",
        caption: "把主题快速整理成网站结构和 SEO 页面方案。",
        accent: "slate",
        actions: [
          { type: "open_app", appId: "website_seo_studio", label: "打开 Website SEO Studio" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "一稿多拆",
        caption: "把长内容直接拆成多平台内容包。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "social_media_autopilot", label: "打开 Social Media Auto-pilot" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
        ],
      },
      {
        title: "去发布",
        caption: "把已经整理好的内容继续推进到发布出口。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          { type: "open_app", appId: "media_ops", label: "打开 Media Ops" },
        ],
      },
    ],
    todayChecklist: [
      "先看一轮 Tech / Market Digest，把今天最值得做的信号压出来。",
      "把最强的一条信号送进 Creator Radar，整理成 1 个主选题。",
      "需要做官网、专题页或 SEO 页面时，直接进 Website SEO Studio 出结构和关键词方案。",
      "需要多平台快发时，直接在 Social Media Auto-pilot 里整理渠道版本和回复建议。",
      "如果已有长内容素材，直接进 Content Repurposer 生成多平台内容包。",
    ],
    launchSequence: [
      "tech_news_digest",
      "creator_radar",
      "website_seo_studio",
      "social_media_autopilot",
      "content_repurposer",
      "publisher",
    ],
    appSpotlights: [
      {
        appId: "tech_news_digest",
        role: "多源内容雷达",
        outcome: "先把值得关注的行业/创作者动态压成一份 digest。",
      },
      {
        appId: "creator_radar",
        role: "选题引擎",
        outcome: "把 digest 里的信号转成今天最值得做的内容角度。",
      },
      {
        appId: "website_seo_studio",
        role: "网站与 SEO 页面台",
        outcome: "把内容主题整理成可执行的页面结构、Meta 和 FAQ 方案。",
      },
      {
        appId: "social_media_autopilot",
        role: "社媒改写与排期台",
        outcome: "把主稿快速整理成多平台版本、排期备注和回复建议。",
      },
      {
        appId: "content_repurposer",
        role: "长内容拆分器",
        outcome: "把长视频、播客或文章改造成 shorts、帖子和 newsletter。",
      },
      {
        appId: "publisher",
        role: "分发出口",
        outcome: "把已经生成的内容包继续预演、排程和发布。",
      },
    ],
    quickActions: [
      {
        title: "晨间选题启动",
        desc: "先看信息，再定今天最值得做的一条内容。",
        actions: [
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
        ],
      },
      {
        title: "网站内容页",
        desc: "把选题进一步整理成可承接搜索和转化的页面方案。",
        actions: [
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
          { type: "open_app", appId: "website_seo_studio", label: "打开 Website SEO Studio" },
        ],
      },
      {
        title: "一稿多拆",
        desc: "把长内容快速拆成多平台内容包并送去发布。",
        actions: [
          { type: "open_app", appId: "social_media_autopilot", label: "打开 Social Media Auto-pilot" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
        ],
      },
    ],
  },
  {
    id: "sales-pipeline",
    industryId: "sales_growth",
    title: "Sales Pipeline OS",
    summary:
      "把 Personal CRM、Automated Meeting Notes & Action Items、Inbox De-clutter 这类成熟场景组合成销售推进桌面。",
    sourceUseCases: [
      "Personal CRM",
      "Automated Meeting Notes & Action Items",
      "Inbox De-clutter",
      "Custom Morning Brief",
    ],
    featuredApps: [
      "morning_brief",
      "meeting_copilot",
      "deal_desk",
      "personal_crm",
      "email_assistant",
    ],
    desktopApps: [
      "industry_hub",
      "morning_brief",
      "meeting_copilot",
      "deal_desk",
      "personal_crm",
      "email_assistant",
      "inbox_declutter",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "deal_desk",
      "personal_crm",
      "email_assistant",
      "task_manager",
      "settings",
    ],
    highlights: [
      "会后纪要直接转成线索判断和 CRM 下一步。",
      "外联邮件和跟进动作不再散落在多个窗口。",
      "晨报和任务中心帮助你收口今天最重要的推进动作。",
    ],
    dashboardCards: [
      { label: "今日推进", value: "2 条主线", note: "先处理最接近转化的线索" },
      { label: "核心闭环", value: "Meeting -> Deal -> CRM", note: "减少会后动作流失" },
      { label: "推荐启动", value: "Brief -> Deal -> Email", note: "先定节奏，再判断，再触达" },
    ],
    shortcutButtons: [
      {
        title: "会后推进",
        caption: "会议纪要直接送去线索判断和 CRM。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        title: "跟进邮件",
        caption: "快速生成跟进、催进度和收尾邮件。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
        ],
      },
      {
        title: "CRM 收口",
        caption: "把今天需要推进的关系和节奏收口到 CRM。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
    todayChecklist: [
      "晨报里先明确今天最重要的 1-2 个推进动作。",
      "把昨天或最近的会议纪要推进到 Deal Desk 做资格判断。",
      "对值得推进的线索，立刻生成跟进邮件并同步到 CRM。",
    ],
    launchSequence: [
      "morning_brief",
      "meeting_copilot",
      "deal_desk",
      "personal_crm",
      "email_assistant",
    ],
    appSpotlights: [
      {
        appId: "meeting_copilot",
        role: "会后闭环入口",
        outcome: "会议纪要和行动项不会散失，适合直接进入销售推进。",
      },
      {
        appId: "deal_desk",
        role: "线索判断台",
        outcome: "快速判断线索质量、缺失信息和下一步动作。",
      },
      {
        appId: "personal_crm",
        role: "关系推进板",
        outcome: "把关键联系人和下一次触达节奏收口到一个地方。",
      },
      {
        appId: "email_assistant",
        role: "邮件推进器",
        outcome: "首封、跟进、催进度和收尾邮件都能快速生成。",
      },
    ],
    quickActions: [
      {
        title: "会后推进",
        desc: "会议纪要 -> 线索判断 -> CRM 跟进。",
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        title: "外联收口",
        desc: "先判断线索，再写跟进邮件。",
        actions: [
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
        ],
      },
    ],
  },
  {
    id: "support-ops",
    industryId: "support_success",
    title: "Support Ops Desk",
    summary:
      "把 Multi-Channel AI Customer Service、Inbox De-clutter、Personal CRM 这类成熟场景组合成客服与用户成功桌面。",
    sourceUseCases: [
      "Multi-Channel AI Customer Service",
      "Inbox De-clutter",
      "Personal CRM",
      "Second Brain",
    ],
    featuredApps: [
      "support_copilot",
      "inbox_declutter",
      "personal_crm",
      "knowledge_vault",
      "task_manager",
    ],
    desktopApps: [
      "industry_hub",
      "morning_brief",
      "support_copilot",
      "inbox_declutter",
      "personal_crm",
      "knowledge_vault",
      "task_manager",
      "email_assistant",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "support_copilot",
      "inbox_declutter",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    highlights: [
      "多渠道问题统一收口，再拆成回复、跟进或任务。",
      "把高频问题沉淀进知识库，减少重复回答。",
      "需要长期跟进的对话直接送进 CRM 和任务中心。",
    ],
    dashboardCards: [
      { label: "优先收口", value: "Inbox + Support", note: "先聚合，再判断回复还是升级" },
      { label: "知识沉淀", value: "FAQ / 回复模板", note: "把重复问题沉淀成可复用资产" },
      { label: "推荐启动", value: "Inbox -> Support -> CRM", note: "避免消息、回复、跟进断层" },
    ],
    shortcutButtons: [
      {
        title: "收口消息",
        caption: "先聚合多渠道消息，再判断优先级。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
        ],
      },
      {
        title: "生成回复",
        caption: "对高频问题先生成标准答复草稿。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
        ],
      },
      {
        title: "FAQ 沉淀",
        caption: "把重复问题和标准口径沉淀进知识库。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
    todayChecklist: [
      "先看 Inbox Digest，把今天需要先处理的用户问题挑出来。",
      "对高频问题先在 Support Copilot 生成标准回复草稿。",
      "对需要长期跟进的用户，立刻送到 CRM 或任务中心。",
    ],
    launchSequence: [
      "inbox_declutter",
      "support_copilot",
      "personal_crm",
      "knowledge_vault",
    ],
    appSpotlights: [
      {
        appId: "inbox_declutter",
        role: "收口入口",
        outcome: "把邮件和消息先压成 digest，减少碎片化打断。",
      },
      {
        appId: "support_copilot",
        role: "回复生成器",
        outcome: "高频问题先出标准回复，再决定是否升级处理。",
      },
      {
        appId: "personal_crm",
        role: "长期跟进台",
        outcome: "把重要用户、客户或有风险的对话拉进 CRM。",
      },
      {
        appId: "knowledge_vault",
        role: "FAQ 资产库",
        outcome: "把重复问题和标准口径沉淀成长期可复用资料。",
      },
    ],
    quickActions: [
      {
        title: "统一收口",
        desc: "先看 digest，再产出回复草稿并同步后续任务。",
        actions: [
          { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "FAQ 资产化",
        desc: "把高频问题沉淀成知识库条目和模板。",
        actions: [
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
        ],
      },
    ],
  },
  {
    id: "research-radar",
    industryId: "research_strategy",
    title: "Research & Strategy Radar",
    summary:
      "把 Multi-Source Tech News Digest、AI Earnings Tracker、Market Research & Product Factory 一类场景组合成情报工作台。",
    sourceUseCases: [
      "Multi-Source Tech News Digest",
      "AI Earnings Tracker",
      "Market Research & Product Factory",
      "Second Brain",
    ],
    featuredApps: [
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "task_manager",
    ],
    desktopApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "creator_radar",
      "task_manager",
      "solutions_hub",
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
    highlights: [
      "多源信息先生成 digest，再决定哪些进入内容、哪些进入今天行动。",
      "把研究洞察沉淀成长期可复用的资料和模板。",
      "适合 founder、策略、研究和增长负责人日常使用。",
    ],
    dashboardCards: [
      { label: "今日情报", value: "3-5 个信号", note: "只保留真正影响判断和执行的变化" },
      { label: "长期资产", value: "研究框架 / 资料库", note: "把一次研究变成长期复用体系" },
      { label: "推荐启动", value: "Digest -> Brief -> Brain", note: "先看变化，再收口，再沉淀" },
    ],
    shortcutButtons: [
      {
        title: "生成 Digest",
        caption: "先把多源情报压成今日摘要。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "deep_research_hub", label: "打开 Deep Research Hub" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "写今日 Brief",
        caption: "把真正影响今天动作的变化收口出来。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "沉淀洞察",
        caption: "把研究结论和长期判断写进资产库。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
    ],
    todayChecklist: [
      "先在 Deep Research Hub 明确研究主题、来源和判断角度。",
      "再做一份 Tech News Digest，把关键变化整理成摘要。",
      "把真正影响今天动作的部分写入 Morning Brief。",
      "把长期有效的判断和观察写进 Second Brain / Knowledge Vault。",
    ],
    launchSequence: [
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
    ],
    appSpotlights: [
      {
        appId: "deep_research_hub",
        role: "研究总入口",
        outcome: "围绕主题、来源和角度生成结构化研究简报。",
      },
      {
        appId: "tech_news_digest",
        role: "情报入口",
        outcome: "把 RSS、GitHub、newsletter、市场变化整理成 digest。",
      },
      {
        appId: "morning_brief",
        role: "策略收口",
        outcome: "把 digest 里真正影响今天执行的变化转成行动优先级。",
      },
      {
        appId: "second_brain",
        role: "洞察沉淀",
        outcome: "把研究过程中的模式和判断长期记录下来。",
      },
      {
        appId: "knowledge_vault",
        role: "资料库",
        outcome: "把关键资料、框架和观察维度长期积累下来。",
      },
    ],
    quickActions: [
      {
        title: "今日研究节奏",
        desc: "先做 digest，再写晨报，最后沉淀长期洞察。",
        actions: [
          { type: "open_app", appId: "deep_research_hub", label: "打开 Deep Research Hub" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
      {
        title: "研究 -> 内容",
        desc: "把研究信号送去内容选题，变成面向外部的表达。",
        actions: [
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
        ],
      },
    ],
  },
  {
    id: "personal-rhythm",
    industryId: "personal_life",
    title: "Personal Rhythm OS",
    summary:
      "把 Custom Morning Brief、Family Calendar & Household Assistant、Habit Tracker & Accountability Coach、Health & Symptom Tracker 组合成个人生活桌面。",
    sourceUseCases: [
      "Custom Morning Brief",
      "Family Calendar & Household Assistant",
      "Habit Tracker & Accountability Coach",
      "Health & Symptom Tracker",
      "Second Brain",
    ],
    featuredApps: [
      "morning_brief",
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "second_brain",
    ],
    desktopApps: [
      "industry_hub",
      "morning_brief",
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "second_brain",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "task_manager",
      "settings",
    ],
    highlights: [
      "家庭日程、补货、晨间计划都能在一个桌面里收口。",
      "习惯和健康记录保留长期轨迹，并支持摘要整理。",
      "把生活中的观察和卡点继续沉淀到第二大脑。",
    ],
    dashboardCards: [
      { label: "日常节奏", value: "Morning -> Family -> Habit", note: "把生活安排先收口，再看长期习惯" },
      { label: "长期记录", value: "Habit + Health", note: "保留可复盘的个人轨迹" },
      { label: "推荐启动", value: "Brief -> Calendar -> Tracker", note: "先看今天，再看习惯和健康变化" },
    ],
    shortcutButtons: [
      {
        title: "今日晨报",
        caption: "先把今天家庭和个人安排压成一页。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "家庭安排",
        caption: "查看接送、补货和本日提醒事项。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "晚间复盘",
        caption: "回顾习惯和健康变化，写下今天观察。",
        accent: "rose",
        actions: [
          { type: "open_app", appId: "habit_tracker", label: "打开 Habit Tracker" },
          { type: "open_app", appId: "health_tracker", label: "打开 Health Tracker" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
    ],
    todayChecklist: [
      "先生成晨报，把今天最重要的家庭/个人安排压出来。",
      "查看 Family Calendar，确认接送、补货和提醒事项。",
      "晚上回顾 Habit / Health，并把观察沉淀到 Second Brain。",
    ],
    launchSequence: [
      "morning_brief",
      "family_calendar",
      "habit_tracker",
      "health_tracker",
      "second_brain",
    ],
    appSpotlights: [
      {
        appId: "morning_brief",
        role: "日启动收口",
        outcome: "把今天最重要的家庭/个人安排先压成晨报。",
      },
      {
        appId: "family_calendar",
        role: "家庭节奏台",
        outcome: "统一日程、补货和提醒事项，减少来回协调。",
      },
      {
        appId: "habit_tracker",
        role: "习惯轨迹",
        outcome: "把长期想坚持的习惯放进一个稳定打卡面板。",
      },
      {
        appId: "health_tracker",
        role: "健康记录",
        outcome: "把睡眠、精力、症状和药物整理成趋势。",
      },
    ],
    quickActions: [
      {
        title: "早晨启动",
        desc: "先看晨报，再看家庭日历，最后整理今天的任务节奏。",
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "晚间复盘",
        desc: "回顾习惯、健康变化，并把观察写进长期记录。",
        actions: [
          { type: "open_app", appId: "habit_tracker", label: "打开 Habit Tracker" },
          { type: "open_app", appId: "health_tracker", label: "打开 Health Tracker" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
    ],
  },
  {
    id: "creator-newsroom",
    industryId: "creator_media",
    title: "Creator Newsroom",
    summary:
      "把 Multi-Source Tech News Digest、Podcast Production Pipeline、Content Repurposing 一类场景压成适合日更和多平台分发的内容编辑部。",
    sourceUseCases: [
      "Multi-Source Tech News Digest",
      "Podcast Production Pipeline",
      "Content Repurposing",
      "Daily Creator Workflow",
    ],
    featuredApps: [
      "morning_brief",
      "tech_news_digest",
      "website_seo_studio",
      "social_media_autopilot",
      "content_repurposer",
      "media_ops",
      "publisher",
    ],
    desktopApps: [
      "industry_hub",
      "morning_brief",
      "tech_news_digest",
      "website_seo_studio",
      "social_media_autopilot",
      "content_repurposer",
      "media_ops",
      "publisher",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "tech_news_digest",
      "website_seo_studio",
      "social_media_autopilot",
      "content_repurposer",
      "publisher",
      "task_manager",
      "settings",
    ],
    highlights: [
      "更适合日更、快反和信息型内容团队。",
      "先做 morning brief，再决定今天优先追哪类热点和分发渠道。",
      "内容拆分、文案整理、发布排程形成轻量新闻编辑部节奏。",
    ],
    dashboardCards: [
      { label: "今日栏目", value: "快报 / 长帖 / 分发", note: "先定内容形态，再分配执行顺序" },
      { label: "节奏重点", value: "Brief -> Digest -> Publish", note: "适合高频更新场景" },
      { label: "推荐启动", value: "Morning -> Digest -> Repurpose", note: "先定重点，再做内容包" },
    ],
    shortcutButtons: [
      {
        title: "晨间编前会",
        caption: "先收口晨报，再决定今天的快报方向。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
        ],
      },
      {
        title: "SEO 专题页",
        caption: "把热点内容改成专题页和可搜索页面结构。",
        accent: "slate",
        actions: [
          { type: "open_app", appId: "website_seo_studio", label: "打开 Website SEO Studio" },
          { type: "open_app", appId: "media_ops", label: "打开 Media Ops" },
        ],
      },
      {
        title: "快速出稿",
        caption: "先整理内容，再拆成多平台版本。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "media_ops", label: "打开 Media Ops" },
          { type: "open_app", appId: "social_media_autopilot", label: "打开 Social Media Auto-pilot" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
        ],
      },
      {
        title: "分发排程",
        caption: "将今日内容送进发布中心和任务节奏。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
    todayChecklist: [
      "先用 Morning Brief 压出今天要追的 2-3 个重点主题。",
      "在 Tech News Digest 里快速聚合信号并确认优先内容角度。",
      "如果要承接搜索流量，先在 Website SEO Studio 做专题页结构和关键词整理。",
      "把已经确认的主稿送去 Social Media Auto-pilot、Content Repurposer 和 Publisher。",
    ],
    launchSequence: [
      "morning_brief",
      "tech_news_digest",
      "website_seo_studio",
      "social_media_autopilot",
      "media_ops",
      "content_repurposer",
      "publisher",
    ],
    appSpotlights: [
      {
        appId: "morning_brief",
        role: "编前收口",
        outcome: "先把今天重点主题和资源分配压出来。",
      },
      {
        appId: "tech_news_digest",
        role: "热点采编雷达",
        outcome: "快速聚合值得追踪的行业和平台信号。",
      },
      {
        appId: "website_seo_studio",
        role: "SEO 页面策划台",
        outcome: "把热点主题整理成可承接自然流量的页面结构与 Meta 方案。",
      },
      {
        appId: "social_media_autopilot",
        role: "多平台编发台",
        outcome: "把主稿快速改成多平台文案，并补好评论回复建议。",
      },
      {
        appId: "media_ops",
        role: "成稿整理台",
        outcome: "把主稿、标题和摘要口径快速整理好。",
      },
      {
        appId: "publisher",
        role: "排程出口",
        outcome: "把多平台版本直接送去排程和发布。",
      },
    ],
    quickActions: [
      {
        title: "今日快报",
        desc: "晨报定重点，再采编，再出成稿。",
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "media_ops", label: "打开 Media Ops" },
          { type: "open_app", appId: "social_media_autopilot", label: "打开 Social Media Auto-pilot" },
        ],
      },
      {
        title: "SEO 承接页",
        desc: "把热点或主稿进一步整理成官网/专题页结构。",
        actions: [
          { type: "open_app", appId: "website_seo_studio", label: "打开 Website SEO Studio" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "内容分发线",
        desc: "把主稿拆成多平台内容并进入发布。",
        actions: [
          { type: "open_app", appId: "social_media_autopilot", label: "打开 Social Media Auto-pilot" },
          { type: "open_app", appId: "content_repurposer", label: "打开 Content Repurposer" },
          { type: "open_app", appId: "publisher", label: "打开 发布中心" },
        ],
      },
    ],
  },
  {
    id: "sales-outbound-sprint",
    industryId: "sales_growth",
    title: "Outbound Sprint Desk",
    summary:
      "围绕 prospecting、邮件触达、跟进节奏和 CRM 收口，适合 SDR、BD 和短周期外联场景。",
    sourceUseCases: [
      "Personal CRM",
      "Inbox De-clutter",
      "Cold Outreach Assistant",
      "Custom Morning Brief",
    ],
    featuredApps: [
      "morning_brief",
      "deal_desk",
      "email_assistant",
      "personal_crm",
      "task_manager",
    ],
    desktopApps: [
      "industry_hub",
      "morning_brief",
      "deal_desk",
      "email_assistant",
      "personal_crm",
      "inbox_declutter",
      "task_manager",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "deal_desk",
      "email_assistant",
      "personal_crm",
      "task_manager",
      "settings",
    ],
    highlights: [
      "更偏外联和多线程推进，而不是会后闭环。",
      "先筛目标，再写触达，再把节奏收口到 CRM 和任务中心。",
      "适合每天固定拉一批名单并持续跟进的团队。",
    ],
    dashboardCards: [
      { label: "今日外联", value: "5-10 条", note: "先确定最值得触达的一批对象" },
      { label: "推进闭环", value: "Deal -> Email -> CRM", note: "减少外联动作断点" },
      { label: "推荐启动", value: "Brief -> Deal -> Outreach", note: "先定优先级，再开始触达" },
    ],
    shortcutButtons: [
      {
        title: "拉名单",
        caption: "先判断哪些对象值得推进。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
        ],
      },
      {
        title: "写首封",
        caption: "快速产出首轮外联邮件。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
        ],
      },
      {
        title: "推进节奏",
        caption: "把外联和回复节奏收口到 CRM。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
    todayChecklist: [
      "先在 Morning Brief 明确今日优先拓展的名单范围。",
      "在 Deal Desk 做一轮快速资格判断并补齐缺口信息。",
      "把值得推进的对象送到 Email Assistant 和 Personal CRM。",
    ],
    launchSequence: [
      "morning_brief",
      "deal_desk",
      "email_assistant",
      "personal_crm",
      "task_manager",
    ],
    appSpotlights: [
      {
        appId: "deal_desk",
        role: "名单判断台",
        outcome: "先看谁值得触达，避免无效发信。",
      },
      {
        appId: "email_assistant",
        role: "外联写作器",
        outcome: "首封、二次跟进和催回复都能快速生成。",
      },
      {
        appId: "personal_crm",
        role: "推进节奏板",
        outcome: "把每个联系人当前所处阶段和下一次动作收口起来。",
      },
      {
        appId: "task_manager",
        role: "执行收口",
        outcome: "确保今日外联节奏和待办不丢失。",
      },
    ],
    quickActions: [
      {
        title: "今日外联批次",
        desc: "名单判断、首封邮件、CRM 收口一次完成。",
        actions: [
          { type: "open_app", appId: "deal_desk", label: "打开 Deal Desk" },
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        title: "跟进清理",
        desc: "把未回复、待回访和今日待办重新收口。",
        actions: [
          { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
  },
  {
    id: "support-retention-desk",
    industryId: "support_success",
    title: "Retention & FAQ Studio",
    summary:
      "围绕多渠道答复、客户留存提醒、FAQ 沉淀和升级流程，适合客服与客户成功混合场景。",
    sourceUseCases: [
      "Multi-Channel AI Customer Service",
      "Personal CRM",
      "Inbox De-clutter",
      "Second Brain",
    ],
    featuredApps: [
      "inbox_declutter",
      "support_copilot",
      "email_assistant",
      "personal_crm",
      "knowledge_vault",
    ],
    desktopApps: [
      "industry_hub",
      "inbox_declutter",
      "support_copilot",
      "email_assistant",
      "personal_crm",
      "knowledge_vault",
      "task_manager",
      "second_brain",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "support_copilot",
      "email_assistant",
      "personal_crm",
      "knowledge_vault",
      "settings",
    ],
    highlights: [
      "更适合带有留存、续费提醒和高价值客户跟进的客服桌面。",
      "回复、提醒、知识沉淀和升级处理放在一套节奏内。",
      "适合 CS、售后和 support lead 混合使用。",
    ],
    dashboardCards: [
      { label: "今日风险", value: "高价值会话优先", note: "先处理可能流失或升级的问题" },
      { label: "标准口径", value: "FAQ + Email", note: "回复和留存口径要统一" },
      { label: "推荐启动", value: "Inbox -> Support -> Vault", note: "先聚合，再答复，再沉淀" },
    ],
    shortcutButtons: [
      {
        title: "风险会话",
        caption: "先收口需要优先处理的客户问题。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        title: "统一口径",
        caption: "同步客服回复和邮件跟进口径。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
        ],
      },
      {
        title: "沉淀 FAQ",
        caption: "把高频问题和留存话术沉淀下来。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
    ],
    todayChecklist: [
      "先在 Inbox Declutter 里找出需要优先处理的高价值会话。",
      "对需要补充说明或安抚的客户，在 Support Copilot 和 Email Assistant 统一口径。",
      "把今天重复出现的问题沉淀进 Knowledge Vault。",
    ],
    launchSequence: [
      "inbox_declutter",
      "support_copilot",
      "email_assistant",
      "personal_crm",
      "knowledge_vault",
    ],
    appSpotlights: [
      {
        appId: "support_copilot",
        role: "多渠道答复台",
        outcome: "统一处理评论、邮件和客服消息的标准答复。",
      },
      {
        appId: "email_assistant",
        role: "补充解释与挽回",
        outcome: "适合售后说明、留存邮件和续费提醒。",
      },
      {
        appId: "personal_crm",
        role: "客户风险跟进",
        outcome: "把需要长期追踪的客户和状态放进节奏板。",
      },
      {
        appId: "knowledge_vault",
        role: "支持资产库",
        outcome: "FAQ、模板和历史口径都能长期复用。",
      },
    ],
    quickActions: [
      {
        title: "高价值客户收口",
        desc: "风险会话、回复草稿、跟进节奏一次处理。",
        actions: [
          { type: "open_app", appId: "inbox_declutter", label: "打开 Inbox" },
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
          { type: "open_app", appId: "personal_crm", label: "打开 Personal CRM" },
        ],
      },
      {
        title: "答复资产化",
        desc: "把标准答复和升级话术沉淀成知识资产。",
        actions: [
          { type: "open_app", appId: "support_copilot", label: "打开 Support Copilot" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
    ],
  },
  {
    id: "research-market-map",
    industryId: "research_strategy",
    title: "Market Mapping Lab",
    summary:
      "围绕市场跟踪、竞争映射、洞察沉淀和对外表达，适合策略、产品研究和 founder 情报节奏。",
    sourceUseCases: [
      "Market Research & Product Factory",
      "AI Earnings Tracker",
      "Multi-Source Tech News Digest",
      "Second Brain",
    ],
    featuredApps: [
      "deep_research_hub",
      "tech_news_digest",
      "second_brain",
      "knowledge_vault",
      "creator_radar",
      "morning_brief",
    ],
    desktopApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "creator_radar",
      "task_manager",
      "solutions_hub",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "deep_research_hub",
      "tech_news_digest",
      "second_brain",
      "creator_radar",
      "knowledge_vault",
      "settings",
    ],
    highlights: [
      "更强调市场映射和长期研究资产，而不是单纯日常 digest。",
      "把研究结论既沉淀为长期资产，也能转成对外内容角度。",
      "适合 founder、strategy、product marketing 等高频判断角色。",
    ],
    dashboardCards: [
      { label: "市场地图", value: "玩家 / 信号 / 变化", note: "用同一套结构跟踪竞争与市场" },
      { label: "知识资产", value: "洞察 -> 框架", note: "把零散研究整理成长期可复用体系" },
      { label: "推荐启动", value: "Digest -> Brain -> Radar", note: "先收集，再判断，再转表达" },
    ],
    shortcutButtons: [
      {
        title: "看市场",
        caption: "先抓变化，再决定今天该追哪条线。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "deep_research_hub", label: "打开 Deep Research Hub" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
      {
        title: "做映射",
        caption: "把竞争、产品和用户信号写进研究脑图。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "转表达",
        caption: "把研究结论转成对外内容或内部 briefing。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
    ],
    todayChecklist: [
      "先通过 Deep Research Hub 明确研究问题和对比维度。",
      "再通过 Tech News Digest 和 Morning Brief 确认今日最重要的市场变化。",
      "在 Second Brain / Knowledge Vault 里更新市场地图和长期判断。",
      "把值得对外表达的结论送去 Creator Radar 形成内容角度。",
    ],
    launchSequence: [
      "deep_research_hub",
      "tech_news_digest",
      "morning_brief",
      "second_brain",
      "knowledge_vault",
      "creator_radar",
    ],
    appSpotlights: [
      {
        appId: "deep_research_hub",
        role: "研究简报台",
        outcome: "先把研究主题压成一份结构化 brief，再进入市场映射。",
      },
      {
        appId: "second_brain",
        role: "研究主脑",
        outcome: "把市场观察、竞争格局和判断过程长期记录下来。",
      },
      {
        appId: "knowledge_vault",
        role: "资料与框架库",
        outcome: "让研究模板、名单和原始资料可持续复用。",
      },
      {
        appId: "creator_radar",
        role: "观点转译器",
        outcome: "把研究结论整理成适合内部或外部传播的角度。",
      },
      {
        appId: "morning_brief",
        role: "行动收口",
        outcome: "把市场变化压成今天的优先动作。",
      },
    ],
    quickActions: [
      {
        title: "市场扫描",
        desc: "先看变化，再更新研究框架。",
        actions: [
          { type: "open_app", appId: "deep_research_hub", label: "打开 Deep Research Hub" },
          { type: "open_app", appId: "tech_news_digest", label: "打开 Tech News Digest" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "研究转内容",
        desc: "将研究观察整理成内容表达方向。",
        actions: [
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
          { type: "open_app", appId: "creator_radar", label: "打开 Creator Radar" },
        ],
      },
    ],
  },
  {
    id: "recruiting-pipeline-studio",
    industryId: "people_hiring",
    title: "Recruiting Pipeline Studio",
    summary:
      "围绕简历筛选、面试纪要、候选人评分卡和后续邮件，适合招聘负责人和用人经理使用。",
    sourceUseCases: [
      "Interview Notes & Candidate Scorecards",
      "Recruiting Coordination Assistant",
      "Custom Follow-up Email Assistant",
      "Second Brain",
    ],
    featuredApps: [
      "recruiting_desk",
      "meeting_copilot",
      "email_assistant",
      "task_manager",
      "knowledge_vault",
    ],
    desktopApps: [
      "industry_hub",
      "recruiting_desk",
      "meeting_copilot",
      "email_assistant",
      "task_manager",
      "knowledge_vault",
      "second_brain",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "recruiting_desk",
      "email_assistant",
      "task_manager",
      "settings",
    ],
    highlights: [
      "把候选人资料、面试记录和评分卡收口到一个招聘桌面。",
      "后续动作可以直接进入任务中心，减少面试完就中断的情况。",
      "适合招聘 lead、founder 和一线面试官快速收口判断。",
    ],
    dashboardCards: [
      { label: "候选人判断", value: "简历 -> 面试 -> 评分卡", note: "先记录，再判断，再推进下一步" },
      { label: "沟通闭环", value: "Scorecard -> Email", note: "减少反馈和安排面试的重复劳动" },
      { label: "推荐启动", value: "Meeting -> Recruiting -> Follow-up", note: "先整理记录，再做判断和跟进" },
    ],
    shortcutButtons: [
      {
        title: "候选人评分",
        caption: "把面试记录快速整理成评分卡。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "recruiting_desk", label: "打开 Recruiting Desk" },
        ],
      },
      {
        title: "安排后续",
        caption: "把下一轮面试和沟通动作收口出来。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "recruiting_desk", label: "打开 Recruiting Desk" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "发跟进邮件",
        caption: "生成候选人沟通或面试安排邮件。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
          { type: "open_app", appId: "recruiting_desk", label: "打开 Recruiting Desk" },
        ],
      },
    ],
    todayChecklist: [
      "先把今天的候选人记录和面试笔记整理出来。",
      "在 Recruiting Desk 生成评分卡，明确优势、风险和后续动作。",
      "对需要继续推进的候选人，立刻生成跟进邮件并同步任务。",
    ],
    launchSequence: [
      "meeting_copilot",
      "recruiting_desk",
      "email_assistant",
      "task_manager",
    ],
    appSpotlights: [
      {
        appId: "recruiting_desk",
        role: "候选人评分台",
        outcome: "把资料和面试观察整理成一份可执行评分卡。",
      },
      {
        appId: "meeting_copilot",
        role: "面试纪要入口",
        outcome: "先把原始面试记录压成结构化纪要。",
      },
      {
        appId: "email_assistant",
        role: "候选人沟通器",
        outcome: "快速生成安排面试、同步结果或感谢信邮件。",
      },
      {
        appId: "task_manager",
        role: "流程推进板",
        outcome: "把后续面试、反馈和内部同步动作统一收口。",
      },
    ],
    quickActions: [
      {
        title: "面试后收口",
        desc: "纪要、评分卡和后续动作一次整理。",
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "recruiting_desk", label: "打开 Recruiting Desk" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "候选人跟进",
        desc: "根据评分卡快速生成候选人邮件。",
        actions: [
          { type: "open_app", appId: "recruiting_desk", label: "打开 Recruiting Desk" },
          { type: "open_app", appId: "email_assistant", label: "打开 Email Assistant" },
        ],
      },
    ],
  },
  {
    id: "project-delivery-desk",
    industryId: "operations_delivery",
    title: "Project Delivery Desk",
    summary:
      "围绕项目周报、风险同步、会议收口和任务推进，适合项目经理、运营负责人和交付团队使用。",
    sourceUseCases: [
      "Project Status Briefing",
      "Automated Meeting Notes & Action Items",
      "Daily Ops Brief",
      "Second Brain",
    ],
    featuredApps: [
      "project_ops",
      "morning_brief",
      "meeting_copilot",
      "task_manager",
      "knowledge_vault",
    ],
    desktopApps: [
      "industry_hub",
      "project_ops",
      "morning_brief",
      "meeting_copilot",
      "task_manager",
      "knowledge_vault",
      "second_brain",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "project_ops",
      "task_manager",
      "morning_brief",
      "settings",
    ],
    highlights: [
      "项目进展、阻塞和下一步动作不再散在群聊和文档里。",
      "晨报、会议纪要和项目 brief 串成一条稳定的交付节奏。",
      "适合项目负责人、运营 lead 和跨团队交付场景。",
    ],
    dashboardCards: [
      { label: "推进闭环", value: "Meeting -> Project -> Tasks", note: "先收口事实，再同步动作" },
      { label: "关键风险", value: "目标 / 阻塞 / Owner", note: "把含糊风险压成明确动作" },
      { label: "推荐启动", value: "Brief -> Meeting -> Delivery", note: "先明确优先级，再推进执行" },
    ],
    shortcutButtons: [
      {
        title: "写项目 Brief",
        caption: "把更新、风险和下一步整理成执行版简报。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "project_ops", label: "打开 Project Ops Board" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
      {
        title: "会后收口",
        caption: "把会议纪要直接转成项目动作项。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "project_ops", label: "打开 Project Ops Board" },
        ],
      },
      {
        title: "同步任务",
        caption: "把项目下一步快速送去任务中心执行。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "project_ops", label: "打开 Project Ops Board" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
    todayChecklist: [
      "先明确今天最影响项目推进的一项阻塞。",
      "在 Project Ops Board 生成项目 brief，确认风险和 owner。",
      "把下一步动作同步到任务中心，并把关键上下文带入晨报。",
    ],
    launchSequence: [
      "morning_brief",
      "project_ops",
      "meeting_copilot",
      "task_manager",
    ],
    appSpotlights: [
      {
        appId: "project_ops",
        role: "项目推进板",
        outcome: "把进展、风险、阻塞和下一步压成一页执行 brief。",
      },
      {
        appId: "morning_brief",
        role: "日优先级入口",
        outcome: "把项目推进的重点先收口到当天节奏里。",
      },
      {
        appId: "meeting_copilot",
        role: "会后事实收集器",
        outcome: "把项目会议纪要结构化，再转成动作项。",
      },
      {
        appId: "task_manager",
        role: "执行落地器",
        outcome: "确保项目动作进入明确待办，而不是停留在 brief 里。",
      },
    ],
    quickActions: [
      {
        title: "项目周会闭环",
        desc: "先整理纪要，再写项目 brief，再下发任务。",
        actions: [
          { type: "open_app", appId: "meeting_copilot", label: "打开 Meeting Copilot" },
          { type: "open_app", appId: "project_ops", label: "打开 Project Ops Board" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
      {
        title: "每日推进同步",
        desc: "把项目关键更新带入晨报和任务节奏。",
        actions: [
          { type: "open_app", appId: "project_ops", label: "打开 Project Ops Board" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
    ],
  },
  {
    id: "personal-home-board",
    industryId: "personal_life",
    title: "Home Coordination Board",
    summary:
      "围绕家庭安排、补货提醒、日常任务和晚间复盘，适合把家庭协同和个人节奏收口在一页上。",
    sourceUseCases: [
      "Family Calendar & Household Assistant",
      "Custom Morning Brief",
      "Habit Tracker & Accountability Coach",
      "Second Brain",
    ],
    featuredApps: [
      "family_calendar",
      "morning_brief",
      "task_manager",
      "habit_tracker",
      "second_brain",
    ],
    desktopApps: [
      "industry_hub",
      "family_calendar",
      "morning_brief",
      "task_manager",
      "habit_tracker",
      "second_brain",
      "knowledge_vault",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "family_calendar",
      "task_manager",
      "habit_tracker",
      "settings",
    ],
    highlights: [
      "更偏家庭协同和家务收口，而不是纯个人健康记录。",
      "把接送、采购、提醒和日常待办放在一张桌面里。",
      "晚间再通过习惯和第二大脑完成复盘。",
    ],
    dashboardCards: [
      { label: "今日家庭节奏", value: "日历 + 任务", note: "先看安排，再分派事项" },
      { label: "家务收口", value: "补货 / 提醒 / 跟进", note: "减少碎片化沟通" },
      { label: "推荐启动", value: "Calendar -> Tasks -> Review", note: "先看日程，再跑执行" },
    ],
    shortcutButtons: [
      {
        title: "看安排",
        caption: "先确认今天的家庭节奏和提醒事项。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
      {
        title: "收家务",
        caption: "把补货、接送和待办统一收口。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
        ],
      },
      {
        title: "晚间回看",
        caption: "回顾习惯和家庭观察，写下今天记录。",
        accent: "rose",
        actions: [
          { type: "open_app", appId: "habit_tracker", label: "打开 Habit Tracker" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
    ],
    todayChecklist: [
      "先看 Family Calendar 和 Morning Brief，确认今日安排和提醒。",
      "把采购、接送、联络和家庭待办压进 Task Manager。",
      "晚上用 Habit Tracker 和 Second Brain 做一轮简单复盘。",
    ],
    launchSequence: [
      "family_calendar",
      "morning_brief",
      "task_manager",
      "habit_tracker",
      "second_brain",
    ],
    appSpotlights: [
      {
        appId: "family_calendar",
        role: "家庭调度台",
        outcome: "接送、补货、活动和提醒事项可以统一查看。",
      },
      {
        appId: "task_manager",
        role: "家务执行板",
        outcome: "把零散事项收口到一处，减少遗漏。",
      },
      {
        appId: "habit_tracker",
        role: "日常复盘器",
        outcome: "把长期想坚持的日常习惯稳定记录下来。",
      },
      {
        appId: "second_brain",
        role: "家庭观察记录",
        outcome: "把问题、经验和长期安排沉淀下来。",
      },
    ],
    quickActions: [
      {
        title: "家庭日程启动",
        desc: "先看安排，再收任务，再推进提醒。",
        actions: [
          { type: "open_app", appId: "family_calendar", label: "打开 Family Calendar" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          { type: "open_app", appId: "morning_brief", label: "打开 Morning Brief" },
        ],
      },
      {
        title: "晚间回看",
        desc: "复盘习惯、观察和第二天注意事项。",
        actions: [
          { type: "open_app", appId: "habit_tracker", label: "打开 Habit Tracker" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
    ],
  },
  {
    id: "language-mastery-desk",
    industryId: "personal_life",
    title: "Language Mastery Desk",
    summary:
      "把翻译、场景短句、口语练习和周期复习压成一张个人学习桌面，适合高频语言提升场景。",
    sourceUseCases: [
      "Language Learning Desk",
      "Real-time Translation Workflow",
      "Second Brain",
    ],
    featuredApps: [
      "language_learning_desk",
      "knowledge_vault",
      "task_manager",
      "second_brain",
      "morning_brief",
    ],
    desktopApps: [
      "industry_hub",
      "language_learning_desk",
      "knowledge_vault",
      "task_manager",
      "second_brain",
      "morning_brief",
      "settings",
    ],
    dockApps: [
      "industry_hub",
      "language_learning_desk",
      "knowledge_vault",
      "task_manager",
      "settings",
    ],
    highlights: [
      "把实时翻译、短句练习和角色扮演放到一个统一入口里。",
      "先生成学习包，再把高频表达沉淀到知识库。",
      "把复习动作写进任务中心，形成真正可持续的练习节奏。",
    ],
    dashboardCards: [
      { label: "今日练习", value: "1 个主题", note: "只推进一个最常用场景，避免分散" },
      { label: "短句沉淀", value: "5-10 句", note: "每天先收最常用表达，而不是贪多" },
      { label: "推荐启动", value: "Learn -> Vault -> Review", note: "先练，再沉淀，再复习" },
    ],
    shortcutButtons: [
      {
        title: "开始练习",
        caption: "先生成一份可直接练的语言学习包。",
        accent: "blue",
        actions: [
          { type: "open_app", appId: "language_learning_desk", label: "打开 Language Learning Desk" },
        ],
      },
      {
        title: "沉淀短句",
        caption: "把高频表达、模板句和错题整理进知识库。",
        accent: "emerald",
        actions: [
          { type: "open_app", appId: "language_learning_desk", label: "打开 Language Learning Desk" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "安排复习",
        caption: "把下一轮练习和复习动作写入任务中心。",
        accent: "amber",
        actions: [
          { type: "open_app", appId: "language_learning_desk", label: "打开 Language Learning Desk" },
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
        ],
      },
    ],
    todayChecklist: [
      "先选一个最常用场景，例如旅行、会议或客服回复。",
      "在 Language Learning Desk 里生成练习包，只记住今天最核心的 5 个表达。",
      "把短句和复习动作分别送去 Knowledge Vault 与 Task Manager。",
    ],
    launchSequence: [
      "language_learning_desk",
      "knowledge_vault",
      "task_manager",
      "second_brain",
    ],
    appSpotlights: [
      {
        appId: "language_learning_desk",
        role: "语言练习入口",
        outcome: "把翻译、重点表达、角色扮演和下一步练习动作压成一份学习包。",
      },
      {
        appId: "knowledge_vault",
        role: "短句知识库",
        outcome: "把高频表达、模板句和纠错点沉淀下来，避免重复整理。",
      },
      {
        appId: "task_manager",
        role: "复习节奏器",
        outcome: "确保下一轮跟读、复述和复习真正进入你的日常执行。",
      },
      {
        appId: "second_brain",
        role: "长期学习记录",
        outcome: "沉淀自己的语言卡点、使用场景和持续观察。",
      },
    ],
    quickActions: [
      {
        title: "今日场景练习",
        desc: "先生成学习包，再整理短句。",
        actions: [
          { type: "open_app", appId: "language_learning_desk", label: "打开 Language Learning Desk" },
          { type: "open_app", appId: "knowledge_vault", label: "打开 知识库" },
        ],
      },
      {
        title: "复习闭环",
        desc: "把下一轮练习动作和复盘记录收口到任务中心和第二大脑。",
        actions: [
          { type: "open_app", appId: "task_manager", label: "打开 任务中心" },
          { type: "open_app", appId: "second_brain", label: "打开 Second Brain" },
        ],
      },
    ],
  },
];

export function listBundlesByIndustry(industryId: IndustryId) {
  return industryBundles.filter((bundle) => bundle.industryId === industryId);
}

export function getIndustryBundle(bundleId: string) {
  return industryBundles.find((bundle) => bundle.id === bundleId) ?? null;
}

export function mapIndustryToWorkspaceIndustry(industryId: IndustryId): WorkspaceIndustryId {
  switch (industryId) {
    case "creator_media":
      return "creator";
    case "sales_growth":
      return "sales";
    case "support_success":
      return "support";
    case "research_strategy":
      return "research";
    case "people_hiring":
      return "people";
    case "operations_delivery":
      return "operations";
    case "personal_life":
    default:
      return "personal";
  }
}
